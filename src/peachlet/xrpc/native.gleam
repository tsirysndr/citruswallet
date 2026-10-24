import gleam/javascript/promise
import gleam/json
import gleam/option.{None, Some}
import gleam/result
import peachlet/error
import peachlet/ffi/better_sqlite.{type Client}
import peachlet/ffi/hono.{type Context}
import peachlet/ffi/js.{type Js}
import peachlet/ffi/node
import peachlet/ffi/url
import peachlet/identity
import peachlet/notifications
import peachlet/oauth
import peachlet/store
import peachlet/xrpc/context.{type Server, Elsewhere, Value}

@external(javascript, "../../native-auth.mjs", "begin")
fn begin(client: Client, url: String, state: String) -> Bool

@external(javascript, "../../native-auth.mjs", "complete")
pub fn complete(client: Client, state: String, did: String) -> String

@external(javascript, "../../native-auth.mjs", "exchange")
fn exchange(client: Client, body: Js) -> Js

pub fn start(server: Server, ctx: Context) {
  let state = node.random_hex(32)
  use <- context.guard(
    begin(server.settings.store.client, hono.url(ctx), state),
    error.bad_request("Invalid app login request."),
  )
  use parsed <- context.attempt(
    url.parse(hono.url(ctx))
    |> result.replace_error(error.bad_request("Invalid URL.")),
  )
  let query = url.query(parsed)
  let identifier =
    js.call(query, "get", [js.string("identifier")]) |> js.as_string
  let creating =
    js.call(query, "get", [js.string("create")]) |> js.as_string == Some("true")
  use identifier <- context.attempt(case creating {
    True -> Ok(server.settings.signup_provider)
    False -> identity.normalize(identifier)
  })
  let #(key, _) = context.open_session(server, ctx, None)
  store.put(
    server.settings.store,
    "oauth-binding",
    state,
    json.to_string(json.object([#("session", json.string(key))])),
    node.now() + 600_000,
  )
  use authorization <- promise.try_await(
    {
      case creating {
        True -> oauth.create_account(server.settings.oauth, identifier, state)
        False -> oauth.authorize(server.settings.oauth, identifier, state)
      }
    }
    |> promise.map(result.replace_error(
      _,
      error.bad_request("Could not start sign in."),
    )),
  )
  context.done(Ok(Elsewhere(authorization)))
}

pub fn redeem(server: Server, ctx: Context) {
  use body <- promise.try_await(context.read_body(ctx))
  let response = exchange(server.settings.store.client, body)
  use <- context.guard(
    !js.is_nullish(response),
    error.unauthorized("App login expired or invalid. Sign in again."),
  )
  case js.string_field(response, "token") {
    Some(_) -> context.done(Ok(Value(200, response)))
    None ->
      context.done(
        Error(error.unauthorized("App login expired or invalid. Sign in again.")),
      )
  }
}

pub fn revoke_devices(client: Client, key: String) -> Nil {
  notifications.revoke_devices(client, key)
}
