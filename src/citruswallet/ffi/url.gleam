import citruswallet/ffi/js.{type Js}
import gleam/option

pub type Url =
  Js

pub fn parse(href: String) -> Result(Url, Nil) {
  js.attempt(fn() { js.construct(js.global("URL"), [js.string(href)]) })
  |> drop_reason
}

pub fn parse_relative(href: String, base: String) -> Result(Url, Nil) {
  js.attempt(fn() {
    js.construct(js.global("URL"), [js.string(href), js.string(base)])
  })
  |> drop_reason
}

pub fn encode_component(value: String) -> String {
  js.coerce(js.apply(js.global("encodeURIComponent"), [js.string(value)]))
}

pub fn origin(url: Url) -> String {
  part(url, "origin")
}

pub fn protocol(url: Url) -> String {
  part(url, "protocol")
}

pub fn hostname(url: Url) -> String {
  part(url, "hostname")
}

pub fn host(url: Url) -> String {
  part(url, "host")
}

pub fn query(url: Url) -> Js {
  js.get(url, "searchParams")
}

fn part(url: Url, name: String) -> String {
  option.unwrap(js.string_field(url, name), "")
}

fn drop_reason(result: Result(a, b)) -> Result(a, Nil) {
  case result {
    Ok(value) -> Ok(value)
    Error(_) -> Error(Nil)
  }
}
