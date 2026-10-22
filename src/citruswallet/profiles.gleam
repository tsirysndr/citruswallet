import citruswallet/directory.{type Actor, type Directory, Actor}
import citruswallet/drizzle/orm.{
  eq, from, insert, on_conflict_update, one, run, set, target, where,
}
import citruswallet/drizzle/schema/user_profiles
import citruswallet/error.{type HttpError}
import citruswallet/ffi/node
import citruswallet/store.{type Store}
import gleam/dynamic/decode
import gleam/javascript/promise.{type Promise}
import gleam/option.{type Option, None, Some}
import gleam/result

pub type Profile {
  Profile(actor: Actor, created_at: Option(Int), updated_at: Option(Int))
}

fn table() -> user_profiles.UserProfiles(Profile) {
  let decoder = {
    use did <- decode.field("did", decode.string)
    use handle <- decode.field("handle", decode.string)
    use display_name <- decode.field(
      "display_name",
      decode.optional(decode.string),
    )
    use avatar <- decode.field("avatar", decode.optional(decode.string))
    use created_at <- decode.field("created_at", decode.optional(decode.int))
    use updated_at <- decode.field("updated_at", decode.optional(decode.int))
    decode.success(Profile(
      Actor(did, handle, display_name, avatar),
      created_at,
      updated_at,
    ))
  }
  user_profiles.define(decoder)
}

pub fn get(store: Store, did: String) -> Option(Profile) {
  let table = table()
  from(table.table)
  |> where([eq(table.did, did)])
  |> one(store.database)
}

/// Timestamps are Unix milliseconds. The first insertion time never changes.
pub fn save(store: Store, actor: Actor, now: Int) -> Result(Actor, HttpError) {
  let table = table()
  let values = [
    set(table.handle, actor.handle),
    set(table.display_name, actor.display_name),
    set(table.avatar, actor.avatar),
    set(table.updated_at, Some(now)),
  ]
  insert(table.table, [
    set(table.did, actor.did),
    set(table.created_at, Some(now)),
    ..values
  ])
  |> on_conflict_update([target(table.did)], values)
  |> run(store.database)
  |> result.replace(actor)
  |> result.replace_error(error.unavailable(
    "Could not save your profile. Please try again.",
  ))
}

/// Failed lookups preserve the last known profile. A first login still records
/// the authenticated DID, even if its AppView profile is not available yet.
pub fn refresh(
  store: Store,
  directory: Directory,
  did: String,
) -> Promise(Result(Actor, HttpError)) {
  use fetched <- promise.map(directory.profile(did))
  let actor = case fetched {
    Ok(Some(actor)) if actor.did == did ->
      case directory.vetted([actor]) {
        [actor] -> Some(actor)
        _ -> None
      }
    _ -> None
  }
  case actor {
    Some(actor) -> save(store, actor, node.now())
    None ->
      case get(store, did) {
        Some(profile) -> Ok(profile.actor)
        None -> save(store, Actor(did, "", None, None), node.now())
      }
  }
}
