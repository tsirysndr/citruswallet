import gleam/dynamic/decode
import peachlet/drizzle/orm.{
  asc, composite_primary_key, default_text, index, integer, not_null,
  primary_key, table, text, unique_index,
}

pub fn notifications() {
  table(
    "notifications",
    [
      integer("id") |> primary_key |> not_null,
      text("did") |> not_null,
      text("payment_id") |> not_null,
      integer("chain_id") |> not_null,
      // Why this notification exists. Rows written before this column existed
      // are all incoming payments, which is what the default records.
      text("kind") |> not_null |> default_text("payment_received"),
      integer("created_at") |> not_null,
      integer("read_at"),
    ],
    [
      unique_index("notification_payment_recipient", [
        asc("payment_id"),
        asc("did"),
      ]),
      index("notifications_recent", [asc("created_at")]),
      index("notifications_owner_cursor", [
        asc("did"),
        asc("chain_id"),
        asc("id"),
      ]),
      index("notifications_owner_unread", [
        asc("did"),
        asc("chain_id"),
        asc("read_at"),
      ]),
    ],
    decode.success(Nil),
  )
}

pub fn push_devices() {
  table(
    "push_devices",
    [
      text("token") |> primary_key |> not_null,
      text("did") |> not_null,
      text("session_key") |> not_null,
      text("platform") |> not_null,
      text("subscription"),
      integer("created_at") |> not_null,
      integer("updated_at") |> not_null,
    ],
    [
      index("push_devices_owner", [asc("did")]),
      index("push_devices_session", [asc("session_key")]),
    ],
    decode.success(Nil),
  )
}

pub fn push_deliveries() {
  table(
    "push_deliveries",
    [
      integer("notification_id") |> not_null,
      text("token") |> not_null,
      text("state") |> not_null,
      integer("attempts") |> not_null,
      integer("next_at") |> not_null,
      text("ticket"),
      text("error"),
    ],
    [
      composite_primary_key(["notification_id", "token"]),
      index("push_delivery_due", [asc("state"), asc("next_at")]),
    ],
    decode.success(Nil),
  )
}
