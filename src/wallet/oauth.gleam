import gleam/javascript/promise.{type Promise}
import gleam/option.{None, Some}
import gleam/string
import wallet/ffi/atproto
import wallet/ffi/js.{type Js}
import wallet/ffi/node
import wallet/store.{type Store}

const scope = "atproto"

const state_lifetime = 600_000

const session_lifetime = 86_400_000

pub fn client(store: Store, origin: String) -> atproto.Client {
  atproto.client(
    metadata: metadata(origin),
    states: sessions(store, "oauth-state", state_lifetime),
    sessions: sessions(store, "oauth-session", session_lifetime),
  )
}

fn metadata(origin: String) -> Js {
  let redirect_uri = origin <> "/auth/callback"
  case string.starts_with(origin, "http://127.0.0.1:") {
    True -> atproto.loopback_metadata(redirect_uri, scope)
    False ->
      js.object([
        #("client_id", js.string(origin <> "/client-metadata.json")),
        #("client_name", js.string("AT Protocol Wallet Link")),
        #("client_uri", js.string(origin)),
        #("redirect_uris", js.list([js.string(redirect_uri)])),
        #("scope", js.string(scope)),
        #(
          "grant_types",
          js.list([js.string("authorization_code"), js.string("refresh_token")]),
        ),
        #("response_types", js.list([js.string("code")])),
        #("application_type", js.string("web")),
        #("token_endpoint_auth_method", js.string("none")),
        #("dpop_bound_access_tokens", js.bool(True)),
      ])
  }
}

fn sessions(
  store: Store,
  namespace: String,
  lifetime: Int,
) -> atproto.Sessions {
  atproto.Sessions(
    read: fn(key) {
      promise.resolve(
        case store.get(store, namespace: namespace, key: key, now: node.now()) {
          Some(value) -> parse(value)
          None -> js.undefined()
        },
      )
    },
    write: fn(key, value) {
      store.put(
        store,
        namespace: namespace,
        key: key,
        value: js.stringify(value),
        expires: node.now() + lifetime,
      )
      promise.resolve(Nil)
    },
    forget: fn(key) {
      store.delete(store, namespace: namespace, key: key)
      promise.resolve(Nil)
    },
  )
}

fn parse(value: String) -> Js {
  case js.attempt(fn() { js.parse(value) }) {
    Ok(parsed) -> parsed
    Error(_) -> js.undefined()
  }
}

pub fn forget_session(store: Store, did: String) -> Nil {
  store.delete(store, namespace: "oauth-session", key: did)
}

pub fn authorize(
  client: atproto.Client,
  identifier: String,
  state: String,
) -> Promise(Result(String, js.Exception)) {
  atproto.authorize(client, identifier: identifier, scope: scope, state: state)
}
