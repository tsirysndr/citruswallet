import citruswallet/chain.{type Chain}
import citruswallet/directory
import citruswallet/error.{type HttpError, HttpError}
import citruswallet/ffi/atproto
import citruswallet/ffi/hono.{type Context, type Response}
import citruswallet/ffi/js.{type Js}
import citruswallet/ffi/node
import citruswallet/ffi/url
import citruswallet/identity.{type Lookup}
import citruswallet/linking.{type Links}
import citruswallet/network.{type Network}
import citruswallet/oauth
import citruswallet/payments.{type Payments}
import citruswallet/rate_limit.{type Limiter}
import citruswallet/store.{type Store}
import citruswallet/validate
import gleam/bool
import gleam/dynamic/decode
import gleam/int
import gleam/javascript/promise.{type Promise}
import gleam/json.{type Json}
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string

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

type Server {
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

type Session {
  Session(did: Option(String), csrf: String, created_at: Int)
}

type Reply {
  Payload(status: Int, body: Json)
  Value(status: Int, body: Js)
  Elsewhere(location: String)
}

type Route =
  fn(Server, Context) -> Promise(Result(Reply, HttpError))

/// The frontend's own routes. Naming them keeps a mistyped API path a JSON
/// 404 instead of a page.
const screens = ["/wallet", "/payments", "/activity"]

const session_lifetime = 28_800_000

const binding_lifetime = 600_000

const guarded = ["/api/*", "/auth/*"]

const suggesting = ["/api/actors/*"]

pub fn build(settings: Settings) -> hono.App {
  let server = configure(settings)
  let app = hono.new()

  hono.use_(
    app,
    hono.security(
      is_secure(settings.origin),
      image_sources: directory.avatar_hosts,
    ),
  )
  hono.use_on(
    app,
    guarded,
    hono.body_limit(8192, fn(ctx) {
      promise.resolve(refuse(ctx, HttpError(413, "Request body is too large.")))
    }),
  )
  hono.use_on(app, suggesting, limiting(server.search_limiter))
  hono.use_on(app, guarded, limiting(server.limiter))
  hono.use_on(app, guarded, no_store())
  hono.use_(app, same_origin(server))
  hono.use_on(app, guarded, csrf(server))

  hono.get(app, "/client-metadata.json", serve(server, client_metadata))
  hono.get(app, "/api/session", serve(server, current_session))
  hono.post(app, "/auth/start", serve(server, start_login))
  hono.get(app, "/auth/callback", serve(server, finish_login))
  hono.post(app, "/api/challenge", serve(server, create_challenge))
  hono.post(app, "/api/verify", serve(server, verify_challenge))
  hono.delete(app, "/api/links/:address", serve(server, unlink_wallet))
  hono.post(app, "/api/links/default", serve(server, choose_default))
  hono.post(app, "/api/recipients/resolve", serve(server, resolve_recipient))
  hono.post(app, "/api/payments", serve(server, create_payment))
  hono.get(app, "/api/payments", serve(server, list_payments))
  hono.get(app, "/api/payments/:id", serve(server, read_payment))
  hono.post(app, "/api/payments/:id/invitation", serve(server, invite))
  hono.post(app, "/api/payments/:id/cancel", serve(server, cancel_payment))
  hono.post(app, "/api/payments/:id/prepare", serve(server, prepare_payment))
  hono.post(app, "/api/payments/:id/submit", serve(server, submit_payment))
  hono.get(app, "/api/invitations/:token", serve(server, read_invitation))
  hono.post(
    app,
    "/api/invitations/:token/accept",
    serve(server, accept_invitation),
  )
  hono.post(app, "/api/logout", serve(server, logout))
  hono.get(app, "/api/resolve/:did", serve(server, public_links))
  hono.get(app, "/api/actors/search", serve(server, suggest_actors))
  hono.get(app, "/api/profile", serve(server, account_profile))

  hono.use_(app, hono.files(settings.public_directory))
  hono.use_on(app, screens, hono.document(settings.public_directory))
  hono.not_found(app, fn(ctx) {
    promise.resolve(refuse(ctx, error.not_found("Not found.")))
  })
  hono.on_error(app, fn(thrown, ctx) {
    node.log_error("Request failed: " <> thrown.name)
    refuse(ctx, HttpError(500, "Request failed. Please try again."))
  })
  app
}

fn configure(settings: Settings) -> Server {
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
      True -> "__Host-citruswallet"
      False -> "citruswallet"
    },
  )
}

fn is_secure(origin: String) -> Bool {
  case url.parse(origin) {
    Ok(parsed) -> url.protocol(parsed) == "https:"
    Error(_) -> False
  }
}

fn serve(server: Server, route: Route) -> hono.Handler {
  fn(ctx) { promise.map(route(server, ctx), render(ctx, _)) }
}

fn render(ctx: Context, outcome: Result(Reply, HttpError)) -> Response {
  case outcome {
    Ok(Payload(status, body)) -> hono.json(ctx, status, json.to_string(body))
    Ok(Value(status, body)) -> hono.json_value(ctx, status, body)
    Ok(Elsewhere(location)) -> hono.redirect(ctx, location)
    Error(reason) -> refuse(ctx, reason)
  }
}

fn refuse(ctx: Context, reason: HttpError) -> Response {
  hono.json(
    ctx,
    reason.status,
    json.to_string(json.object([#("error", json.string(reason.message))])),
  )
}

fn limiting(limiter: Limiter) -> hono.Middleware {
  hono.gate(fn(ctx) {
    // The dedicated suggestion limiter already covers these requests.
    use <- skip_when(
      limiter.namespace == "rate"
      && string.starts_with(hono.path(ctx), "/api/actors/"),
    )
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

fn skip_when(
  skip: Bool,
  continue: fn() -> Promise(Option(Response)),
) -> Promise(Option(Response)) {
  case skip {
    True -> promise.resolve(None)
    False -> continue()
  }
}

fn no_store() -> hono.Middleware {
  hono.gate(fn(ctx) {
    hono.set_header(ctx, "Cache-Control", "no-store")
    promise.resolve(None)
  })
}

fn same_origin(server: Server) -> hono.Middleware {
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

fn csrf(server: Server) -> hono.Middleware {
  hono.gate(fn(ctx) {
    promise.resolve(
      case list.contains(["GET", "HEAD", "OPTIONS"], hono.method(ctx)) {
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

fn verified(server: Server, ctx: Context) -> Result(Nil, HttpError) {
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

fn browser(
  server: Server,
  ctx: Context,
  create create: Bool,
) -> Result(#(String, Session), HttpError) {
  let existing =
    hono.cookie(ctx, server.cookie_name)
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
        namespace: "browser",
        key: key,
        now: node.now(),
      )
      |> option.then(decode_session)
      |> option.map(fn(session) { #(key, session) })
    })
  case found, create {
    Some(session), _ -> Ok(session)
    None, True -> Ok(open_session(server, ctx, None))
    None, False ->
      Error(error.unauthorized("Session expired. Reload and sign in again."))
  }
}

fn authenticated(
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

fn open_session(
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

fn client_metadata(
  server: Server,
  _ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  done(Ok(Value(200, atproto.client_metadata(server.settings.oauth))))
}

fn current_session(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  done({
    use #(_, session) <- result.map(browser(server, ctx, create: True))
    Payload(
      200,
      json.object([
        #("network", network.to_json(server.settings.network)),
        #("paymentsEnabled", json.bool(server.settings.chain != None)),
        #("did", json.nullable(session.did, json.string)),
        #("csrf", json.string(session.csrf)),
        #("links", case session.did {
          Some(did) ->
            json.array(
              linking.list(server.links, did, public_only: False),
              linking.to_json,
            )
          None -> json.preprocessed_array([])
        }),
      ]),
    )
  })
}

fn start_login(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(read_body(ctx))
  use #(key, _) <- attempt(browser(server, ctx, create: False))
  let creating = js.as_bool(js.get(body, "create")) == Some(True)
  use identifier <- attempt(case creating {
    True -> Ok(server.settings.signup_provider)
    False -> identity.normalize(js.string_field(body, "identifier"))
  })
  let state = node.random_hex(32)
  store.put(
    server.settings.store,
    namespace: "oauth-binding",
    key: state,
    value: json.to_string(json.object([#("session", json.string(key))])),
    expires: node.now() + binding_lifetime,
  )
  use outcome <- promise.await(case creating {
    True -> oauth.create_account(server.settings.oauth, identifier, state)
    False -> oauth.authorize(server.settings.oauth, identifier, state)
  })
  done(case outcome {
    Ok(authorization) ->
      Ok(Payload(200, json.object([#("url", json.string(authorization))])))
    Error(_) -> {
      store.delete(
        server.settings.store,
        namespace: "oauth-binding",
        key: state,
      )
      Error(
        HttpError(502, case creating {
          True -> "Could not reach " <> identifier <> " to create an account."
          False ->
            "Could not start AT Protocol login. Check your handle and try again."
        }),
      )
    }
  })
}

fn finish_login(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use #(key, _) <- attempt(browser(server, ctx, create: False))
  use query <- attempt(
    url.parse(hono.url(ctx))
    |> result.map(url.query)
    |> result.replace_error(expired_login()),
  )
  use callback <- promise.try_await(
    promise.map(
      atproto.callback(server.settings.oauth, query),
      result.replace_error(_, expired_login()),
    ),
  )
  use binding <- attempt(option.to_result(
    callback.state
      |> option.then(fn(state) {
        store.get(
          server.settings.store,
          namespace: "oauth-binding",
          key: state,
          now: node.now(),
        )
        |> option.then(decode_binding)
        |> option.map(fn(session) { #(state, session) })
      }),
    wrong_browser(),
  ))
  let #(state, session) = binding
  use <- guard(node.secure_equal(session, key), wrong_browser())
  store.delete(server.settings.store, namespace: "oauth-binding", key: state)
  store.delete(server.settings.store, namespace: "browser", key: key)
  store.forget_challenges(server.settings.store, key)
  let _ = open_session(server, ctx, Some(callback.did))
  oauth.forget_session(server.settings.store, callback.did)
  done(Ok(Elsewhere("/")))
}

fn expired_login() -> HttpError {
  error.bad_request(
    "AT Protocol login failed or expired. Return to the home page and try again.",
  )
}

fn wrong_browser() -> HttpError {
  error.forbidden("Login belongs to a different browser session. Start again.")
}

fn create_challenge(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(read_body(ctx))
  use #(key, did) <- attempt(authenticated(server, ctx))
  use discoverable <- attempt(discoverable(body))
  use challenge <- attempt(linking.create(
    server.links,
    session: key,
    did: did,
    address: js.string_field(body, "address"),
    discoverable: discoverable,
  ))
  done(
    Ok(Payload(
      200,
      linking.challenge_to_json(challenge, server.settings.network.chain_id),
    )),
  )
}

fn discoverable(body: Js) -> Result(Bool, HttpError) {
  let raw = js.get(body, "public")
  case js.is_undefined(raw) {
    True -> Ok(False)
    False ->
      case js.as_bool(raw) {
        Some(value) -> Ok(value)
        None -> Error(error.bad_request("public must be a boolean."))
      }
  }
}

fn verify_challenge(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(read_body(ctx))
  use #(key, did) <- attempt(authenticated(server, ctx))
  use links <- promise.try_await(linking.verify(
    server.links,
    session: key,
    did: did,
    id: js.string_field(body, "id"),
    signature: js.string_field(body, "signature"),
  ))
  done(Ok(linked(links)))
}

fn unlink_wallet(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  done({
    use #(_, did) <- result.try(authenticated(server, ctx))
    use _ <- result.map(linking.unlink(
      server.links,
      did,
      option.unwrap(hono.parameter(ctx, "address"), ""),
    ))
    linked(linking.list(server.links, did, public_only: False))
  })
}

fn choose_default(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(read_body(ctx))
  done({
    use #(_, did) <- result.try(authenticated(server, ctx))
    use links <- result.map(linking.set_default(
      server.links,
      did,
      js.string_field(body, "address"),
    ))
    linked(links)
  })
}

fn linked(links: List(linking.Link)) -> Reply {
  Payload(200, json.object([#("links", json.array(links, linking.to_json))]))
}

fn resolve_recipient(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(read_body(ctx))
  use _ <- attempt(authenticated(server, ctx))
  use #(recipient, address) <- promise.try_await(payments.resolve(
    server.payments,
    js.string_field(body, "identifier"),
  ))
  done(
    Ok(Payload(
      200,
      json.object(
        list.append(identity.to_json(recipient), [
          #("chainId", json.int(server.settings.network.chain_id)),
          #("address", json.nullable(address, json.string)),
        ]),
      ),
    )),
  )
}

fn create_payment(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(read_body(ctx))
  use #(_, did) <- attempt(authenticated(server, ctx))
  use #(payment, invitation) <- promise.try_await(payments.create(
    server.payments,
    sender_did: did,
    identifier: js.string_field(body, "identifier"),
    expected_did: js.string_field(body, "expectedDid"),
    amount: js.string_field(body, "amount"),
  ))
  done(
    Ok(Payload(
      201,
      json.object([
        #("payment", payments.to_json(payment, server.payments, sender: True)),
        #("invitationUrl", json.string(invitation)),
      ]),
    )),
  )
}

fn list_payments(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  done({
    use #(_, did) <- result.map(authenticated(server, ctx))
    Payload(
      200,
      json.object([
        #(
          "payments",
          json.array(payments.list(server.payments, did), fn(payment) {
            payments.to_json(payment, server.payments, sender: True)
          }),
        ),
      ]),
    )
  })
}

fn read_payment(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use #(_, did) <- attempt(authenticated(server, ctx))
  use payment <- promise.try_await(payments.get(
    server.payments,
    did,
    hono.parameter(ctx, "id"),
  ))
  done(Ok(one_payment(server, payment, sender: True)))
}

fn invite(server: Server, ctx: Context) -> Promise(Result(Reply, HttpError)) {
  done({
    use #(_, did) <- result.try(authenticated(server, ctx))
    use invitation <- result.map(payments.invitation(
      server.payments,
      did,
      hono.parameter(ctx, "id"),
    ))
    Payload(200, json.object([#("invitationUrl", json.string(invitation))]))
  })
}

fn cancel_payment(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  done({
    use #(_, did) <- result.try(authenticated(server, ctx))
    use payment <- result.map(payments.cancel(
      server.payments,
      did,
      hono.parameter(ctx, "id"),
    ))
    one_payment(server, payment, sender: True)
  })
}

fn prepare_payment(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(read_body(ctx))
  use #(_, did) <- attempt(authenticated(server, ctx))
  use attempt <- promise.try_await(payments.prepare(
    server.payments,
    did,
    hono.parameter(ctx, "id"),
    js.int_field(body, "revision"),
    js.string_field(body, "address"),
    js.string_field(body, "fromAddress"),
  ))
  done(Ok(Payload(200, payments.attempt_to_json(attempt, server.payments))))
}

fn submit_payment(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(read_body(ctx))
  use #(_, did) <- attempt(authenticated(server, ctx))
  use payment <- promise.try_await(payments.submit(
    server.payments,
    did,
    hono.parameter(ctx, "id"),
    js.string_field(body, "attemptId"),
    js.string_field(body, "txHash"),
  ))
  done(Ok(one_payment(server, payment, sender: True)))
}

fn read_invitation(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  done({
    use #(_, did) <- result.try(authenticated(server, ctx))
    use payment <- result.map(payments.read_invitation(
      server.payments,
      hono.parameter(ctx, "token"),
      did,
    ))
    one_payment(server, payment, sender: False)
  })
}

fn accept_invitation(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(read_body(ctx))
  done({
    use #(_, did) <- result.try(authenticated(server, ctx))
    use payment <- result.map(payments.accept(
      server.payments,
      hono.parameter(ctx, "token"),
      did,
      js.string_field(body, "address"),
    ))
    one_payment(server, payment, sender: False)
  })
}

fn one_payment(
  server: Server,
  payment: payments.Payment,
  sender sender: Bool,
) -> Reply {
  Payload(
    200,
    json.object([
      #("payment", payments.to_json(payment, server.payments, sender: sender)),
    ]),
  )
}

fn logout(server: Server, ctx: Context) -> Promise(Result(Reply, HttpError)) {
  done({
    use #(key, _) <- result.map(browser(server, ctx, create: False))
    store.delete(server.settings.store, namespace: "browser", key: key)
    store.forget_challenges(server.settings.store, key)
    hono.clear(ctx, server.cookie_name, server.cookie)
    Payload(200, json.object([#("ok", json.bool(True))]))
  })
}

fn public_links(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  done({
    let did = option.unwrap(hono.parameter(ctx, "did"), "")
    use <- bool.guard(
      when: !identity.supported_method(did) || string.length(did) > 2048,
      return: Error(error.bad_request("Expected an AT Protocol DID.")),
    )
    Ok(Payload(
      200,
      json.object([
        #("did", json.string(did)),
        #(
          "links",
          json.array(
            linking.list(server.links, did, public_only: True),
            linking.to_json,
          ),
        ),
      ]),
    ))
  })
}

fn suggest_actors(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  // A session, but not a DID: the login field suggests handles before sign-in.
  use _ <- attempt(browser(server, ctx, create: False))
  let query =
    hono.query_parameter(ctx, "q")
    |> option.unwrap("")
    |> string.trim
    |> string.replace("@", "")
  case
    string.is_empty(query)
    || string.length(query) > 64
    || identity.is_did(query)
  {
    True -> done(Ok(suggested([])))
    False -> {
      use actors <- promise.try_await(server.settings.directory.search(query))
      done(Ok(suggested(actors)))
    }
  }
}

fn account_profile(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use #(_, did) <- attempt(authenticated(server, ctx))
  use actor <- promise.try_await(server.settings.directory.profile(did))
  done(
    Ok(Payload(
      200,
      json.object([
        #("actor", case actor {
          Some(actor) -> directory.to_json(actor)
          None -> json.null()
        }),
      ]),
    )),
  )
}

fn suggested(actors: List(directory.Actor)) -> Reply {
  Payload(
    200,
    json.object([#("actors", json.array(actors, directory.to_json))]),
  )
}

fn read_body(ctx: Context) -> Promise(Result(Js, HttpError)) {
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

fn encode_session(session: Session) -> String {
  json.to_string(
    json.object([
      #("did", json.nullable(session.did, json.string)),
      #("csrf", json.string(session.csrf)),
      #("createdAt", json.int(session.created_at)),
    ]),
  )
}

fn decode_session(value: String) -> Option(Session) {
  let decoder = {
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

fn decode_binding(value: String) -> Option(String) {
  option.from_result(json.parse(value, decode.at(["session"], decode.string)))
}

fn done(
  outcome: Result(Reply, HttpError),
) -> Promise(Result(Reply, HttpError)) {
  promise.resolve(outcome)
}

fn attempt(
  outcome: Result(a, HttpError),
  continue: fn(a) -> Promise(Result(b, HttpError)),
) -> Promise(Result(b, HttpError)) {
  case outcome {
    Ok(value) -> continue(value)
    Error(reason) -> promise.resolve(Error(reason))
  }
}

fn guard(
  condition: Bool,
  reason: HttpError,
  continue: fn() -> Promise(Result(a, HttpError)),
) -> Promise(Result(a, HttpError)) {
  case condition {
    True -> continue()
    False -> promise.resolve(Error(reason))
  }
}
