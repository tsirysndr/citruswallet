import citruswallet/error
import citruswallet/ffi/better_sqlite.{type Client}
import citruswallet/ffi/hono.{type Context, type Response}
import citruswallet/ffi/js.{type Js}
import citruswallet/xrpc/context.{type Server, Value}
import gleam/javascript/promise.{type Promise}
import gleam/option

@external(javascript, "../../notifications.mjs", "list")
fn list(client: Client, did: String, chain: Int) -> Js

@external(javascript, "../../notifications.mjs", "markRead")
fn mark(client: Client, did: String, chain: Int, id: String) -> Js

@external(javascript, "../../notifications.mjs", "register")
fn device(client: Client, did: String, key: String, body: Js) -> Bool

@external(javascript, "../../notifications.mjs", "unregister")
fn remove(client: Client, did: String, token: String) -> Js

@external(javascript, "../../notifications.mjs", "stream")
fn stream(
  client: Client,
  ctx: Context,
  did: String,
  key: String,
  chain: Int,
) -> Response

@external(javascript, "../../notifications.mjs", "start")
pub fn start(
  client: Client,
  check: fn(String, String) -> Promise(a),
  chain: Int,
) -> fn() -> Nil

pub fn listing(server: Server, ctx: Context) {
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  context.done(
    Ok(Value(
      200,
      list(server.settings.store.client, did, server.settings.network.chain_id),
    )),
  )
}

pub fn read(server: Server, ctx: Context) {
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  use body <- promise.try_await(context.read_body(ctx))
  context.done(
    Ok(Value(
      200,
      mark(
        server.settings.store.client,
        did,
        server.settings.network.chain_id,
        option.unwrap(js.string_field(body, "id"), ""),
      ),
    )),
  )
}

pub fn register_device(server: Server, ctx: Context) {
  use #(key, did) <- context.attempt(context.authenticated(server, ctx))
  use body <- promise.try_await(context.read_body(ctx))
  use <- context.guard(
    device(server.settings.store.client, did, key, body),
    error.bad_request("Invalid Expo push token or platform."),
  )
  context.done(Ok(Value(200, js.object([#("ok", js.bool(True))]))))
}

pub fn remove_device(server: Server, ctx: Context) {
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  use body <- promise.try_await(context.read_body(ctx))
  context.done(
    Ok(Value(
      200,
      remove(
        server.settings.store.client,
        did,
        option.unwrap(js.string_field(body, "token"), ""),
      ),
    )),
  )
}

pub fn subscribe(server: Server, ctx: Context) -> Promise(Response) {
  promise.resolve(case context.authenticated(server, ctx) {
    Ok(#(key, did)) ->
      stream(
        server.settings.store.client,
        ctx,
        did,
        key,
        server.settings.network.chain_id,
      )
    Error(reason) -> context.refuse(ctx, reason)
  })
}
