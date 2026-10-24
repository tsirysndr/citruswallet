import gleam/dynamic/decode
import gleam/javascript/promise.{type Promise}
import gleam/json
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import peachlet/address_records
import peachlet/error.{type HttpError, HttpError}
import peachlet/ffi/atproto
import peachlet/ffi/hono.{type Context}
import peachlet/ffi/js
import peachlet/ffi/node
import peachlet/ffi/url
import peachlet/identity
import peachlet/linking
import peachlet/network
import peachlet/oauth
import peachlet/profiles
import peachlet/store
import peachlet/xrpc/native

import peachlet/xrpc/context.{type Reply, type Server, Elsewhere, Payload, Value}

const binding_lifetime = 600_000

pub fn client_metadata(
  server: Server,
  _ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  context.done(Ok(Value(200, atproto.client_metadata(server.settings.oauth))))
}

pub fn current_session(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  context.done({
    use #(_, session) <- result.map(context.browser(server, ctx, create: True))
    Payload(
      200,
      json.object([
        #("network", network.to_json(server.settings.network)),
        #("paymentsEnabled", json.bool(server.settings.chain != None)),
        #("did", json.nullable(session.did, json.string)),
        #("csrf", json.string(session.csrf)),
        #(
          "addressSyncPending",
          json.bool(case session.did {
            Some(did) ->
              address_records.pending(server.settings.store.client, did)
            None -> False
          }),
        ),
        #("links", case session.did {
          Some(did) ->
            json.array(
              linking.list(server.links, did, public_only: False),
              linking.to_json(_, server.links.origin),
            )
          None -> json.preprocessed_array([])
        }),
      ]),
    )
  })
}

pub fn start_login(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(context.read_body(ctx))
  use #(key, _) <- context.attempt(context.browser(server, ctx, create: False))
  let creating = js.as_bool(js.get(body, "create")) == Some(True)
  use identifier <- context.attempt(case creating {
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
  context.done(case outcome {
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

pub fn finish_login(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use #(key, _) <- context.attempt(context.browser(server, ctx, create: False))
  use query <- context.attempt(
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
  use binding <- context.attempt(option.to_result(
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
  use <- context.guard(node.secure_equal(session, key), wrong_browser())
  use _ <- promise.try_await(profiles.refresh(
    server.settings.store,
    server.settings.directory,
    callback.did,
  ))
  store.delete(server.settings.store, namespace: "oauth-binding", key: state)
  store.delete(server.settings.store, namespace: "browser", key: key)
  store.forget_challenges(server.settings.store, key)
  let _ = context.open_session(server, ctx, Some(callback.did))
  // Backfill existing public links only after the user grants repository scope.
  list.each(
    linking.list(server.links, callback.did, public_only: True),
    fn(link) {
      case
        linking.proof_matches_origin(link.message, server.links.origin)
        && address_records.needs_publication(
          server.settings.store.client,
          link.did,
          link.chain_id,
          link.address,
        )
      {
        False -> Nil
        True ->
          address_records.queue_verified(
            server.settings.store.client,
            link.did,
            link.chain_id,
            link.address,
            True,
            link.message,
            link.signature,
            link.linked_at,
          )
      }
    },
  )
  use _ <- promise.await(
    address_records.sync(
      server.settings.store.client,
      server.settings.oauth,
      callback.did,
      linking.proof_matches_origin(_, server.links.origin),
    ),
  )
  context.done(
    Ok(
      Elsewhere(native.complete(
        server.settings.store.client,
        state,
        callback.did,
      )),
    ),
  )
}

pub fn expired_login() -> HttpError {
  error.bad_request(
    "AT Protocol login failed or expired. Return to the home page and try again.",
  )
}

pub fn wrong_browser() -> HttpError {
  error.forbidden("Login belongs to a different browser session. Start again.")
}

pub fn logout(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  context.done({
    use #(key, session) <- result.map(context.browser(
      server,
      ctx,
      create: False,
    ))
    case session.did {
      Some(did) -> oauth.forget_session(server.settings.store, did)
      None -> Nil
    }
    store.delete(server.settings.store, namespace: "browser", key: key)
    store.delete(server.settings.store, namespace: "native-session", key: key)
    native.revoke_devices(server.settings.store.client, key)
    store.forget_challenges(server.settings.store, key)
    hono.clear(ctx, server.cookie_name, server.cookie)
    Payload(200, json.object([#("ok", json.bool(True))]))
  })
}

pub fn decode_binding(value: String) -> Option(String) {
  option.from_result(json.parse(value, decode.at(["session"], decode.string)))
}
