import gleam/javascript/promise.{type Promise}
import gleam/option.{type Option}
import peachlet/ffi/js.{type Exception, type Js}

@external(javascript, "@atproto/syntax", "isValidHandle")
pub fn is_valid_handle(handle: String) -> Bool

@external(javascript, "@atproto/syntax", "isValidDid")
pub fn is_valid_did(did: String) -> Bool

pub type Resolver =
  Js

pub type AtprotoData {
  AtprotoData(did: String, handle: Option(String))
}

@external(javascript, "@atproto/identity", "IdResolver")
fn id_resolver_class() -> Js

pub fn resolver(timeout_ms: Int) -> Resolver {
  js.construct(js.coerce(id_resolver_class), [
    js.object([#("timeout", js.int(timeout_ms))]),
  ])
}

pub fn resolve_handle(
  resolver: Resolver,
  handle: String,
) -> Promise(Result(Option(String), Exception)) {
  let settled =
    js.attempt_promise(
      js.call(js.get(resolver, "handle"), "resolve", [
        js.string(handle),
      ]),
    )
  promise.map(settled, fn(outcome) {
    case outcome {
      Ok(value) -> Ok(js.as_string(value))
      Error(reason) -> Error(reason)
    }
  })
}

pub fn resolve_atproto_data(
  resolver: Resolver,
  did: String,
  fresh fresh: Bool,
) -> Promise(Result(AtprotoData, Exception)) {
  let settled =
    js.attempt_promise(
      js.call(js.get(resolver, "did"), "resolveAtprotoData", [
        js.string(did),
        js.bool(fresh),
      ]),
    )
  promise.map(settled, fn(outcome) {
    case outcome {
      Error(reason) -> Error(reason)
      Ok(data) ->
        case js.string_field(data, "did") {
          option.Some(did) ->
            Ok(AtprotoData(did: did, handle: js.string_field(data, "handle")))
          option.None ->
            Error(js.Exception(
              name: "DidDocumentError",
              message: "DID document did not name a DID.",
            ))
        }
    }
  })
}

pub type Client =
  Js

pub type Sessions {
  Sessions(
    read: fn(String) -> Promise(Js),
    write: fn(String, Js) -> Promise(Nil),
    forget: fn(String) -> Promise(Nil),
  )
}

pub type Callback {
  Callback(did: String, state: Option(String))
}

@external(javascript, "@atproto/oauth-client-node", "NodeOAuthClient")
fn node_oauth_client_class() -> Js

@external(javascript, "@atproto/oauth-client-node", "buildAtprotoLoopbackClientMetadata")
fn build_loopback_metadata(options: Js) -> Js

pub fn loopback_metadata(redirect_uri: String, scope: String) -> Js {
  build_loopback_metadata(
    js.object([
      #("scope", js.string(scope)),
      #("redirect_uris", js.list([js.string(redirect_uri)])),
    ]),
  )
}

/// Single-process session refresh locking, matching the systemd deployment.
@external(javascript, "@atproto/oauth-client", "requestLocalLock")
fn request_local_lock(
  name: String,
  operation: fn() -> Promise(Js),
) -> Promise(Js)

pub fn client(
  metadata metadata: Js,
  states states: Sessions,
  sessions sessions: Sessions,
) -> Client {
  js.construct(js.coerce(node_oauth_client_class), [
    js.object([
      #("clientMetadata", metadata),
      #("requestLock", js.coerce(request_local_lock)),
      #("stateStore", store(states)),
      #("sessionStore", store(sessions)),
    ]),
  ])
}

fn store(sessions: Sessions) -> Js {
  js.object([
    #("get", js.coerce(sessions.read)),
    #("set", js.coerce(sessions.write)),
    #("del", js.coerce(sessions.forget)),
  ])
}

pub fn client_metadata(client: Client) -> Js {
  js.get(client, "clientMetadata")
}

pub fn authorize(
  client: Client,
  identifier identifier: String,
  scope scope: String,
  state state: String,
  prompt prompt: Option(String),
) -> Promise(Result(String, Exception)) {
  let options = [
    #("scope", js.string(scope)),
    #("state", js.string(state)),
  ]
  let settled =
    js.attempt_promise(
      js.call(client, "authorize", [
        js.string(identifier),
        js.object(case prompt {
          option.Some(prompt) -> [#("prompt", js.string(prompt)), ..options]
          option.None -> options
        }),
      ]),
    )
  promise.map(settled, fn(outcome) {
    case outcome {
      Error(reason) -> Error(reason)
      Ok(url) -> Ok(js.coerce(js.call(url, "toString", [])))
    }
  })
}

pub fn callback(
  client: Client,
  query: Js,
) -> Promise(Result(Callback, Exception)) {
  let settled = js.attempt_promise(js.call(client, "callback", [query]))
  promise.map(settled, fn(outcome) {
    case outcome {
      Error(reason) -> Error(reason)
      Ok(result) ->
        case js.string_field(js.get(result, "session"), "did") {
          option.Some(did) ->
            Ok(Callback(did: did, state: js.string_field(result, "state")))
          option.None ->
            Error(js.Exception(
              name: "OAuthCallbackError",
              message: "Callback returned no session DID.",
            ))
        }
    }
  })
}
