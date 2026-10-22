import gleam/option.{type Option}
import wallet/ffi/js.{type Js}

fn process() -> Js {
  js.global("process")
}

pub fn environment(name: String) -> Option(String) {
  js.string_field(js.get(process(), "env"), name)
}

pub fn umask(mask: Int) -> Nil {
  let _ = js.call(process(), "umask", [js.int(mask)])
  Nil
}

pub fn exit(code: Int) -> Nil {
  let _ = js.call(process(), "exit", [js.int(code)])
  Nil
}

pub fn on_signal(signal: String, handler: fn() -> Nil) -> Nil {
  let _ = js.call(process(), "on", [js.string(signal), js.coerce(handler)])
  Nil
}

@external(javascript, "node:crypto", "randomBytes")
fn random_bytes(size: Int) -> Js

pub fn random_hex(bytes: Int) -> String {
  js.coerce(js.call(random_bytes(bytes), "toString", [js.string("hex")]))
}

@external(javascript, "node:crypto", "createHash")
fn create_hash(algorithm: String) -> Js

pub fn sha256(value: String) -> String {
  let hash = js.call(create_hash("sha256"), "update", [js.string(value)])
  js.coerce(js.call(hash, "digest", [js.string("hex")]))
}

@external(javascript, "node:crypto", "timingSafeEqual")
fn timing_safe_equal(left: Js, right: Js) -> Bool

pub fn secure_equal(left: String, right: String) -> Bool {
  let left = buffer(left)
  let right = buffer(right)
  case byte_size(left) == byte_size(right) {
    True -> timing_safe_equal(left, right)
    False -> False
  }
}

fn buffer(value: String) -> Js {
  js.call(js.global("Buffer"), "from", [js.string(value)])
}

fn byte_size(buffer: Js) -> Int {
  option.unwrap(js.int_field(buffer, "length"), 0)
}

@external(javascript, "node:fs", "mkdirSync")
fn mkdir_sync(path: String, options: Js) -> Js

pub fn make_directory(path: String, mode: Int) -> Result(Nil, js.Exception) {
  js.attempt(fn() {
    let _ =
      mkdir_sync(
        path,
        js.object([#("recursive", js.bool(True)), #("mode", js.int(mode))]),
      )
    Nil
  })
}

@external(javascript, "node:fs", "chmodSync")
fn chmod_sync(path: String, mode: Int) -> Nil

pub fn set_mode(path: String, mode: Int) -> Result(Nil, js.Exception) {
  js.attempt(fn() { chmod_sync(path, mode) })
}

@external(javascript, "node:path", "resolve")
pub fn absolute(path: String) -> String

@external(javascript, "node:path", "dirname")
pub fn parent(path: String) -> String

pub type Timer =
  Js

@external(javascript, "node:timers", "setInterval")
fn set_interval(handler: fn() -> Nil, milliseconds: Int) -> Timer

@external(javascript, "node:timers", "clearInterval")
pub fn cancel(timer: Timer) -> Nil

pub fn every(milliseconds: Int, handler: fn() -> Nil) -> Timer {
  let timer = set_interval(handler, milliseconds)
  let _ = js.call(timer, "unref", [])
  timer
}

pub fn log(message: String) -> Nil {
  let _ = js.call(js.global("console"), "log", [js.string(message)])
  Nil
}

pub fn log_error(message: String) -> Nil {
  let _ = js.call(js.global("console"), "error", [js.string(message)])
  Nil
}

pub fn now() -> Int {
  option.unwrap(js.as_int(js.call(js.global("Date"), "now", [])), 0)
}

pub fn iso8601(milliseconds: Int) -> String {
  let date = js.construct(js.global("Date"), [js.int(milliseconds)])
  js.coerce(js.call(date, "toISOString", []))
}
