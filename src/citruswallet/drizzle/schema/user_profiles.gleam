import citruswallet/drizzle/orm.{
  type Column, type Table, int_column, integer, not_null, optional_int_column,
  optional_string_column, primary_key, string_column, table as db_table, text,
  unique_value,
}
import gleam/dynamic/decode.{type Decoder}
import gleam/option.{type Option}

pub type UserProfiles(row) {
  UserProfiles(
    table: Table(row),
    id: Column(Int),
    did: Column(String),
    handle: Column(String),
    display_name: Column(Option(String)),
    avatar: Column(Option(String)),
    created_at: Column(Option(Int)),
    updated_at: Column(Option(Int)),
  )
}

pub fn define(decoder: Decoder(row)) -> UserProfiles(row) {
  let table =
    db_table(
      "user_profiles",
      [
        integer("id") |> primary_key |> not_null,
        text("did") |> unique_value |> not_null,
        text("handle") |> not_null,
        text("display_name"),
        text("avatar"),
        integer("created_at"),
        integer("updated_at"),
      ],
      [],
      decoder,
    )
  UserProfiles(
    table: table,
    id: int_column(table, "id"),
    did: string_column(table, "did"),
    handle: string_column(table, "handle"),
    display_name: optional_string_column(table, "display_name"),
    avatar: optional_string_column(table, "avatar"),
    created_at: optional_int_column(table, "created_at"),
    updated_at: optional_int_column(table, "updated_at"),
  )
}
