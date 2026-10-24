import gleam/int
import gleam/javascript/promise.{type Promise}
import gleam/list
import gleam/option.{Some}
import gleam/string
import peachlet/ffi/better_sqlite.{type Client, query, run}
import peachlet/ffi/js.{type Js}
import peachlet/ffi/node
import peachlet/ffi/notification_transport as transport
import peachlet/notifications.{number, text}
import peachlet/web_push

pub fn retry_delay(attempts: Int) -> Int {
  case attempts >= 10 {
    True -> 3_600_000
    False -> int.min(3_600_000, 5000 * power_two(attempts))
  }
}

fn power_two(n: Int) -> Int {
  case n <= 0 {
    True -> 1
    False -> 2 * power_two(n - 1)
  }
}

pub fn retry_state(attempts: Int, receipt: Bool) -> String {
  case attempts >= 8, receipt {
    True, _ -> "failed"
    False, True -> "receipt"
    False, False -> "pending"
  }
}

fn update_job(db: Client, job: Js, state: String, error: String, next: Int) {
  let _ =
    run(
      db,
      "UPDATE push_deliveries SET state=?,error=?,next_at=? WHERE notification_id=? AND token=?",
      [
        js.string(state),
        js.string(string.slice(error, 0, 200)),
        js.int(next),
        notifications.field(job, "notification_id"),
        notifications.field(job, "token"),
      ],
    )
  Nil
}

fn failure(db: Client, job: Js, message: String, now: Int) {
  let attempts = number(job, "attempts") + 1
  let receipt = text(job, "state") == "receipt"
  update_job(
    db,
    job,
    retry_state(attempts, receipt),
    message,
    now
      + case receipt {
      True -> 900_000
      False -> retry_delay(attempts)
    },
  )
}

fn expire(db: Client, job: Js) {
  let _ =
    run(db, "DELETE FROM push_devices WHERE token=?", [
      notifications.field(job, "token"),
    ])
  update_job(db, job, "failed", "Subscription expired", node.now())
}

fn payload(job: Js) -> Js {
  js.object([
    #(
      "notificationId",
      js.string(int.to_string(number(job, "notification_id"))),
    ),
    #("paymentId", notifications.field(job, "payment_id")),
    #("chainId", notifications.field(job, "chain_id")),
  ])
}

pub fn deliver(
  db: Client,
  send: Js,
  now: Int,
  web_send: fn(Client, String, Js) -> Promise(Js),
) -> Promise(Nil) {
  let _ =
    run(
      db,
      "INSERT OR IGNORE INTO push_deliveries(notification_id,token,state,attempts,next_at) SELECT n.id,d.token,'pending',0,? FROM notifications n JOIN push_devices d ON d.did=n.did WHERE n.created_at>=d.created_at AND n.created_at>? AND n.read_at IS NULL",
      [js.int(now), js.int(now - 604_800_000)],
    )
  let jobs =
    query(
      db,
      "SELECT j.*,n.did,n.payment_id,n.chain_id,d.platform,d.subscription FROM push_deliveries j JOIN notifications n ON n.id=j.notification_id JOIN push_devices d ON d.token=j.token AND d.did=n.did WHERE n.created_at>=d.created_at AND j.state IN ('pending','sending','receipt') AND j.next_at<=? ORDER BY j.next_at LIMIT 50",
      [js.int(now)],
    )
  deliver_jobs(db, jobs, send, web_send, now)
}

fn deliver_jobs(
  db: Client,
  jobs: List(Js),
  send: Js,
  web_send: fn(Client, String, Js) -> Promise(Js),
  now: Int,
) -> Promise(Nil) {
  case jobs {
    [] -> promise.resolve(Nil)
    [job, ..rest] -> {
      let claimed =
        run(
          db,
          "UPDATE push_deliveries SET next_at=?,attempts=attempts+1,state=? WHERE notification_id=? AND token=? AND next_at<=?",
          [
            js.int(node.now() + 60_000),
            js.string(case text(job, "state") == "receipt" {
              True -> "receipt"
              False -> "sending"
            }),
            notifications.field(job, "notification_id"),
            notifications.field(job, "token"),
            js.int(now),
          ],
        )
      use _ <- promise.await(case claimed > 0 {
        False -> promise.resolve(Nil)
        True -> deliver_job(db, job, send, web_send, now)
      })
      deliver_jobs(db, rest, send, web_send, now)
    }
  }
}

fn deliver_job(
  db: Client,
  job: Js,
  send: Js,
  web_send: fn(Client, String, Js) -> Promise(Js),
  now: Int,
) -> Promise(Nil) {
  case text(job, "platform") == "web" {
    True -> {
      use outcome <- promise.await(web_send(
        db,
        text(job, "subscription"),
        payload(job),
      ))
      case js.as_bool(notifications.field(outcome, "ok")) {
        Some(True) -> {
          let _ =
            run(
              db,
              "UPDATE push_deliveries SET state='delivered',error=NULL WHERE notification_id=? AND token=?",
              [
                notifications.field(job, "notification_id"),
                notifications.field(job, "token"),
              ],
            )
          Nil
        }
        _ ->
          case list.contains([404, 410], number(outcome, "status")) {
            True -> expire(db, job)
            False -> failure(db, job, text(outcome, "message"), now)
          }
      }
      promise.resolve(Nil)
    }
    False -> expo(db, job, send, now)
  }
}

fn expo(db: Client, job: Js, send: Js, now: Int) -> Promise(Nil) {
  let receipt = text(job, "state") == "receipt"
  let endpoint =
    "https://exp.host/--/api/v2/push/"
    <> case receipt {
      True -> "getReceipts"
      False -> "send"
    }
  let body = case receipt {
    True -> js.object([#("ids", js.list([notifications.field(job, "ticket")]))])
    False ->
      js.object([
        #("to", notifications.field(job, "token")),
        #("title", js.string("Payment received")),
        #("body", js.string("Open Peachlet to view your payment.")),
        #("sound", js.string("default")),
        #("channelId", js.string("payments")),
        #("data", payload(job)),
      ])
  }
  let headers = [
    #("Content-Type", js.string("application/json")),
    ..case node.environment("EXPO_ACCESS_TOKEN") {
      Some(token) -> [#("Authorization", js.string("Bearer " <> token))]
      _ -> []
    }
  ]
  let options =
    js.object([
      #("method", js.string("POST")),
      #(
        "signal",
        js.call(js.global("AbortSignal"), "timeout", [js.int(15_000)]),
      ),
      #("headers", js.object(headers)),
      #("body", js.string(js.stringify(body))),
    ])
  use outcome <- promise.await(transport.invoke(
    send,
    js.list([js.string(endpoint), options]),
  ))
  case js.as_bool(notifications.field(outcome, "ok")) {
    Some(True) -> {
      let response = notifications.field(outcome, "value")
      case js.as_bool(notifications.field(response, "ok")) {
        Some(True) -> {
          use parsed <- promise.await(
            js.attempt_promise(js.call(response, "json", [])),
          )
          case parsed {
            Error(_) -> failure(db, job, "Invalid Expo response", now)
            Ok(data) -> handle_ticket(db, job, data, now)
          }
          promise.resolve(Nil)
        }
        _ -> {
          failure(
            db,
            job,
            "Expo HTTP " <> int.to_string(number(response, "status")),
            now,
          )
          promise.resolve(Nil)
        }
      }
    }
    _ -> {
      failure(db, job, text(outcome, "message"), now)
      promise.resolve(Nil)
    }
  }
}

fn handle_ticket(db: Client, job: Js, data: Js, now: Int) {
  let receipt = text(job, "state") == "receipt"
  let ticket = case receipt {
    True ->
      notifications.field(
        notifications.field(data, "data"),
        text(job, "ticket"),
      )
    False -> notifications.field(data, "data")
  }
  case js.is_nullish(ticket) {
    True -> failure(db, job, "Missing Expo receipt", now)
    False ->
      case text(ticket, "status") {
        "error" -> {
          let error = text(notifications.field(ticket, "details"), "error")
          case error == "DeviceNotRegistered" {
            True -> expire(db, job)
            False -> failure(db, job, error, now)
          }
        }
        "ok" ->
          case receipt || !string.is_empty(text(ticket, "id")) {
            False -> failure(db, job, "Invalid Expo response", now)
            True -> {
              let _ =
                run(
                  db,
                  "UPDATE push_deliveries SET state=?,ticket=?,error=NULL,next_at=? WHERE notification_id=? AND token=?",
                  [
                    js.string(case receipt {
                      True -> "delivered"
                      False -> "receipt"
                    }),
                    case receipt {
                      True -> notifications.field(job, "ticket")
                      False -> notifications.field(ticket, "id")
                    },
                    js.int(now + 900_000),
                    notifications.field(job, "notification_id"),
                    notifications.field(job, "token"),
                  ],
                )
              Nil
            }
          }
        _ -> failure(db, job, "Invalid Expo response", now)
      }
  }
}

pub fn start(
  db: Client,
  check: fn(String, String) -> Promise(a),
  chain: Int,
) -> fn() -> Nil {
  let stop =
    transport.every(5000, fn(stopped) {
      let payments =
        query(
          db,
          "SELECT p.id,p.sender_did FROM payments p LEFT JOIN kv k ON k.namespace='payment-check' AND k.key=p.id WHERE p.chain_id=? AND p.state IN ('submitted','confirming') ORDER BY COALESCE(CAST(k.value AS INTEGER),0),p.created_at LIMIT 10",
          [js.int(chain)],
        )
      use _ <- promise.await(check_payments(db, payments, check, stopped))
      case stopped() {
        True -> promise.resolve(Nil)
        False -> deliver(db, js.global("fetch"), node.now(), web_push.send)
      }
    })
  fn() {
    stop()
    transport.close_streams()
  }
}

fn check_payments(
  db: Client,
  payments: List(Js),
  check: fn(String, String) -> Promise(a),
  stopped: fn() -> Bool,
) -> Promise(Nil) {
  case payments, stopped() {
    [], _ | _, True -> promise.resolve(Nil)
    [payment, ..rest], False -> {
      let _ =
        run(
          db,
          "INSERT INTO kv(namespace,key,value,expires) VALUES('payment-check',?,?,?) ON CONFLICT(namespace,key) DO UPDATE SET value=excluded.value,expires=excluded.expires",
          [
            notifications.field(payment, "id"),
            js.string(int.to_string(node.now())),
            js.int(node.now() + 604_800_000),
          ],
        )
      use _ <- promise.await(check(
        text(payment, "id"),
        text(payment, "sender_did"),
      ))
      check_payments(db, rest, check, stopped)
    }
  }
}
