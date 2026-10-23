import citruswallet/ffi/better_sqlite.{type Client, first, query, run}
import citruswallet/ffi/hono
import citruswallet/ffi/js.{type Js}
import citruswallet/ffi/node
import citruswallet/ffi/notification_transport as transport
import gleam/int
import gleam/list
import gleam/option
import gleam/string

pub fn text(row: Js, key: String) -> String {
  case js.is_nullish(row) {
    True -> ""
    False -> option.unwrap(js.string_field(row, key), "")
  }
}

pub fn number(row: Js, key: String) -> Int {
  case js.is_nullish(row) {
    True -> 0
    False -> option.unwrap(js.int_field(row, key), 0)
  }
}

pub fn ok() -> Js {
  js.object([#("ok", js.bool(True))])
}

pub fn encode(row: Js) -> Js {
  js.object([
    #("id", js.string(int.to_string(number(row, "id")))),
    #("paymentId", js.get(row, "payment_id")),
    #("createdAt", js.string(int.to_string(number(row, "created_at")))),
    #("read", js.bool(!js.is_nullish(js.get(row, "read_at")))),
  ])
}

pub fn listing(db: Client, did: String, chain: Int) -> Js {
  let params = [js.string(did), js.int(chain)]
  let rows =
    query(
      db,
      "SELECT * FROM notifications WHERE did=? AND chain_id=? ORDER BY id DESC LIMIT 50",
      params,
    )
  let unread =
    first(
      db,
      "SELECT count(*) AS count FROM notifications WHERE did=? AND chain_id=? AND read_at IS NULL",
      params,
    )
  js.object([
    #("notifications", js.list(list.map(rows, encode))),
    #("unread", js.int(number(unread, "count"))),
  ])
}

pub fn mark_read(db: Client, did: String, chain: Int, id: String) -> Js {
  let _ =
    run(
      db,
      "UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE did=? AND chain_id=? AND id=?",
      [js.int(node.now()), js.string(did), js.int(chain), js.string(id)],
    )
  ok()
}

pub fn mark_all_read(db: Client, did: String, chain: Int) -> Js {
  let _ =
    run(
      db,
      "UPDATE notifications SET read_at=? WHERE did=? AND chain_id=? AND read_at IS NULL",
      [js.int(node.now()), js.string(did), js.int(chain)],
    )
  ok()
}

pub fn url_safe(value: String) -> Bool {
  !string.is_empty(value)
  && list.all(string.to_graphemes(value), fn(c) {
    string.contains(
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-",
      c,
    )
  })
}

pub fn valid_expo_token(token: String) -> Bool {
  let prefix = case string.starts_with(token, "ExpoPushToken[") {
    True -> 14
    False -> 18
  }
  {
    string.starts_with(token, "ExpoPushToken[")
    || string.starts_with(token, "ExponentPushToken[")
  }
  && string.ends_with(token, "]")
  && string.length(token) <= 256
  && url_safe(string.slice(token, prefix, string.length(token) - prefix - 1))
}

pub fn register(db: Client, did: String, key: String, body: Js) -> Bool {
  let token = text(body, "token")
  let platform = text(body, "platform")
  case valid_expo_token(token) && list.contains(["android", "ios"], platform) {
    False -> False
    True -> {
      let _ =
        run(
          db,
          "INSERT INTO push_devices(token,did,session_key,platform,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(token) DO UPDATE SET did=excluded.did,session_key=excluded.session_key,platform=excluded.platform,created_at=CASE WHEN push_devices.did=excluded.did THEN push_devices.created_at ELSE excluded.created_at END,updated_at=excluded.updated_at",
          [
            js.string(token),
            js.string(did),
            js.string(key),
            js.string(platform),
            js.int(node.now()),
            js.int(node.now()),
          ],
        )
      True
    }
  }
}

pub fn unregister(db: Client, did: String, token: String) -> Js {
  let _ =
    run(db, "DELETE FROM push_devices WHERE did=? AND token=?", [
      js.string(did),
      js.string(token),
    ])
  ok()
}

pub fn stream(db: Client, ctx: Js, did: String, key: String, chain: Int) -> Js {
  let raw =
    option.unwrap(
      hono.header(ctx, "last-event-id"),
      option.unwrap(hono.query_parameter(ctx, "cursor"), "0"),
    )
  let valid =
    !string.is_empty(raw)
    && string.length(raw) <= 15
    && list.all(string.to_graphemes(raw), fn(c) {
      string.contains("0123456789", c)
    })
  case valid {
    False ->
      js.call(ctx, "json", [
        js.object([
          #("error", js.string("InvalidRequest")),
          #("message", js.string("Invalid notification cursor.")),
        ]),
        js.int(400),
      ])
    True -> {
      let cursor = js.cell(js.string(raw))
      transport.stream(ctx, key, 4, fn() {
        let session =
          first(
            db,
            "SELECT 1 FROM kv WHERE namespace IN ('browser','native-session') AND key=? AND expires>? AND json_extract(value,'$.did')=?",
            [js.string(key), js.int(node.now()), js.string(did)],
          )
        case js.is_nullish(session) {
          True -> js.object([#("expired", js.bool(True))])
          False -> {
            let rows =
              query(
                db,
                "SELECT * FROM notifications WHERE did=? AND chain_id=? AND id>? ORDER BY id LIMIT 100",
                [js.string(did), js.int(chain), js.cell_get(cursor)],
              )
            let events =
              list.map(rows, fn(row) {
                let id = js.string(int.to_string(number(row, "id")))
                js.cell_set(cursor, id)
                js.object([
                  #("event", js.string("payment-received")),
                  #("id", id),
                  #("data", js.string(js.stringify(encode(row)))),
                ])
              })
            js.object([
              #("expired", js.bool(False)),
              #("events", js.list(events)),
            ])
          }
        }
      })
    }
  }
}

pub fn field(row: Js, key: String) -> Js {
  case js.is_nullish(row) {
    True -> js.null()
    False -> js.get(row, key)
  }
}

pub fn revoke_devices(db: Client, key: String) -> Nil {
  let _ =
    run(db, "DELETE FROM push_devices WHERE session_key=?", [js.string(key)])
  Nil
}
