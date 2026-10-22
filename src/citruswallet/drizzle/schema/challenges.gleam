import citruswallet/drizzle/orm.{type Column, type Table}
import gleam/dynamic/decode.{type Decoder}

pub type Challenges(row) {
  Challenges(
    table: Table(row),
    id: Column(String),
    session: Column(String),
    did: Column(String),
    address: Column(String),
    message: Column(String),
    expires: Column(Int),
    is_public: Column(Bool),
  )
}

pub fn define(decoder: Decoder(row)) -> Challenges(row) {
  let table =
    orm.table(
      "challenges",
      [
        orm.text("id") |> orm.primary_key,
        orm.text("session") |> orm.not_null,
        orm.text("did") |> orm.not_null,
        orm.text("address") |> orm.not_null,
        orm.text("message") |> orm.not_null,
        orm.integer("expires") |> orm.not_null,
        orm.integer("public") |> orm.not_null,
      ],
      [],
      decoder,
    )
  Challenges(
    table: table,
    id: orm.string_column(table, "id"),
    session: orm.string_column(table, "session"),
    did: orm.string_column(table, "did"),
    address: orm.string_column(table, "address"),
    message: orm.string_column(table, "message"),
    expires: orm.int_column(table, "expires"),
    is_public: orm.bool_column(table, "public"),
  )
}
