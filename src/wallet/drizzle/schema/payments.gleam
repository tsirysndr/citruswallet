import gleam/dynamic/decode.{type Decoder}
import gleam/option.{type Option}
import wallet/drizzle/orm.{type Column, type Table}

pub type Payments(row) {
  Payments(
    table: Table(row),
    id: Column(String),
    sender_did: Column(String),
    recipient_did: Column(String),
    recipient_label: Column(String),
    chain_id: Column(Int),
    amount_wei: Column(String),
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
    orm.table(
      "payments",
      [
        orm.text("id") |> orm.primary_key,
        orm.text("sender_did") |> orm.not_null,
        orm.text("recipient_did") |> orm.not_null,
        orm.text("recipient_label") |> orm.not_null,
        orm.integer("chain_id") |> orm.not_null,
        orm.text("amount_wei") |> orm.not_null,
        orm.text("state") |> orm.not_null,
        orm.text("source") |> orm.not_null |> orm.default_text("default"),
        orm.text("address"),
        orm.text("fingerprint"),
        orm.integer("revision") |> orm.not_null |> orm.default_int(1),
        orm.text("invitation_hash") |> orm.unique_value,
        orm.integer("created_at") |> orm.not_null,
        orm.integer("expires_at") |> orm.not_null,
        orm.text("attempt_id"),
        orm.text("from_address"),
        orm.integer("nonce"),
        orm.integer("prepared_at"),
        orm.text("tx_hash"),
        orm.text("error"),
      ],
      [
        orm.composite_unique("payments_chain_tx", ["chain_id", "tx_hash"]),
        orm.index("payments_by_sender", [
          orm.asc("sender_did"),
          orm.desc("created_at"),
        ]),
        orm.unique_index("reserved_payment_nonce", [
          orm.asc("chain_id"),
          orm.asc("from_address"),
          orm.asc("nonce"),
        ])
          |> orm.only_where(reserved_while_sending),
      ],
      decoder,
    )
  Payments(
    table: table,
    id: orm.string_column(table, "id"),
    sender_did: orm.string_column(table, "sender_did"),
    recipient_did: orm.string_column(table, "recipient_did"),
    recipient_label: orm.string_column(table, "recipient_label"),
    chain_id: orm.int_column(table, "chain_id"),
    amount_wei: orm.string_column(table, "amount_wei"),
    state: orm.string_column(table, "state"),
    source: orm.string_column(table, "source"),
    address: orm.optional_string_column(table, "address"),
    fingerprint: orm.optional_string_column(table, "fingerprint"),
    revision: orm.int_column(table, "revision"),
    invitation_hash: orm.optional_string_column(table, "invitation_hash"),
    created_at: orm.int_column(table, "created_at"),
    expires_at: orm.int_column(table, "expires_at"),
    attempt_id: orm.optional_string_column(table, "attempt_id"),
    from_address: orm.optional_string_column(table, "from_address"),
    nonce: orm.optional_int_column(table, "nonce"),
    prepared_at: orm.optional_int_column(table, "prepared_at"),
    tx_hash: orm.optional_string_column(table, "tx_hash"),
    error: orm.optional_string_column(table, "error"),
  )
}
