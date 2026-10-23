import citruswallet/ffi/js.{type Exception, type Js}
import gleam/option

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

// Bound parameters stay separate from SQL; these bindings are used for queue
// claims and SQLite queries that are awkward to express in the ORM.
pub fn query(client: Client, sql: String, params: List(Js)) -> List(Js) {
  let statement = js.call(client, "prepare", [js.string(sql)])
  js.as_list(js.call(statement, "all", params))
}

pub fn first(client: Client, sql: String, params: List(Js)) -> Js {
  let statement = js.call(client, "prepare", [js.string(sql)])
  js.call(statement, "get", params)
}

pub fn run(client: Client, sql: String, params: List(Js)) -> Int {
  let statement = js.call(client, "prepare", [js.string(sql)])
  js.call(statement, "run", params)
  |> js.int_field("changes")
  |> option.unwrap(0)
}
