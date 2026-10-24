import citruswallet/assets
import citruswallet/chain.{type Chain}
import citruswallet/error.{type HttpError}
import citruswallet/ffi/js
import citruswallet/ffi/viem
import gleam/dynamic/decode
import gleam/int
import gleam/javascript/promise.{type Promise}
import gleam/json
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string

pub fn offset(cursor: Option(String)) -> Result(Int, HttpError) {
  case cursor {
    None -> Ok(0)
    Some(value) -> {
      case
        string.starts_with(value, "rpc:"),
        int.parse(string.drop_start(value, 4))
      {
        True, Ok(n) if n >= 0 && n <= 20_000 -> Ok(n)
        _, _ -> Error(error.bad_request("Invalid token discovery cursor."))
      }
    }
  }
}

// Discover standard ERC-20 Transfer recipients, then read current balances.
// No indexer metadata, API keys, or client-supplied RPC URLs are trusted.
pub fn discover(
  chain: Chain,
  address: String,
  chain_id: Int,
  offset: Int,
) -> Promise(#(List(json.Json), Option(String), Bool)) {
  use response <- promise.await(viem.received_token_logs(chain.client, address))
  let logs =
    response
    |> result.replace_error(Nil)
    |> result.try(fn(value) {
      decode.run(value, decode.list(decode.dynamic))
      |> result.replace_error(Nil)
    })
  case logs {
    Error(_) -> promise.resolve(#([], None, False))
    Ok(logs) -> {
      let contracts =
        list.filter_map(logs, fn(log) {
          let contract = option.unwrap(js.string_field(log, "address"), "")
          let topics =
            decode.run(log, decode.at(["topics"], decode.list(decode.string)))
            |> result.unwrap([])
          // ERC-721 has a fourth indexed tokenId; do not treat it as fungible.
          case viem.is_address(contract) && list.length(topics) == 3 {
            True -> Ok(string.lowercase(contract))
            False -> Error(Nil)
          }
        })
        |> list.unique
        |> list.sort(string.compare)
      let batch = contracts |> list.drop(offset) |> list.take(20)
      use values <- promise.await(
        promise.await_list(
          list.map(batch, fn(contract) {
            use token <- promise.await(assets.resolve(
              Some(chain),
              chain_id,
              Some(
                "eip155:" <> int.to_string(chain_id) <> "/erc20:" <> contract,
              ),
            ))
            case token {
              Error(_) -> promise.resolve(Error(Nil))
              Ok(token) -> {
                use balance <- promise.await(assets.balance(
                  chain,
                  token,
                  address,
                ))
                promise.resolve(case balance {
                  Ok("0") -> Ok(None)
                  Ok(value) ->
                    Ok(Some(assets.balance_json(token, address, value)))
                  Error(_) -> Error(Nil)
                })
              }
            }
          }),
        ),
      )
      let next = case list.length(contracts) > offset + 20 {
        True -> Some("rpc:" <> int.to_string(offset + 20))
        False -> None
      }
      let items =
        list.filter_map(values, fn(value) {
          value |> result.try(option.to_result(_, Nil))
        })
      promise.resolve(#(items, next, list.all(values, result.is_ok)))
    }
  }
}
