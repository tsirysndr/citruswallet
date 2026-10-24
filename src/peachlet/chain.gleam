import peachlet/error.{type HttpError}
import peachlet/ffi/js.{type Js}
import peachlet/ffi/url
import peachlet/ffi/viem
import gleam/dynamic/decode
import gleam/int
import gleam/javascript/promise.{type Promise}
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result

pub type Chain {
  Chain(client: viem.Client)
}

pub type Transaction {
  Transaction(
    from: String,
    to: Option(String),
    value: String,
    input: String,
    nonce: Int,
    chain_id: Option(Int),
  )
}

pub type Receipt {
  Receipt(status: String, block_number: Int, logs: List(Js))
}

const loopback_hosts = ["127.0.0.1", "localhost", "[::1]"]

pub fn reader(rpc_url: String) -> Result(Chain, String) {
  let refusal = "ETH_RPC_URL must use HTTPS or loopback HTTP."
  case url.parse(rpc_url) {
    Error(_) -> Error(refusal)
    Ok(parsed) ->
      case
        url.protocol(parsed),
        list.contains(loopback_hosts, url.hostname(parsed))
      {
        "https:", _ | "http:", True -> Ok(Chain(viem.client(rpc_url)))
        _, _ -> Error(refusal)
      }
  }
}

pub fn require(
  chain: Option(Chain),
  chain_id: Int,
) -> Promise(Result(Chain, HttpError)) {
  case chain {
    None ->
      promise.resolve(
        Error(error.unavailable(
          "Configure ETH_RPC_URL on the server to enable verified ETH payments.",
        )),
      )
    Some(chain) ->
      promise.map(viem.chain_id(chain.client), fn(outcome) {
        case outcome {
          Error(_) -> Error(unreachable())
          Ok(actual) if actual == chain_id -> Ok(chain)
          Ok(_) ->
            Error(error.unavailable(
              "Ethereum RPC chain does not match the payment network.",
            ))
        }
      })
  }
}

pub fn nonce(chain: Chain, address: String) -> Promise(Result(Int, HttpError)) {
  promise.map(viem.transaction_count(chain.client, address), fn(outcome) {
    case outcome {
      Ok(nonce) -> Ok(nonce)
      Error(_) -> Error(unreachable())
    }
  })
}

pub fn block_number(chain: Chain) -> Promise(Result(Int, HttpError)) {
  promise.map(viem.block_number(chain.client), fn(outcome) {
    case outcome {
      Ok(height) -> Ok(height)
      Error(_) -> Error(unreachable())
    }
  })
}

pub fn transaction(
  chain: Chain,
  hash: String,
) -> Promise(Result(Option(Transaction), HttpError)) {
  promise.map(viem.transaction(chain.client, hash), fn(outcome) {
    case outcome {
      Ok(found) -> Ok(decode_transaction(found))
      Error(reason) ->
        case reason.name {
          "TransactionNotFoundError" -> Ok(None)
          _ -> Error(unreachable())
        }
    }
  })
}

pub fn receipt(
  chain: Chain,
  hash: String,
) -> Promise(Result(Option(Receipt), HttpError)) {
  promise.map(viem.transaction_receipt(chain.client, hash), fn(outcome) {
    case outcome {
      Ok(found) -> Ok(decode_receipt(found))
      Error(reason) ->
        case reason.name {
          "TransactionReceiptNotFoundError" -> Ok(None)
          _ -> Error(unreachable())
        }
    }
  })
}

fn decode_transaction(found: Js) -> Option(Transaction) {
  use from <- option.then(js.string_field(found, "from"))
  use nonce <- option.then(js.int_field(found, "nonce"))
  use value <- option.then(option.map(
    js.field(found, "value"),
    js.big_int_digits,
  ))
  Some(Transaction(
    from: from,
    to: js.string_field(found, "to"),
    value: value,
    input: option.unwrap(js.string_field(found, "input"), ""),
    nonce: nonce,
    chain_id: js.int_field(found, "chainId"),
  ))
}

fn decode_receipt(found: Js) -> Option(Receipt) {
  use status <- option.then(js.string_field(found, "status"))
  use height <- option.then(option.map(
    js.field(found, "blockNumber"),
    js.big_int_digits,
  ))
  use height <- option.then(option.from_result(int.parse(height)))
  Some(
    Receipt(
      status: status,
      block_number: height,
      logs: case js.field(found, "logs") {
        Some(value) ->
          decode.run(value, decode.list(decode.dynamic)) |> result.unwrap([])
        None -> []
      },
    ),
  )
}

fn unreachable() -> HttpError {
  error.unavailable(
    "Ethereum RPC is unavailable. No transaction was requested.",
  )
}
