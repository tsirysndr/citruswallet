import citruswallet/drizzle/orm.{
  type Column, type Table, asc, bool_column, composite_primary_key,
  composite_unique, default_int, desc, index, int_column, integer, not_null,
  only_where, string_column, table as db_table, text, unique_index,
}
import gleam/dynamic/decode.{type Decoder}

pub type Links(row) {
  Links(
    table: Table(row),
    did: Column(String),
    address: Column(String),
    chain_id: Column(Int),
    message: Column(String),
    signature: Column(String),
    linked_at: Column(String),
    is_public: Column(Bool),
    is_default: Column(Bool),
  )
}

pub fn define(decoder: Decoder(row)) -> Links(row) {
  let table =
    db_table(
      "links",
      [
        text("did") |> not_null,
        text("address") |> not_null,
        integer("chain_id") |> not_null,
        text("message") |> not_null,
        text("signature") |> not_null,
        text("linked_at") |> not_null,
        integer("public") |> not_null,
        integer("is_default") |> not_null |> default_int(0),
      ],
      [
        composite_primary_key(["did", "address", "chain_id"]),
        composite_unique("links_address_chain", ["address", "chain_id"]),
        index("links_by_owner_time", [asc("did"), desc("linked_at")]),
        unique_index("one_default_per_chain", [
          asc("did"),
          asc("chain_id"),
        ])
          |> only_where("\"is_default\" = 1"),
      ],
      decoder,
    )
  Links(
    table: table,
    did: string_column(table, "did"),
    address: string_column(table, "address"),
    chain_id: int_column(table, "chain_id"),
    message: string_column(table, "message"),
    signature: string_column(table, "signature"),
    linked_at: string_column(table, "linked_at"),
    is_public: bool_column(table, "public"),
    is_default: bool_column(table, "is_default"),
  )
}
