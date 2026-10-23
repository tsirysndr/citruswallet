import citruswallet/chain.{type Chain}
import citruswallet/error.{type HttpError}
import citruswallet/ffi/js
import citruswallet/ffi/viem
import gleam/int
import gleam/javascript/promise.{type Promise}
import gleam/json
import gleam/option.{type Option, None, Some}
import gleam/order
import gleam/result
import gleam/string

pub type Asset {
  Asset(
    chain_id: Int,
    contract: Option(String),
    symbol: String,
    name: String,
    decimals: Int,
  )
}

pub fn native(chain_id: Int) -> Asset {
  Asset(chain_id, None, "ETH", "Ether", 18)
}

pub fn id(asset: Asset) -> String {
  "eip155:"
  <> int.to_string(asset.chain_id)
  <> case asset.contract {
    None -> "/slip44:60"
    Some(contract) -> "/erc20:" <> string.lowercase(contract)
  }
}

pub fn to_json(asset: Asset) -> json.Json {
  json.object([
    #("id", json.string(id(asset))),
    #("chain", json.string("eip155:" <> int.to_string(asset.chain_id))),
    #("chainId", json.int(asset.chain_id)),
    #(
      "kind",
      json.string(case asset.contract {
        None -> "native"
        Some(_) -> "erc20"
      }),
    ),
    #("contractAddress", json.nullable(asset.contract, json.string)),
    #("symbol", json.string(asset.symbol)),
    #("name", json.string(asset.name)),
    #("decimals", json.int(asset.decimals)),
  ])
}

pub fn resolve(
  chain: Option(Chain),
  chain_id: Int,
  selection: Option(String),
) -> Promise(Result(Asset, HttpError)) {
  let asset = native(chain_id)
  case selection {
    None -> promise.resolve(Ok(asset))
    Some(selected) if selected == "ETH" -> promise.resolve(Ok(asset))
    Some(selected) ->
      case selected == id(asset) {
        True -> promise.resolve(Ok(asset))
        False -> {
          let prefix = "eip155:" <> int.to_string(chain_id) <> "/erc20:"
          let contract = string.drop_start(selected, string.length(prefix))
          case
            string.starts_with(selected, prefix) && viem.is_address(contract)
          {
            False ->
              promise.resolve(
                Error(error.bad_request(
                  "Choose an asset on the configured network.",
                )),
              )
            True -> {
              use rpc <- promise.try_await(chain.require(chain, chain_id))
              use result <- promise.await(
                viem.token_read(rpc.client, contract, "decimals", []),
              )
              case result {
                Error(_) ->
                  promise.resolve(
                    Error(error.bad_request(
                      "Could not verify this token's decimals on-chain.",
                    )),
                  )
                Ok(value) ->
                  case js.as_int(value) {
                    Some(decimals) if decimals >= 0 && decimals <= 255 -> {
                      use symbol <- promise.await(
                        viem.token_read(rpc.client, contract, "symbol", []),
                      )
                      use name <- promise.await(
                        viem.token_read(rpc.client, contract, "name", []),
                      )
                      promise.resolve(
                        Ok(Asset(
                          chain_id,
                          Some(string.lowercase(contract)),
                          text(symbol, "Token", 32),
                          text(name, "ERC-20 token", 128),
                          decimals,
                        )),
                      )
                    }
                    _ ->
                      promise.resolve(
                        Error(error.bad_request("Invalid token decimals.")),
                      )
                  }
              }
            }
          }
        }
      }
  }
}

fn text(
  result: Result(js.Js, js.Exception),
  fallback: String,
  length: Int,
) -> String {
  case result {
    Ok(value) ->
      case js.as_string(value) {
        Some(value) if value != "" -> string.slice(value, 0, length)
        _ -> fallback
      }
    _ -> fallback
  }
}

pub fn transaction_to(asset: Asset, recipient: String) -> String {
  option.unwrap(asset.contract, recipient)
}

pub fn transaction_value(asset: Asset, atomic: String) -> String {
  case asset.contract {
    None -> atomic
    Some(_) -> "0"
  }
}

pub fn transaction_data(
  asset: Asset,
  recipient: String,
  atomic: String,
) -> String {
  case asset.contract {
    None -> "0x"
    Some(_) -> viem.encode_transfer(recipient, atomic)
  }
}

pub fn balance(
  chain: Chain,
  asset: Asset,
  address: String,
) -> Promise(Result(String, HttpError)) {
  case asset.contract {
    None ->
      promise.map(viem.balance(chain.client, address), fn(value) {
        result.replace_error(
          value,
          error.unavailable("Could not read the wallet balance."),
        )
      })
    Some(contract) -> {
      use outcome <- promise.await(
        viem.token_read(chain.client, contract, "balanceOf", [
          js.string(address),
        ]),
      )
      promise.resolve(case outcome {
        Ok(value) -> Ok(js.big_int_digits(value))
        Error(_) ->
          Error(error.unavailable("Could not read this token's balance."))
      })
    }
  }
}

pub fn balance_json(
  asset: Asset,
  address: String,
  balance: String,
) -> json.Json {
  json.object([
    #("asset", to_json(asset)),
    #("address", json.string(address)),
    #("balanceAtomic", json.string(balance)),
  ])
}

pub fn preflight(
  chain: Chain,
  asset: Asset,
  from: String,
  recipient: String,
  amount: String,
) -> Promise(Result(Nil, HttpError)) {
  case asset.contract {
    None -> promise.resolve(Ok(Nil))
    Some(_) -> {
      use fresh <- promise.try_await(resolve(
        Some(chain),
        asset.chain_id,
        Some(id(asset)),
      ))
      case fresh.decimals == asset.decimals {
        False ->
          promise.resolve(
            Error(error.conflict(
              "Token decimals changed. Create and review a new payment.",
            )),
          )
        True -> {
          use available <- promise.try_await(balance(chain, asset, from))
          let enough =
            string.length(available) > string.length(amount)
            || {
              string.length(available) == string.length(amount)
              && string.compare(available, amount) != order.Lt
            }
          case enough {
            False ->
              promise.resolve(
                Error(error.bad_request(
                  "Insufficient "
                  <> asset.symbol
                  <> " balance in the connected wallet.",
                )),
              )
            True -> {
              use result <- promise.await(viem.simulate_transfer(
                chain.client,
                from,
                transaction_to(asset, recipient),
                transaction_data(asset, recipient, amount),
              ))
              promise.resolve(case result {
                Ok(value) ->
                  case js.string_field(value, "data") {
                    // Some established tokens return no value, while standard ERC-20s return true.
                    None
                    | Some("0x")
                    | Some(
                        "0x0000000000000000000000000000000000000000000000000000000000000001",
                      ) -> Ok(Nil)
                    _ ->
                      Error(error.bad_request(
                        "This token refused the transfer.",
                      ))
                  }
                Error(_) ->
                  Error(error.bad_request(
                    "The token transfer could not be simulated. Check your balance and token restrictions.",
                  ))
              })
            }
          }
        }
      }
    }
  }
}
