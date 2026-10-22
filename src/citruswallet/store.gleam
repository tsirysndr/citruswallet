import gleam/dynamic/decode
import gleam/int
import gleam/option.{type Option, None, Some}
import gleam/result
import citruswallet/drizzle/orm.{type Database}
import citruswallet/drizzle/schema/challenges
import citruswallet/drizzle/schema/kv
import citruswallet/ffi/better_sqlite.{type Client}
import citruswallet/ffi/js.{type Exception}

pub type Store {
  Store(client: Client, database: Database)
}

pub fn open(
  path: String,
  migrations migrations: String,
) -> Result(Store, Exception) {
  use client <- result.try(better_sqlite.open(path))
  let database = orm.connect(client)
  use _ <- result.try(orm.migrate(database, folder: migrations))
  Ok(Store(client: client, database: database))
}

pub fn close(store: Store) -> Nil {
  better_sqlite.close(store.client)
}

pub fn transaction(
  store: Store,
  failed failed: e,
  run operation: fn(Database) -> Result(a, e),
) -> Result(a, e) {
  orm.transaction(store.database, failed: failed, run: operation)
}

fn table() -> kv.Kv(Nil) {
  kv.define(decode.success(Nil))
}

pub fn put(
  store: Store,
  namespace namespace: String,
  key key: String,
  value value: String,
  expires expires: Int,
) -> Nil {
  let kv = table()
  let _ =
    orm.insert(kv.table, [
      orm.set(kv.namespace, namespace),
      orm.set(kv.key, key),
      orm.set(kv.value, value),
      orm.set(kv.expires, expires),
    ])
    |> orm.on_conflict_update([orm.target(kv.namespace), orm.target(kv.key)], [
      orm.set(kv.value, value),
      orm.set(kv.expires, expires),
    ])
    |> orm.run(store.database)
  Nil
}

pub fn get(
  store: Store,
  namespace namespace: String,
  key key: String,
  now now: Int,
) -> Option(String) {
  let kv = table()
  orm.select(kv.table, orm.pick("value", kv.value))
  |> orm.where([
    orm.eq(kv.namespace, namespace),
    orm.eq(kv.key, key),
    orm.gt(kv.expires, now),
  ])
  |> orm.one(store.database)
}

pub fn delete(
  store: Store,
  namespace namespace: String,
  key key: String,
) -> Nil {
  let kv = table()
  let _ =
    orm.delete(kv.table, [
      orm.eq(kv.namespace, namespace),
      orm.eq(kv.key, key),
    ])
    |> orm.run(store.database)
  Nil
}

pub fn increment(
  store: Store,
  namespace namespace: String,
  key key: String,
  expires expires: Int,
  now now: Int,
) -> Int {
  let total = case get(store, namespace: namespace, key: key, now: now) {
    Some(value) -> option.unwrap(option.from_result(int.parse(value)), 0) + 1
    None -> 1
  }
  put(
    store,
    namespace: namespace,
    key: key,
    value: int.to_string(total),
    expires: expires,
  )
  total
}

pub fn cleanup(store: Store, now: Int) -> Nil {
  let kv = table()
  let challenges = challenges.define(decode.success(Nil))
  let _ =
    orm.delete(kv.table, [orm.lte(kv.expires, now)])
    |> orm.run(store.database)
  let _ =
    orm.delete(challenges.table, [orm.lte(challenges.expires, now)])
    |> orm.run(store.database)
  Nil
}

pub fn forget_challenges(store: Store, session: String) -> Nil {
  let challenges = challenges.define(decode.success(Nil))
  let _ =
    orm.delete(challenges.table, [orm.eq(challenges.session, session)])
    |> orm.run(store.database)
  Nil
}
