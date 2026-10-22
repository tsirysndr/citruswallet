import citruswallet/drizzle/orm.{
  type Database, connect, delete as db_delete, eq, gt, insert, lte, migrate,
  on_conflict_update, one, pick, run as db_run, select, set, target,
  transaction as db_transaction, where,
}
import citruswallet/drizzle/schema/challenges
import citruswallet/drizzle/schema/kv
import citruswallet/ffi/better_sqlite.{type Client}
import citruswallet/ffi/js.{type Exception}
import gleam/dynamic/decode
import gleam/int
import gleam/option.{type Option, None, Some}
import gleam/result

pub type Store {
  Store(client: Client, database: Database)
}

pub fn open(
  path: String,
  migrations migrations: String,
) -> Result(Store, Exception) {
  use client <- result.try(better_sqlite.open(path))
  let database = connect(client)
  use _ <- result.try(migrate(database, folder: migrations))
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
  db_transaction(store.database, failed: failed, run: operation)
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
    insert(kv.table, [
      set(kv.namespace, namespace),
      set(kv.key, key),
      set(kv.value, value),
      set(kv.expires, expires),
    ])
    |> on_conflict_update([target(kv.namespace), target(kv.key)], [
      set(kv.value, value),
      set(kv.expires, expires),
    ])
    |> db_run(store.database)
  Nil
}

pub fn get(
  store: Store,
  namespace namespace: String,
  key key: String,
  now now: Int,
) -> Option(String) {
  let kv = table()
  select(kv.table, pick("value", kv.value))
  |> where([
    eq(kv.namespace, namespace),
    eq(kv.key, key),
    gt(kv.expires, now),
  ])
  |> one(store.database)
}

pub fn delete(
  store: Store,
  namespace namespace: String,
  key key: String,
) -> Nil {
  let kv = table()
  let _ =
    db_delete(kv.table, [
      eq(kv.namespace, namespace),
      eq(kv.key, key),
    ])
    |> db_run(store.database)
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
    db_delete(kv.table, [lte(kv.expires, now)])
    |> db_run(store.database)
  let _ =
    db_delete(challenges.table, [lte(challenges.expires, now)])
    |> db_run(store.database)
  Nil
}

pub fn forget_challenges(store: Store, session: String) -> Nil {
  let challenges = challenges.define(decode.success(Nil))
  let _ =
    db_delete(challenges.table, [eq(challenges.session, session)])
    |> db_run(store.database)
  Nil
}
