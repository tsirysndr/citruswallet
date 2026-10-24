import gleam/javascript/promise.{type Promise}
import gleam/option.{Some}
import gleam/result
import peachlet/directory.{type Directory}
import peachlet/ffi/better_sqlite.{type Client}
import peachlet/ffi/js.{type Exception, type Js}
import peachlet/profiles
import peachlet/store.{type Store}

pub type Listener =
  Js

@external(javascript, "../jetstream.mjs", "startJetstream")
fn start_listener(
  database: Client,
  origin: String,
  ensure_profile: fn(String) -> Promise(Bool),
) -> Listener

pub fn start(
  store: Store,
  directory: Directory,
  origin: String,
) -> Result(Listener, Exception) {
  js.attempt(fn() {
    start_listener(store.client, origin, fn(did) {
      ensure_profile(store, directory, did)
    })
  })
}

@external(javascript, "../jetstream.mjs", "stopJetstream")
pub fn stop(listener: Listener) -> Promise(Nil)

/// Shared by event ingestion and tests. The existing profile saver uses a DID
/// conflict target, so concurrent OAuth login cannot create a duplicate row.
pub fn ensure_profile(
  store: Store,
  directory: Directory,
  did: String,
) -> Promise(Bool) {
  case profiles.get(store, did) {
    Some(profile) if profile.actor.handle != "" -> promise.resolve(True)
    _ -> promise.map(profiles.refresh(store, directory, did), result.is_ok)
  }
}
