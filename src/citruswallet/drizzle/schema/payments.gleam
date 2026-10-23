import citruswallet/drizzle/orm.{
  type Column, type Table, asc, composite_unique, default_int, default_text,
  desc, index, int_column, integer, not_null, only_where, optional_int_column,
  optional_string_column, primary_key, string_column, table as db_table, text,
  unique_index, unique_value,
}
import gleam/dynamic/decode.{type Decoder}
import gleam/option.{type Option}

pub type Payments(row) {
  Payments(
    table: Table(row),
    id: Column(String),
    sender_did: Column(String),
    recipient_did: Column(String),
    recipient_label: Column(String),
    chain_id: Column(Int),
    amount_wei: Column(String),
    description: Column(Option(String)),
    media: Column(Option(String)),
    state: Column(String),
    source: Column(String),
    address: Column(Option(String)),
    fingerprint: Column(Option(String)),
    revision: Column(Int),
    invitation_hash: Column(Option(String)),
    created_at: Column(Int),
    expires_at: Column(Int),
    attempt_id: Column(Option(String)),
    from_address: Column(Option(String)),
    nonce: Column(Option(Int)),
    prepared_at: Column(Option(Int)),
    tx_hash: Column(Option(String)),
    error: Column(Option(String)),
  )
}

const reserved_while_sending =
  "\"state\" IN ('prepared','submitted','confirming','confirmed')"

pub fn define(decoder: Decoder(row)) -> Payments(row) {
  let table =
    db_table(
      "payments",
      [
        text("id") |> primary_key,
        text("sender_did") |> not_null,
        text("recipient_did") |> not_null,
        text("recipient_label") |> not_null,
        integer("chain_id") |> not_null,
        text("amount_wei") |> not_null,
        text("description"),
        text("media"),
        text("state") |> not_null,
        text("source") |> not_null |> default_text("default"),
        text("address"),
        text("fingerprint"),
        integer("revision") |> not_null |> default_int(1),
        text("invitation_hash") |> unique_value,
        integer("created_at") |> not_null,
        integer("expires_at") |> not_null,
        text("attempt_id"),
        text("from_address"),
        integer("nonce"),
        integer("prepared_at"),
        text("tx_hash"),
        text("error"),
      ],
      [
        composite_unique("payments_chain_tx", ["chain_id", "tx_hash"]),
        index("payments_by_sender_chain_time", [
          asc("sender_did"),
          asc("chain_id"),
          desc("created_at"),
          desc("id"),
        ]),
        index("payments_by_sender_chain_state_time", [
          asc("sender_did"),
          asc("chain_id"),
          asc("state"),
          desc("created_at"),
          desc("id"),
        ]),
        index("payments_by_recipient_chain_time", [
          asc("recipient_did"),
          asc("chain_id"),
          desc("created_at"),
          desc("id"),
        ]),
        index("payments_by_recipient_chain_state_time", [
          asc("recipient_did"),
          asc("chain_id"),
          asc("state"),
          desc("created_at"),
          desc("id"),
        ]),
        index("payments_pending_verification", [
          asc("chain_id"),
          asc("created_at"),
        ])
          |> only_where("\"state\" IN ('submitted','confirming')"),
        index("payments_prepared_expiry", [asc("expires_at")])
          |> only_where("\"state\" = 'prepared'"),
        unique_index("reserved_payment_nonce", [
          asc("chain_id"),
          asc("from_address"),
          asc("nonce"),
        ])
          |> only_where(reserved_while_sending),
      ],
      decoder,
    )
  Payments(
    table: table,
    id: string_column(table, "id"),
    sender_did: string_column(table, "sender_did"),
    recipient_did: string_column(table, "recipient_did"),
    recipient_label: string_column(table, "recipient_label"),
    chain_id: int_column(table, "chain_id"),
    amount_wei: string_column(table, "amount_wei"),
    description: optional_string_column(table, "description"),
    media: optional_string_column(table, "media"),
    state: string_column(table, "state"),
    source: string_column(table, "source"),
    address: optional_string_column(table, "address"),
    fingerprint: optional_string_column(table, "fingerprint"),
    revision: int_column(table, "revision"),
    invitation_hash: optional_string_column(table, "invitation_hash"),
    created_at: int_column(table, "created_at"),
    expires_at: int_column(table, "expires_at"),
    attempt_id: optional_string_column(table, "attempt_id"),
    from_address: optional_string_column(table, "from_address"),
    nonce: optional_int_column(table, "nonce"),
    prepared_at: optional_int_column(table, "prepared_at"),
    tx_hash: optional_string_column(table, "tx_hash"),
    error: optional_string_column(table, "error"),
  )
}
