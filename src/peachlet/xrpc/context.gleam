import gleam/bool
import gleam/dynamic/decode
import gleam/int
import gleam/javascript/promise.{type Promise}
import gleam/json.{type Json}
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string
import peachlet/chain.{type Chain}
import peachlet/directory
import peachlet/error.{type HttpError, HttpError}
import peachlet/ffi/atproto
import peachlet/ffi/hono.{type Context, type Response}
import peachlet/ffi/js.{type Js}
import peachlet/ffi/node
import peachlet/ffi/url
import peachlet/identity.{type Lookup}
import peachlet/linking.{type Links}
import peachlet/network.{type Network}
import peachlet/payments.{type Payments}
import peachlet/rate_limit.{type Limiter, Limiter}
import peachlet/store.{type Store}
import peachlet/validate

pub type Settings {
  Settings(
    store: Store,
    oauth: atproto.Client,
    origin: String,
    proxy_hops: Int,
    network: Network,
    identities: Lookup,
    directory: directory.Directory,
    signup_provider: String,
    chain: Option(Chain),
    public_directory: String,
  )
}

pub type Server {
  Server(
    settings: Settings,
    links: Links,
    payments: Payments,
    limiter: Limiter,
    search_limiter: Limiter,
    cookie: hono.Cookie,
    cookie_name: String,
  )
}

pub type Session {
  Session(did: Option(String), csrf: String, created_at: Int)
}

pub type Reply {
  Payload(status: Int, body: Json)
  Value(status: Int, body: Js)
  Elsewhere(location: String)
}

pub type Route =
  fn(Server, Context) -> Promise(Result(Reply, HttpError))

const session_lifetime = 28_800_000

pub fn configure(settings: Settings) -> Server {
  let secure = is_secure(settings.origin)
  let links =
    linking.new(settings.store, settings.origin, settings.network.chain_id)
  Server(
    settings: settings,
    links: links,
    payments: payments.new(
      store: settings.store,
      links: links,
      identities: settings.identities,
      origin: settings.origin,
      chain_id: settings.network.chain_id,
      chain: settings.chain,
    ),
    limiter: rate_limit.new(
      settings.store,
      namespace: "rate",
      limit: 60,
      proxy_hops: settings.proxy_hops,
    ),
    // Typeahead gets its own, more generous budget: one keystroke burst must
    // not spend the budget that payment requests need.
    search_limiter: rate_limit.new(
      settings.store,
      namespace: "rate-suggest",
      limit: 240,
      proxy_hops: settings.proxy_hops,
    ),
    cookie: hono.Cookie(
      http_only: True,
      secure: secure,
      same_site: "Lax",
      path: "/",
      max_age: Some(session_lifetime),
    ),
    cookie_name: case secure {
      True -> "__Host-peachlet"
      False -> "peachlet"
    },
  )
}

pub fn is_secure(origin: String) -> Bool {
  case url.parse(origin) {
    Ok(parsed) -> url.protocol(parsed) == "https:"
    Error(_) -> False
  }
}

pub fn serve(server: Server, route: Route) -> hono.Handler {
  fn(ctx) {
    case selected_network(server, ctx) {
      Ok(selected) -> promise.map(route(selected, ctx), render(ctx, _))
      Error(reason) -> promise.resolve(refuse(ctx, reason))
    }
  }
}

// Only fixed, server-controlled networks/RPCs are selectable by clients.
// Custom device RPC URLs never become server-side fetch targets.
pub fn selected_network(
  server: Server,
  ctx: Context,
) -> Result(Server, HttpError) {
  let selected = case hono.header(ctx, "x-peachlet-chain-id") {
    None ->
      case hono.path(ctx) {
        "/xrpc/app.peachlet.subscribeNotifications" ->
          hono.parameter(ctx, "chainId")
        _ -> None
      }
    value -> value
  }
  case selected {
    None -> Ok(server)
    Some(id) -> {
      use selected <- result.try(
        network.configured(server.settings.origin, id)
        |> result.map_error(error.bad_request),
      )
      case selected.chain_id == server.settings.network.chain_id {
        True -> Ok(server)
        False -> {
          use reader <- result.try(
            network.reader(selected)
            |> result.map_error(error.bad_request),
          )
          let settings =
            Settings(..server.settings, network: selected, chain: reader)
          let links =
            linking.new(settings.store, settings.origin, selected.chain_id)
          Ok(
            Server(
              ..server,
              settings: settings,
              links: links,
              payments: payments.new(
                settings.store,
                links,
                settings.identities,
                settings.origin,
                selected.chain_id,
                reader,
              ),
            ),
          )
        }
      }
    }
  }
}

pub fn render(ctx: Context, outcome: Result(Reply, HttpError)) -> Response {
  case outcome {
    Ok(Payload(status, body)) -> hono.json(ctx, status, json.to_string(body))
    Ok(Value(status, body)) -> hono.json_value(ctx, status, body)
    Ok(Elsewhere(location)) -> hono.redirect(ctx, location)
    Error(reason) -> refuse(ctx, reason)
  }
}

pub fn refuse(ctx: Context, reason: HttpError) -> Response {
  hono.json(
    ctx,
    reason.status,
    json.to_string(
      json.object([
        #(
          "error",
          json.string(case reason.status {
            400 -> "InvalidRequest"
            401 -> "AuthenticationRequired"
            403 -> "Forbidden"
            404 -> "NotFound"
            409 -> "Conflict"
            429 -> "RateLimitExceeded"
            _ -> "InternalServerError"
          }),
        ),
        #("message", json.string(reason.message)),
      ]),
    ),
  )
}

pub fn limiting(limiter: Limiter) -> hono.Middleware {
  hono.gate(fn(ctx) {
    // The dedicated suggestion limiter already covers these requests.
    use <- skip_when(
      limiter.namespace == "rate"
      && hono.path(ctx) == "/xrpc/app.peachlet.searchActors",
    )
    // Background polling and portfolio pages must not consume the payment budget.
    let limiter = case
      limiter.namespace == "rate"
      && list.contains(
        [
          "/xrpc/app.peachlet.getSession", "/xrpc/app.peachlet.getProfile",
          "/xrpc/app.peachlet.getAssets", "/xrpc/app.peachlet.getAsset",
          "/xrpc/app.peachlet.getEthPrice", "/xrpc/app.peachlet.listPayments",
          "/xrpc/app.peachlet.listNotifications",
          "/xrpc/app.peachlet.subscribeNotifications",
        ],
        hono.path(ctx),
      )
    {
      True -> Limiter(..limiter, namespace: "rate-background", limit: 240)
      False -> limiter
    }
    let client =
      rate_limit.client(
        limiter,
        hono.remote_address(ctx),
        hono.header(ctx, "x-forwarded-for"),
      )
    let decision = rate_limit.check(limiter, client, now: node.now())
    hono.set_header(ctx, "RateLimit-Policy", rate_limit.policy(limiter))
    hono.set_header(ctx, "RateLimit", rate_limit.report(decision))
    promise.resolve(case decision {
      rate_limit.Allowed(_, _) -> None
      rate_limit.Exceeded(resets_in) -> {
        hono.set_header(ctx, "Retry-After", int.to_string(resets_in))
        Some(refuse(
          ctx,
          HttpError(429, "Too many requests. Please slow down and try again."),
        ))
      }
    })
  })
}

pub fn skip_when(
  skip: Bool,
  continue: fn() -> Promise(Option(Response)),
) -> Promise(Option(Response)) {
  case skip {
    True -> promise.resolve(None)
    False -> continue()
  }
}

pub fn no_store() -> hono.Middleware {
  hono.gate(fn(ctx) {
    hono.set_header(ctx, "Cache-Control", "no-store")
    promise.resolve(None)
  })
}

pub fn same_origin(server: Server) -> hono.Middleware {
  let expected = case url.parse(server.settings.origin) {
    Ok(parsed) -> url.host(parsed)
    Error(_) -> ""
  }
  hono.gate(fn(ctx) {
    promise.resolve(case hono.header(ctx, "host") == Some(expected) {
      True -> None
      False ->
        Some(refuse(
          ctx,
          error.bad_request("Open the app at " <> server.settings.origin <> "."),
        ))
    })
  })
}

pub fn csrf(server: Server) -> hono.Middleware {
  hono.gate(fn(ctx) {
    promise.resolve(
      case
        list.contains(["GET", "HEAD", "OPTIONS"], hono.method(ctx))
        || hono.path(ctx) == "/xrpc/app.peachlet.exchangeNativeSession"
      {
        True -> None
        False ->
          case verified(server, ctx) {
            Ok(_) -> None
            Error(reason) -> Some(refuse(ctx, reason))
          }
      },
    )
  })
}

pub fn verified(server: Server, ctx: Context) -> Result(Nil, HttpError) {
  use <- bool.guard(
    when: hono.header(ctx, "authorization") != None,
    return: browser(server, ctx, create: False) |> result.map(fn(_) { Nil }),
  )

  use <- bool.guard(
    when: hono.header(ctx, "origin") != Some(server.settings.origin),
    return: Error(error.forbidden("Invalid request origin.")),
  )
  use #(_, session) <- result.try(browser(server, ctx, create: False))
  use <- bool.guard(
    when: !node.secure_equal(
      option.unwrap(hono.header(ctx, "x-csrf-token"), ""),
      session.csrf,
    ),
    return: Error(error.forbidden("Invalid CSRF token. Reload the page.")),
  )
  Ok(Nil)
}

pub fn browser(
  server: Server,
  ctx: Context,
  create create: Bool,
) -> Result(#(String, Session), HttpError) {
  let bearer = hono.header(ctx, "authorization")
  let token = case bearer {
    Some(header) -> string.drop_start(header, 7) |> Some
    None -> hono.cookie(ctx, server.cookie_name)
  }
  use <- bool.guard(
    when: case bearer {
      Some(header) -> !string.starts_with(header, "Bearer ")
      None -> False
    },
    return: Error(error.unauthorized("Invalid app session.")),
  )
  let existing =
    token
    |> option.then(fn(token) {
      case validate.is_hex(token, length: 64) {
        True -> Some(node.sha256(token))
        False -> None
      }
    })
  let found =
    existing
    |> option.then(fn(key) {
      store.get(
        server.settings.store,
        namespace: case bearer {
          Some(_) -> "native-session"
          None -> "browser"
        },
        key: key,
        now: node.now(),
      )
      |> option.then(decode_session)
      |> option.map(fn(session) { #(key, session) })
    })
  case found, create && bearer == None {
    Some(session), _ -> Ok(session)
    None, True -> Ok(open_session(server, ctx, None))
    None, False ->
      Error(error.unauthorized("Session expired. Reload and sign in again."))
  }
}

pub fn authenticated(
  server: Server,
  ctx: Context,
) -> Result(#(String, String), HttpError) {
  use #(key, session) <- result.try(browser(server, ctx, create: False))
  use did <- result.try(option.to_result(
    session.did,
    error.unauthorized("Sign in with AT Protocol first."),
  ))
  Ok(#(key, did))
}

pub fn open_session(
  server: Server,
  ctx: Context,
  did: Option(String),
) -> #(String, Session) {
  let token = node.random_hex(32)
  let session =
    Session(did: did, csrf: node.random_hex(32), created_at: node.now())
  store.put(
    server.settings.store,
    namespace: "browser",
    key: node.sha256(token),
    value: encode_session(session),
    expires: node.now() + session_lifetime,
  )
  hono.set(ctx, server.cookie_name, token, server.cookie)
  #(node.sha256(token), session)
}

pub fn read_body(ctx: Context) -> Promise(Result(Js, HttpError)) {
  use text <- promise.map(hono.text_body(ctx))
  case text {
    Error(_) -> Error(error.bad_request("Could not read the request body."))
    Ok(text) ->
      case string.trim(text) {
        "" -> Ok(js.object([]))
        text ->
          js.attempt(fn() { js.parse(text) })
          |> result.replace_error(error.bad_request("Invalid JSON body."))
      }
  }
}

pub fn encode_session(session: Session) -> String {
  json.to_string(
    json.object([
      #("did", json.nullable(session.did, json.string)),
      #("csrf", json.string(session.csrf)),
      #("createdAt", json.int(session.created_at)),
      #("scopeVersion", json.int(1)),
    ]),
  )
}

pub fn decode_session(value: String) -> Option(Session) {
  let decoder = {
    use _ <- decode.field("scopeVersion", decode.int)
    use did <- decode.optional_field(
      "did",
      None,
      decode.optional(decode.string),
    )
    use csrf <- decode.field("csrf", decode.string)
    use created_at <- decode.field("createdAt", decode.int)
    decode.success(Session(did: did, csrf: csrf, created_at: created_at))
  }
  option.from_result(json.parse(value, decoder))
}

pub fn done(
  outcome: Result(Reply, HttpError),
) -> Promise(Result(Reply, HttpError)) {
  promise.resolve(outcome)
}

pub fn attempt(
  outcome: Result(a, HttpError),
  continue: fn(a) -> Promise(Result(b, HttpError)),
) -> Promise(Result(b, HttpError)) {
  case outcome {
    Ok(value) -> continue(value)
    Error(reason) -> promise.resolve(Error(reason))
  }
}

pub fn guard(
  condition: Bool,
  reason: HttpError,
  continue: fn() -> Promise(Result(a, HttpError)),
) -> Promise(Result(a, HttpError)) {
  case condition {
    True -> continue()
    False -> promise.resolve(Error(reason))
  }
}
