import gleam/dynamic/decode.{type Decoder}
import peachlet/drizzle/orm.{
  type Column, type Table, asc, bool_column, index, int_column, integer,
  not_null, primary_key, string_column, table as db_table, text,
}

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
    db_table(
      "challenges",
      [
        text("id") |> primary_key,
        text("session") |> not_null,
        text("did") |> not_null,
        text("address") |> not_null,
        text("message") |> not_null,
        integer("expires") |> not_null,
        integer("public") |> not_null,
      ],
      [
        index("challenges_by_expiry", [asc("expires")]),
        index("challenges_by_session", [asc("session")]),
      ],
      decoder,
    )
  Challenges(
    table: table,
    id: string_column(table, "id"),
    session: string_column(table, "session"),
    did: string_column(table, "did"),
    address: string_column(table, "address"),
    message: string_column(table, "message"),
    expires: int_column(table, "expires"),
    is_public: bool_column(table, "public"),
  )
}
