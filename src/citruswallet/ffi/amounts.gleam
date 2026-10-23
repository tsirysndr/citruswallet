import citruswallet/ffi/js

@external(javascript, "@citruswallet/amounts", "parseAmount")
fn parse_raw(value: String, decimals: Int) -> String

@external(javascript, "@citruswallet/amounts", "formatAmount")
pub fn format(value: String, decimals: Int) -> String

pub fn parse(value: String, decimals: Int) -> Result(String, Nil) {
  case js.attempt(fn() { parse_raw(value, decimals) }) {
    Ok(value) -> Ok(value)
    Error(_) -> Error(Nil)
  }
}

pub fn valid_atomic(value: String) -> Bool {
  case js.attempt(fn() { format(value, 0) }) {
    Ok(_) -> True
    Error(_) -> False
  }
}
