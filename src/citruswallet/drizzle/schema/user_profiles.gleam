import citruswallet/drizzle/orm.{type Column, type Table}
import gleam/dynamic/decode.{type Decoder}
import gleam/option.{type Option}

pub type UserProfiles(row) {
  UserProfiles(
    table: Table(row),
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
    orm.table(
      "user_profiles",
      [
        orm.text("did") |> orm.primary_key |> orm.not_null,
        orm.text("handle") |> orm.not_null,
        orm.text("display_name"),
        orm.text("avatar"),
        orm.integer("created_at"),
        orm.integer("updated_at"),
      ],
      [],
      decoder,
    )
  UserProfiles(
    table: table,
    did: orm.string_column(table, "did"),
    handle: orm.string_column(table, "handle"),
    display_name: orm.optional_string_column(table, "display_name"),
    avatar: orm.optional_string_column(table, "avatar"),
    created_at: orm.optional_int_column(table, "created_at"),
    updated_at: orm.optional_int_column(table, "updated_at"),
  )
}
