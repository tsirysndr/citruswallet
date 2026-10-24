import gleam/dynamic/decode
import gleam/javascript/promise.{type Promise}
import gleam/json
import gleam/list
import gleam/option.{None, Some}
import gleam/result
import gleam/string
import peachlet/error.{type HttpError}
import peachlet/ffi/hono.{type Context}
import peachlet/ffi/http
import peachlet/ffi/js.{type Js}
import peachlet/ffi/node
import peachlet/store
import peachlet/xrpc/context.{type Reply, type Server, Payload}

pub fn parse_price(data: Js) -> Result(String, Nil) {
  use base <- result.try(
    decode.run(data, decode.at(["data", "base"], decode.string))
    |> result.replace_error(Nil),
  )
  use currency <- result.try(
    decode.run(data, decode.at(["data", "currency"], decode.string))
    |> result.replace_error(Nil),
  )
  use price <- result.try(
    decode.run(data, decode.at(["data", "amount"], decode.string))
    |> result.replace_error(Nil),
  )
  case base == "ETH" && currency == "USD" && valid_rate(price) {
    True -> Ok(price)
    False -> Error(Nil)
  }
}

pub fn valid_rate(price: String) -> Bool {
  let parts_valid = case string.split(price, ".") {
    [whole] -> digits(whole) && !string.starts_with(whole, "0")
    [whole, fraction] ->
      digits(whole)
      && digits(fraction)
      && { whole == "0" || !string.starts_with(whole, "0") }
    _ -> False
  }
  parts_valid
  && string.length(price) <= 32
  && list.any(string.to_graphemes(price), fn(c) {
    string.contains("123456789", c)
  })
}

fn digits(value: String) -> Bool {
  !string.is_empty(value)
  && list.all(string.to_graphemes(value), fn(c) {
    string.contains("0123456789", c)
  })
}

fn body(price: String, now: Int) -> json.Json {
  json.object([
    #("usd", json.string(price)),
    #("updatedAt", json.int(now)),
    #("source", json.string("Coinbase")),
  ])
}

pub fn get(server: Server, ctx: Context) -> Promise(Result(Reply, HttpError)) {
  use _ <- context.attempt(context.authenticated(server, ctx))
  let now = node.now()
  case store.get(server.settings.store, "market-price", "ETH-USD", now) {
    Some(cached) -> {
      let decoder = {
        use price <- decode.field("usd", decode.string)
        use at <- decode.field("updatedAt", decode.int)
        decode.success(body(price, at))
      }
      case json.parse(cached, decoder) {
        Ok(value) -> context.done(Ok(Payload(200, value)))
        Error(_) -> fetch(server, now)
      }
    }
    None -> fetch(server, now)
  }
}

fn fetch(server: Server, now: Int) -> Promise(Result(Reply, HttpError)) {
  use response <- promise.await(http.get_json(
    "https://api.coinbase.com/v2/prices/ETH-USD/spot",
    timeout: 5000,
  ))
  let parsed = response |> result.replace_error(Nil) |> result.try(parse_price)
  case parsed {
    Ok(price) -> {
      let value = body(price, now)
      store.put(
        server.settings.store,
        "market-price",
        "ETH-USD",
        json.to_string(value),
        now + 60_000,
      )
      context.done(Ok(Payload(200, value)))
    }
    Error(_) ->
      context.done(
        Error(error.unavailable("ETH price is temporarily unavailable.")),
      )
  }
}
