import peachlet/directory
import peachlet/error.{type HttpError}
import peachlet/ffi/hono.{type Context}
import peachlet/identity
import peachlet/profiles
import gleam/javascript/promise.{type Promise}
import gleam/json
import gleam/option
import gleam/string

import peachlet/xrpc/context.{type Reply, type Server, Payload}

pub fn suggest_actors(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  // A session, but not a DID: the login field suggests handles before sign-in.
  use _ <- context.attempt(context.browser(server, ctx, create: False))
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
    True -> context.done(Ok(suggested([])))
    False -> {
      use actors <- promise.try_await(server.settings.directory.search(query))
      context.done(Ok(suggested(actors)))
    }
  }
}

pub fn account_profile(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  use actor <- promise.try_await(profiles.refresh(
    server.settings.store,
    server.settings.directory,
    did,
  ))
  context.done(
    Ok(Payload(
      200,
      json.object([
        #("actor", directory.to_json(actor)),
      ]),
    )),
  )
}

pub fn suggested(actors: List(directory.Actor)) -> Reply {
  Payload(
    200,
    json.object([#("actors", json.array(actors, directory.to_json))]),
  )
}
