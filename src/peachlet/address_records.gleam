import peachlet/ffi/atproto
import peachlet/ffi/better_sqlite.{type Client}
import gleam/javascript/promise.{type Promise}

/// These writes participate in the caller's SQLite transaction. Only verified
/// public links are queued for publication; private links queue a deletion.
@external(javascript, "../address-records.mjs", "queueVerifiedAddress")
pub fn queue_verified(
  database: Client,
  did: String,
  chain: Int,
  address: String,
  is_public: Bool,
  message: String,
  signature: String,
  created_at: String,
) -> Nil

@external(javascript, "../address-records.mjs", "queueRemovedAddress")
pub fn queue_removed(
  database: Client,
  did: String,
  chain: Int,
  address: String,
) -> Nil

@external(javascript, "../address-records.mjs", "addressSyncPending")
pub fn pending(database: Client, did: String) -> Bool

@external(javascript, "../address-records.mjs", "syncAddresses")
pub fn sync(
  database: Client,
  oauth: atproto.Client,
  did: String,
) -> Promise(Bool)

@external(javascript, "../address-records.mjs", "needsPublication")
pub fn needs_publication(
  database: Client,
  did: String,
  chain: Int,
  address: String,
) -> Bool
