import gleam/dynamic.{type Dynamic}
import gleam/dynamic/decode
import gleam/javascript/array.{type Array}
import gleam/javascript/promise.{type Promise}
import gleam/option.{type Option, None, Some}

pub type Js =
  Dynamic

pub type Exception {
  Exception(name: String, message: String)
}

@external(javascript, "../../ffi.mjs", "identity")
pub fn coerce(value: a) -> b

@external(javascript, "../../ffi.mjs", "global_")
pub fn global(name: String) -> Js

@external(javascript, "../../ffi.mjs", "get")
pub fn get(target: Js, key: String) -> Js

@external(javascript, "../../ffi.mjs", "index")
pub fn at(target: Js, position: Int) -> Js

@external(javascript, "../../ffi.mjs", "call")
pub fn call(target: Js, method: String, arguments: List(Js)) -> Js

@external(javascript, "../../ffi.mjs", "apply")
pub fn apply(callee: Js, arguments: List(Js)) -> Js

@external(javascript, "../../ffi.mjs", "construct")
pub fn construct(class: Js, arguments: List(Js)) -> Js

@external(javascript, "../../ffi.mjs", "object")
pub fn object(entries: List(#(String, Js))) -> Js

@external(javascript, "../../ffi.mjs", "array")
pub fn list(items: List(Js)) -> Js

@external(javascript, "../../ffi.mjs", "nil")
pub fn null() -> Js

@external(javascript, "../../ffi.mjs", "nothing")
pub fn undefined() -> Js

@external(javascript, "../../ffi.mjs", "isNullish")
pub fn is_nullish(value: Js) -> Bool

@external(javascript, "../../ffi.mjs", "isUndefined")
pub fn is_undefined(value: Js) -> Bool

@external(javascript, "../../ffi.mjs", "jsonStringify")
pub fn stringify(value: Js) -> String

@external(javascript, "../../ffi.mjs", "jsonParse")
pub fn parse(text: String) -> Js

@external(javascript, "../../ffi.mjs", "bigIntFromString")
pub fn big_int(digits: String) -> Js

@external(javascript, "../../ffi.mjs", "bigIntToString")
pub fn big_int_digits(value: Js) -> String

pub fn string(value: String) -> Js {
  coerce(value)
}

pub fn int(value: Int) -> Js {
  coerce(value)
}

pub fn bool(value: Bool) -> Js {
  coerce(value)
}

pub fn nullable(value: Option(Js)) -> Js {
  case value {
    Some(value) -> value
    None -> null()
  }
}

pub fn as_string(value: Js) -> Option(String) {
  option.from_result(decode.run(value, decode.string))
}

pub fn as_int(value: Js) -> Option(Int) {
  option.from_result(decode.run(value, decode.int))
}

pub fn as_bool(value: Js) -> Option(Bool) {
  option.from_result(decode.run(value, decode.bool))
}

pub fn as_list(value: Js) -> List(Js) {
  array.to_list(as_array(value))
}

fn as_array(value: Js) -> Array(Js) {
  coerce(value)
}

pub fn field(target: Js, key: String) -> Option(Js) {
  let value = get(target, key)
  case is_nullish(value) {
    True -> None
    False -> Some(value)
  }
}

pub fn string_field(target: Js, key: String) -> Option(String) {
  field(target, key) |> option.then(as_string)
}

pub fn int_field(target: Js, key: String) -> Option(Int) {
  field(target, key) |> option.then(as_int)
}

pub type Cell =
  Js

@external(javascript, "../../ffi.mjs", "cell")
pub fn cell(initial: Js) -> Cell

@external(javascript, "../../ffi.mjs", "cellGet")
pub fn cell_get(cell: Cell) -> Js

@external(javascript, "../../ffi.mjs", "cellSet")
pub fn cell_set(cell: Cell, value: Js) -> Nil

@external(javascript, "../../ffi.mjs", "attempt")
fn attempt_raw(thunk: fn() -> a) -> Js

pub fn attempt(thunk: fn() -> a) -> Result(a, Exception) {
  outcome(attempt_raw(thunk))
}

@external(javascript, "../../ffi.mjs", "attemptPromise")
fn attempt_promise_raw(promise: Js) -> Promise(Js)

pub fn attempt_promise(promise: Js) -> Promise(Result(a, Exception)) {
  promise.map(attempt_promise_raw(promise), outcome)
}

fn outcome(settled: Js) -> Result(a, Exception) {
  case as_bool(get(settled, "ok")) {
    Some(True) -> Ok(coerce(get(settled, "value")))
    _ ->
      Error(Exception(
        name: text(get(settled, "name"), "Error"),
        message: text(get(settled, "message"), "JavaScript error"),
      ))
  }
}

fn text(value: Js, fallback: String) -> String {
  option.unwrap(as_string(value), fallback)
}

@external(javascript, "../../ffi.mjs", "bigIntMultiply")
pub fn multiply_integers(left: String, right: String) -> String
