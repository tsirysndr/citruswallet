import citruswallet/drizzle/orm.{
  type Table, asc, composite_primary_key, desc, index, integer, not_null,
  only_where, table, text,
}
import gleam/dynamic/decode.{type Decoder}

/// Per-record repository revision is a persistent deduplication watermark.
/// Deleted/invalid records retain their revision so delayed events cannot revive them.
pub fn define(decoder: Decoder(row)) -> Table(row) {
  table(
    "address_repository_records",
    [
      text("did") |> not_null,
      text("rkey") |> not_null,
      text("rev") |> not_null,
      integer("chain_id"),
      text("address"),
      text("record"),
    ],
    [
      composite_primary_key(["did", "rkey"]),
      index("address_repository_latest", [
        asc("did"),
        asc("chain_id"),
        asc("address"),
        desc("rev"),
      ])
        |> only_where("\"record\" IS NOT NULL"),
    ],
    decoder,
  )
}
