import citruswallet/ffi/js.{type Exception, type Js}

pub type Client =
  Js

@external(javascript, "better-sqlite3", "default")
fn better_sqlite3() -> Js

pub fn open(path: String) -> Result(Client, Exception) {
  js.attempt(fn() {
    let client = js.construct(js.coerce(better_sqlite3), [js.string(path)])
    let _ = js.call(client, "pragma", [js.string("journal_mode = WAL")])
    let _ = js.call(client, "pragma", [js.string("foreign_keys = ON")])
    let _ = js.call(client, "pragma", [js.string("busy_timeout = 5000")])
    client
  })
}

pub fn execute(client: Client, sql: String) -> Result(Nil, Exception) {
  js.attempt(fn() {
    let _ = js.call(client, "exec", [js.string(sql)])
    Nil
  })
}

pub fn close(client: Client) -> Nil {
  let _ = js.attempt(fn() { js.call(client, "close", []) })
  Nil
}
