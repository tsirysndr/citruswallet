import gleam/list
import gleam/string

pub fn is_hex(value: String, length length: Int) -> Bool {
  string.length(value) == length
  && list.all(string.to_graphemes(value), is_lowercase_hex_digit)
}

pub fn is_hex_quantity(value: String, digits digits: Int) -> Bool {
  case string.starts_with(value, "0x") {
    False -> False
    True -> {
      let body = string.drop_start(value, 2)
      string.length(body) == digits
      && list.all(string.to_graphemes(body), is_hex_digit)
    }
  }
}

pub fn is_ether_amount(value: String) -> Bool {
  case string.split(value, ".") {
    [whole] -> is_whole_part(whole)
    [whole, fraction] ->
      is_whole_part(whole)
      && string.length(fraction) >= 1
      && string.length(fraction) <= 18
      && is_digits(fraction)
    _ -> False
  }
}

fn is_whole_part(whole: String) -> Bool {
  case string.to_graphemes(whole) {
    ["0"] -> True
    [first, ..rest] ->
      first != "0"
      && is_digit(first)
      && list.length(rest) <= 17
      && list.all(rest, is_digit)
    [] -> False
  }
}

fn is_digits(value: String) -> Bool {
  case string.is_empty(value) {
    True -> False
    False -> list.all(string.to_graphemes(value), is_digit)
  }
}

fn is_digit(grapheme: String) -> Bool {
  string.contains("0123456789", grapheme)
}

fn is_lowercase_hex_digit(grapheme: String) -> Bool {
  is_digit(grapheme) || string.contains("abcdef", grapheme)
}

fn is_hex_digit(grapheme: String) -> Bool {
  is_lowercase_hex_digit(grapheme) || string.contains("ABCDEF", grapheme)
}
