import citruswallet/drizzle/orm.{type Column, type Table}
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
    orm.table(
      "links",
      [
        orm.text("did") |> orm.not_null,
        orm.text("address") |> orm.not_null,
        orm.integer("chain_id") |> orm.not_null,
        orm.text("message") |> orm.not_null,
        orm.text("signature") |> orm.not_null,
        orm.text("linked_at") |> orm.not_null,
        orm.integer("public") |> orm.not_null,
        orm.integer("is_default") |> orm.not_null |> orm.default_int(0),
      ],
      [
        orm.composite_primary_key(["did", "address", "chain_id"]),
        orm.composite_unique("links_address_chain", ["address", "chain_id"]),
        orm.unique_index("one_default_per_chain", [
          orm.asc("did"),
          orm.asc("chain_id"),
        ])
          |> orm.only_where("\"is_default\" = 1"),
      ],
      decoder,
    )
  Links(
    table: table,
    did: orm.string_column(table, "did"),
    address: orm.string_column(table, "address"),
    chain_id: orm.int_column(table, "chain_id"),
    message: orm.string_column(table, "message"),
    signature: orm.string_column(table, "signature"),
    linked_at: orm.string_column(table, "linked_at"),
    is_public: orm.bool_column(table, "public"),
    is_default: orm.bool_column(table, "is_default"),
  )
}
