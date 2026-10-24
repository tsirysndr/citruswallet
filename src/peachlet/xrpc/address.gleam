import gleam/bool
import gleam/javascript/promise.{type Promise}
import gleam/json
import gleam/option.{None, Some}
import gleam/result
import gleam/string
import peachlet/address_records
import peachlet/error.{type HttpError}
import peachlet/ffi/hono.{type Context}
import peachlet/ffi/js.{type Js}
import peachlet/identity
import peachlet/linking

import peachlet/xrpc/context.{type Reply, type Server, Payload}

pub fn create_challenge(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(context.read_body(ctx))
  use #(key, did) <- context.attempt(context.authenticated(server, ctx))
  use discoverable <- context.attempt(discoverable(body))
  use challenge <- context.attempt(linking.create(
    server.links,
    session: key,
    did: did,
    address: js.string_field(body, "address"),
    discoverable: discoverable,
  ))
  context.done(
    Ok(Payload(
      200,
      linking.challenge_to_json(challenge, server.settings.network.chain_id),
    )),
  )
}

pub fn discoverable(body: Js) -> Result(Bool, HttpError) {
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

pub fn verify_challenge(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(context.read_body(ctx))
  use #(key, did) <- context.attempt(context.authenticated(server, ctx))
  use links <- promise.try_await(linking.verify(
    server.links,
    session: key,
    did: did,
    id: js.string_field(body, "id"),
    signature: js.string_field(body, "signature"),
  ))
  use _ <- promise.await(
    address_records.sync(
      server.settings.store.client,
      server.settings.oauth,
      did,
      linking.proof_matches_origin(_, server.links.origin),
    ),
  )
  context.done(Ok(linked_status(server, did, links)))
}

pub fn unlink_wallet(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  use _ <- context.attempt(linking.unlink(
    server.links,
    did,
    option.unwrap(hono.parameter(ctx, "address"), ""),
  ))
  use _ <- promise.await(
    address_records.sync(
      server.settings.store.client,
      server.settings.oauth,
      did,
      linking.proof_matches_origin(_, server.links.origin),
    ),
  )
  context.done(
    Ok(linked_status(
      server,
      did,
      linking.list(server.links, did, public_only: False),
    )),
  )
}

pub fn choose_default(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(context.read_body(ctx))
  context.done({
    use #(_, did) <- result.try(context.authenticated(server, ctx))
    use links <- result.map(linking.set_default(
      server.links,
      did,
      js.string_field(body, "address"),
    ))
    linked(server, links)
  })
}

pub fn linked_status(
  server: Server,
  did: String,
  links: List(linking.Link),
) -> Reply {
  Payload(
    200,
    json.object([
      #("links", json.array(links, linking.to_json(_, server.links.origin))),
      #(
        "addressSyncPending",
        json.bool(address_records.pending(server.settings.store.client, did)),
      ),
    ]),
  )
}

pub fn sync_addresses(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  use _ <- promise.await(
    address_records.sync(
      server.settings.store.client,
      server.settings.oauth,
      did,
      linking.proof_matches_origin(_, server.links.origin),
    ),
  )
  context.done(
    Ok(Payload(
      200,
      json.object([
        #(
          "addressSyncPending",
          json.bool(address_records.pending(server.settings.store.client, did)),
        ),
      ]),
    )),
  )
}

pub fn linked(server: Server, links: List(linking.Link)) -> Reply {
  Payload(
    200,
    json.object([
      #("links", json.array(links, linking.to_json(_, server.links.origin))),
    ]),
  )
}

pub fn public_links(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  context.done({
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
            linking.to_json(_, server.links.origin),
          ),
        ),
      ]),
    ))
  })
}
