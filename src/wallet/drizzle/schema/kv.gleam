import gleam/dynamic/decode.{type Decoder}
import wallet/drizzle/orm.{type Column, type Table}

pub type Kv(row) {
  Kv(
    table: Table(row),
    namespace: Column(String),
    key: Column(String),
    value: Column(String),
    expires: Column(Int),
  )
}

pub fn define(decoder: Decoder(row)) -> Kv(row) {
  let table =
    orm.table(
      "kv",
      [
        orm.text("namespace") |> orm.not_null,
        orm.text("key") |> orm.not_null,
        orm.text("value") |> orm.not_null,
        orm.integer("expires") |> orm.not_null,
      ],
      [orm.composite_primary_key(["namespace", "key"])],
      decoder,
    )
  Kv(
    table: table,
    namespace: orm.string_column(table, "namespace"),
    key: orm.string_column(table, "key"),
    value: orm.string_column(table, "value"),
    expires: orm.int_column(table, "expires"),
  )
}
