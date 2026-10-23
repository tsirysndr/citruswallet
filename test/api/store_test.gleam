import api/fixtures as f
import citruswallet/store
import gleam/option.{None, Some}

pub fn transaction_error_rolls_back_every_write_test() {
  let service = f.open()
  store.put(service.store, "session", "existing", "before", 1000)
  let outcome =
    store.transaction(service.store, "database failed", fn(_) {
      store.put(service.store, "session", "existing", "after", 1000)
      store.put(service.store, "session", "new", "value", 1000)
      Error("abort")
    })
  assert outcome == Error("abort")
  assert store.get(service.store, "session", "existing", 0) == Some("before")
  assert store.get(service.store, "session", "new", 0) == None
  store.close(service.store)
}

pub fn keys_and_cleanup_do_not_cross_namespaces_test() {
  let service = f.open()
  store.put(service.store, "oauth", "same", "credentials", 2000)
  store.put(service.store, "browser", "same", "cookie", 1000)
  store.cleanup(service.store, 1000)
  assert store.get(service.store, "browser", "same", 0) == None
  assert store.get(service.store, "oauth", "same", 1000) == Some("credentials")
  store.delete(service.store, "browser", "same")
  assert store.get(service.store, "oauth", "same", 1000) == Some("credentials")
  store.close(service.store)
}
