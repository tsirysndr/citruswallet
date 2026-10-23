import citruswallet/error
import citruswallet/ffi/better_sqlite.{type Client}
import citruswallet/ffi/hono.{type Context, type Response}
import citruswallet/ffi/js
import citruswallet/notification_worker
import citruswallet/notifications
import citruswallet/web_push
import citruswallet/xrpc/context.{type Server, Value}
import gleam/javascript/promise.{type Promise}
import gleam/option

pub fn listing(server: Server, ctx: Context) {
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  context.done(
    Ok(Value(
      200,
      notifications.listing(
        server.settings.store.client,
        did,
        server.settings.network.chain_id,
      ),
    )),
  )
}

pub fn read(server: Server, ctx: Context) {
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  use body <- promise.try_await(context.read_body(ctx))
  context.done(
    Ok(Value(
      200,
      notifications.mark_read(
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
    notifications.register(server.settings.store.client, did, key, body),
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
      notifications.unregister(
        server.settings.store.client,
        did,
        option.unwrap(js.string_field(body, "token"), ""),
      ),
    )),
  )
}

pub fn subscribe(server: Server, ctx: Context) -> Promise(Response) {
  let selected = context.selected_network(server, ctx)
  promise.resolve(case selected {
    Error(reason) -> context.refuse(ctx, reason)
    Ok(server) ->
      case context.authenticated(server, ctx) {
        Ok(#(key, did)) ->
          notifications.stream(
            server.settings.store.client,
            ctx,
            did,
            key,
            server.settings.network.chain_id,
          )
        Error(reason) -> context.refuse(ctx, reason)
      }
  })
}

pub fn web_settings(server: Server, ctx: Context) {
  use #(_, _) <- context.attempt(context.authenticated(server, ctx))
  context.done(Ok(Value(200, web_push.config(server.settings.store.client))))
}

pub fn register_web(server: Server, ctx: Context) {
  use #(key, did) <- context.attempt(context.authenticated(server, ctx))
  use body <- promise.try_await(context.read_body(ctx))
  use <- context.guard(
    web_push.register(server.settings.store.client, did, key, body),
    error.bad_request("Invalid browser subscription or device limit reached."),
  )
  context.done(Ok(Value(200, js.object([#("ok", js.bool(True))]))))
}

pub fn remove_web(server: Server, ctx: Context) {
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  use body <- promise.try_await(context.read_body(ctx))
  context.done(
    Ok(Value(
      200,
      web_push.unregister(
        server.settings.store.client,
        did,
        option.unwrap(js.string_field(body, "endpoint"), ""),
      ),
    )),
  )
}

pub fn read_all(server: Server, ctx: Context) {
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  context.done(
    Ok(Value(
      200,
      notifications.mark_all_read(
        server.settings.store.client,
        did,
        server.settings.network.chain_id,
      ),
    )),
  )
}

pub fn start(
  client: Client,
  check: fn(String, String) -> Promise(a),
  chain: Int,
) -> fn() -> Nil {
  notification_worker.start(client, check, chain)
}
