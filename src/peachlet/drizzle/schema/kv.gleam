import gleam/dynamic/decode.{type Decoder}
import peachlet/drizzle/orm.{
  type Column, type Table, asc, composite_primary_key, index, int_column,
  integer, not_null, string_column, table as db_table, text,
}

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
    db_table(
      "kv",
      [
        text("namespace") |> not_null,
        text("key") |> not_null,
        text("value") |> not_null,
        integer("expires") |> not_null,
      ],
      [
        composite_primary_key(["namespace", "key"]),
        index("kv_by_expiry", [asc("expires")]),
      ],
      decoder,
    )
  Kv(
    table: table,
    namespace: string_column(table, "namespace"),
    key: string_column(table, "key"),
    value: string_column(table, "value"),
    expires: int_column(table, "expires"),
  )
}
