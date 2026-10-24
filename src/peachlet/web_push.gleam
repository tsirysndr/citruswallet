import gleam/javascript/promise.{type Promise}
import gleam/option.{Some}
import gleam/string
import peachlet/ffi/better_sqlite.{type Client, first, run}
import peachlet/ffi/js.{type Js}
import peachlet/ffi/node
import peachlet/ffi/notification_transport as transport
import peachlet/notifications.{number, text}

pub fn vapid(db: Client) -> Js {
  case
    node.environment("WEB_PUSH_PUBLIC_KEY"),
    node.environment("WEB_PUSH_PRIVATE_KEY")
  {
    Some(public), Some(private) ->
      js.object([
        #("publicKey", js.string(public)),
        #("privateKey", js.string(private)),
      ])
    _, _ -> {
      let row =
        first(
          db,
          "SELECT value FROM kv WHERE namespace='web-push-config' AND key='vapid'",
          [],
        )
      case js.is_nullish(row) {
        False -> js.parse(text(row, "value"))
        True -> {
          let _ =
            run(
              db,
              "INSERT OR IGNORE INTO kv(namespace,key,value,expires) VALUES('web-push-config','vapid',?,9007199254740991)",
              [js.string(js.stringify(transport.generate_keys()))],
            )
          js.parse(text(
            first(
              db,
              "SELECT value FROM kv WHERE namespace='web-push-config' AND key='vapid'",
              [],
            ),
            "value",
          ))
        }
      }
    }
  }
}

pub fn config(db: Client) -> Js {
  js.object([#("publicKey", js.get(vapid(db), "publicKey"))])
}

pub fn subscription_id(endpoint: String) -> String {
  "web:" <> node.sha256(endpoint)
}

pub fn valid_subscription(body: Js) -> Bool {
  let endpoint = text(body, "endpoint")
  let public_key = text(body, "p256dh")
  let auth = text(body, "auth")
  case
    js.attempt(fn() { js.construct(js.global("URL"), [js.string(endpoint)]) })
  {
    Error(_) -> False
    Ok(url) -> {
      let host = text(url, "hostname")
      text(url, "protocol") == "https:"
      && text(url, "port") == ""
      && text(url, "username") == ""
      && text(url, "password") == ""
      && text(url, "hash") == ""
      && string.length(endpoint) <= 2048
      && {
        host == "fcm.googleapis.com"
        || host == "updates.push.services.mozilla.com"
        || string.ends_with(host, ".push.services.mozilla.com")
        || host == "web.push.apple.com"
      }
      && string.length(public_key) == 87
      && notifications.url_safe(public_key)
      && transport.valid_public_key(public_key)
      && string.length(auth) == 22
      && notifications.url_safe(auth)
    }
  }
}

pub fn register(db: Client, did: String, session: String, body: Js) -> Bool {
  case valid_subscription(body) {
    False -> False
    True -> {
      let token = subscription_id(text(body, "endpoint"))
      let count =
        first(
          db,
          "SELECT count(*) AS n FROM push_devices WHERE did=? AND token<>?",
          [js.string(did), js.string(token)],
        )
      case number(count, "n") >= 20 {
        True -> False
        False -> {
          let subscription =
            js.object([
              #("endpoint", js.get(body, "endpoint")),
              #(
                "keys",
                js.object([
                  #("p256dh", js.get(body, "p256dh")),
                  #("auth", js.get(body, "auth")),
                ]),
              ),
            ])
          let _ =
            run(
              db,
              "INSERT INTO push_devices(token,did,session_key,platform,subscription,created_at,updated_at) VALUES(?,?,?,'web',?,?,?) ON CONFLICT(token) DO UPDATE SET did=excluded.did,session_key=excluded.session_key,subscription=excluded.subscription,created_at=CASE WHEN push_devices.did=excluded.did THEN push_devices.created_at ELSE excluded.created_at END,updated_at=excluded.updated_at",
              [
                js.string(token),
                js.string(did),
                js.string(session),
                js.string(js.stringify(subscription)),
                js.int(node.now()),
                js.int(node.now()),
              ],
            )
          True
        }
      }
    }
  }
}

pub fn unregister(db: Client, did: String, endpoint: String) -> Js {
  notifications.unregister(db, did, subscription_id(endpoint))
}

pub fn send(db: Client, subscription: String, payload: Js) -> Promise(Js) {
  let parsed = js.parse(subscription)
  let keys = js.get(parsed, "keys")
  let body =
    js.object([
      #("endpoint", js.get(parsed, "endpoint")),
      #("p256dh", js.get(keys, "p256dh")),
      #("auth", js.get(keys, "auth")),
    ])
  case valid_subscription(body) {
    False ->
      promise.resolve(
        js.object([
          #("ok", js.bool(False)),
          #("status", js.int(410)),
          #("message", js.string("Invalid subscription")),
        ]),
      )
    True -> {
      let keys = vapid(db)
      let options =
        js.object([
          #(
            "vapidDetails",
            js.object([
              #("subject", js.string("mailto:contact@peachlet.app")),
              #("publicKey", js.get(keys, "publicKey")),
              #("privateKey", js.get(keys, "privateKey")),
            ]),
          ),
          #("TTL", js.int(86_400)),
          #("urgency", js.string("high")),
          #("timeout", js.int(15_000)),
        ])
      transport.invoke(
        js.coerce(transport.send_web),
        js.list([parsed, js.string(js.stringify(payload)), options]),
      )
    }
  }
}
