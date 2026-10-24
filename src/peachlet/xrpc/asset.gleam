import peachlet/assets
import peachlet/chain
import peachlet/error.{type HttpError}
import peachlet/ffi/amounts
import peachlet/ffi/hono.{type Context}
import peachlet/ffi/http
import peachlet/ffi/js.{type Js}
import peachlet/ffi/node
import peachlet/ffi/url
import peachlet/ffi/viem
import peachlet/linking
import peachlet/rpc_assets
import peachlet/xrpc/context.{type Reply, type Server, Payload}
import gleam/dynamic/decode
import gleam/int
import gleam/javascript/promise.{type Promise}
import gleam/json
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string

fn address(server: Server, ctx: Context) -> Result(String, HttpError) {
  use #(_, did) <- result.try(context.authenticated(server, ctx))
  let address =
    hono.parameter(ctx, "address") |> option.unwrap("") |> string.lowercase
  case
    viem.is_address(address),
    linking.find(
      server.links,
      did:,
      address:,
      chain_id: server.settings.network.chain_id,
    )
  {
    True, Some(_) -> Ok(address)
    _, _ ->
      Error(error.forbidden(
        "Choose a wallet linked to your account on this network.",
      ))
  }
}

pub fn get(server: Server, ctx: Context) -> Promise(Result(Reply, HttpError)) {
  use address <- context.attempt(address(server, ctx))
  use asset <- promise.try_await(assets.resolve(
    server.settings.chain,
    server.settings.network.chain_id,
    hono.parameter(ctx, "assetId"),
  ))
  use chain <- promise.try_await(chain.require(
    server.settings.chain,
    asset.chain_id,
  ))
  use balance <- promise.try_await(assets.balance(chain, asset, address))
  context.done(Ok(Payload(200, assets.balance_json(asset, address, balance))))
}

pub fn listing(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use address <- context.attempt(address(server, ctx))
  let chain_id = server.settings.network.chain_id
  use chain <- promise.try_await(chain.require(server.settings.chain, chain_id))
  let native = assets.native(chain_id)
  use balance <- promise.try_await(assets.balance(chain, native, address))
  let native_balance = assets.balance_json(native, address, balance)
  case chain_id {
    6343 -> {
      use offset <- context.attempt(
        rpc_assets.offset(hono.parameter(ctx, "cursor")),
      )
      use #(tokens, next, available) <- promise.await(rpc_assets.discover(
        chain,
        address,
        chain_id,
        offset,
      ))
      context.done(
        Ok(Payload(200, page([native_balance, ..tokens], next, available))),
      )
    }
    _ -> indexed(ctx, chain_id, address, native_balance)
  }
}

fn indexed(
  ctx: Context,
  chain_id: Int,
  address: String,
  native_balance: json.Json,
) -> Promise(Result(Reply, HttpError)) {
  use suffix <- context.attempt(cursor_query(hono.parameter(ctx, "cursor")))
  let base = case chain_id {
    4326 ->
      node.environment("MEGAETH_TOKEN_INDEXER_URL")
      |> option.unwrap("https://megaeth.blockscout.com/api/v2")
    _ ->
      node.environment("TOKEN_INDEXER_URL")
      |> option.unwrap("https://eth.blockscout.com/api/v2")
  }

  let base = case string.ends_with(base, "/") {
    True -> string.drop_end(base, 1)
    False -> base
  }
  // The indexer is discovery only. A selected token is re-read from Ethereum.
  let valid = case url.parse(base) {
    Ok(parsed) -> url.protocol(parsed) == "https:"
    Error(_) -> False
  }
  case list.contains([1, 4326], chain_id) && valid {
    False -> context.done(Ok(Payload(200, page([native_balance], None, False))))
    True -> {
      use response <- promise.await(http.get_json(
        base <> "/addresses/" <> address <> "/tokens?type=ERC-20" <> suffix,
        timeout: 10_000,
      ))
      case response {
        Error(_) ->
          context.done(Ok(Payload(200, page([native_balance], None, False))))
        Ok(data) -> {
          let parsed =
            decode.run(data, decode.at(["items"], decode.list(decode.dynamic)))
          let items = result.unwrap(parsed, [])
          let tokens =
            list.filter_map(items, fn(item) { token(item, address, chain_id) })
          let next = case
            decode.run(data, decode.at(["next_page_params"], decode.dynamic))
          {
            Ok(value) ->
              case js.is_nullish(value) {
                True -> None
                False -> Some(js.stringify(value))
              }
            Error(_) -> None
          }
          context.done(
            Ok(Payload(
              200,
              page([native_balance, ..tokens], next, result.is_ok(parsed)),
            )),
          )
        }
      }
    }
  }
}

fn page(
  items: List(json.Json),
  cursor: Option(String),
  available: Bool,
) -> json.Json {
  json.object(
    list.append(
      [
        #("assets", json.preprocessed_array(items)),
        #("discoveryAvailable", json.bool(available)),
      ],
      case cursor {
        Some(cursor) -> [#("cursor", json.string(cursor))]
        None -> []
      },
    ),
  )
}

fn token(item: Js, address: String, chain_id: Int) -> Result(json.Json, Nil) {
  use contract <- result.try(
    decode.run(item, decode.at(["token", "address_hash"], decode.string))
    |> result.replace_error(Nil),
  )
  let token = js.get(item, "token")
  use decimals <- result.try(
    js.string_field(token, "decimals")
    |> option.to_result(Nil)
    |> result.try(int.parse),
  )
  use value <- result.try(
    js.string_field(item, "value") |> option.to_result(Nil),
  )
  case
    viem.is_address(contract)
    && decimals >= 0
    && decimals <= 255
    && value != "0"
    && amounts.valid_atomic(value)
    && string.length(value) <= 78
    && list.all(string.to_graphemes(value), fn(c) {
      string.contains("0123456789", c)
    })
    && js.string_field(token, "type") == Some("ERC-20")
  {
    False -> Error(Nil)
    True -> {
      let symbol =
        js.string_field(token, "symbol")
        |> option.unwrap("Token")
        |> string.slice(0, 32)
      let name =
        js.string_field(token, "name")
        |> option.unwrap("ERC-20 token")
        |> string.slice(0, 128)
      Ok(assets.balance_json(
        assets.Asset(
          chain_id,
          Some(string.lowercase(contract)),
          symbol,
          name,
          decimals,
        ),
        address,
        value,
      ))
    }
  }
}

fn cursor_query(cursor: Option(String)) -> Result(String, HttpError) {
  case cursor {
    None -> Ok("")
    Some(cursor) -> {
      use value <- result.try(
        js.attempt(fn() {
          js.call(js.global("JSON"), "parse", [js.string(cursor)])
        })
        |> result.replace_error(error.bad_request("Invalid asset cursor.")),
      )
      let pairs =
        list.filter_map(["fiat_value", "id", "items_count", "value"], fn(key) {
          let text = case
            decode.run(value, decode.at([key], decode.string)),
            decode.run(value, decode.at([key], decode.int))
          {
            Ok(text), _ -> Some(text)
            _, Ok(number) -> Some(int.to_string(number))
            _, _ -> None
          }
          case text {
            Some(text) -> Ok("&" <> key <> "=" <> url.encode_component(text))
            None -> Error(Nil)
          }
        })
      case pairs {
        [] -> Error(error.bad_request("Invalid asset cursor."))
        _ -> Ok(string.join(pairs, ""))
      }
    }
  }
}
