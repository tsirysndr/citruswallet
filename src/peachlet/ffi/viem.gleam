import peachlet/ffi/js.{type Exception, type Js}
import gleam/int
import gleam/javascript/promise.{type Promise}
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/string

@external(javascript, "viem", "isAddress")
pub fn is_address(value: String) -> Bool

@external(javascript, "viem", "getAddress")
fn get_address(value: String) -> String

pub fn checksum(address: String) -> String {
  case js.attempt(fn() { get_address(address) }) {
    Ok(checksummed) -> checksummed
    Error(_) -> address
  }
}

@external(javascript, "viem", "formatEther")
fn format_ether(wei: Js) -> String

pub fn to_ether(wei: String) -> String {
  format_ether(js.big_int(wei))
}

@external(javascript, "viem", "parseEther")
fn parse_ether(ether: String) -> Js

pub fn to_wei(ether: String) -> Result(String, Nil) {
  case js.attempt(fn() { js.big_int_digits(parse_ether(ether)) }) {
    Ok(wei) -> Ok(wei)
    Error(_) -> Error(Nil)
  }
}

@external(javascript, "viem", "toHex")
fn to_hex(value: Js) -> String

pub fn hex_of_int(value: Int) -> String {
  to_hex(js.int(value))
}

pub fn hex_of_wei(wei: String) -> String {
  to_hex(js.big_int(wei))
}

@external(javascript, "viem", "verifyMessage")
fn verify_message_raw(parameters: Js) -> Js

pub fn verify_message(
  address address: String,
  message message: String,
  signature signature: String,
) -> Promise(Bool) {
  let settled =
    js.attempt_promise(
      verify_message_raw(
        js.object([
          #("address", js.string(address)),
          #("message", js.string(message)),
          #("signature", js.string(signature)),
        ]),
      ),
    )
  promise.map(settled, fn(outcome) {
    case outcome {
      Ok(valid) -> option.unwrap(js.as_bool(valid), False)
      Error(_) -> False
    }
  })
}

pub type Siwe {
  Siwe(
    domain: String,
    address: String,
    chain_id: Int,
    uri: String,
    nonce: String,
    issued_at: Int,
    expiration_time: Int,
    statement: String,
    resources: List(String),
  )
}

@external(javascript, "viem/siwe", "createSiweMessage")
fn create_siwe_message(parameters: Js) -> String

pub fn siwe_message(message: Siwe) -> String {
  create_siwe_message(
    js.object([
      #("domain", js.string(message.domain)),
      #("address", js.string(message.address)),
      #("chainId", js.int(message.chain_id)),
      #("version", js.string("1")),
      #("uri", js.string(message.uri)),
      #("nonce", js.string(message.nonce)),
      #("issuedAt", date(message.issued_at)),
      #("expirationTime", date(message.expiration_time)),
      #("statement", js.string(message.statement)),
      #("resources", js.list(list.map(message.resources, js.string))),
    ]),
  )
}

@external(javascript, "viem/siwe", "parseSiweMessage")
fn parse_siwe_message(message: String) -> Js

pub fn siwe_chain_id(message: String) -> Option(Int) {
  case js.attempt(fn() { parse_siwe_message(message) }) {
    Ok(parsed) -> js.int_field(parsed, "chainId")
    Error(_) -> None
  }
}

fn date(milliseconds: Int) -> Js {
  js.construct(js.global("Date"), [js.int(milliseconds)])
}

pub type Client =
  Js

@external(javascript, "viem", "createPublicClient")
fn create_public_client(parameters: Js) -> Client

@external(javascript, "viem", "http")
fn http(url: String, options: Js) -> Js

pub fn client(rpc_url: String) -> Client {
  create_public_client(
    js.object([
      #(
        "transport",
        http(
          rpc_url,
          js.object([#("timeout", js.int(5000)), #("retryCount", js.int(0))]),
        ),
      ),
    ]),
  )
}

pub fn chain_id(client: Client) -> Promise(Result(Int, Exception)) {
  read(client, "getChainId", [], fn(value) { js.as_int(value) })
}

pub fn transaction_count(
  client: Client,
  address: String,
) -> Promise(Result(Int, Exception)) {
  let parameters =
    js.object([
      #("address", js.string(address)),
      #("blockTag", js.string("pending")),
    ])
  read(client, "getTransactionCount", [parameters], fn(value) {
    js.as_int(value)
  })
}

pub fn block_number(client: Client) -> Promise(Result(Int, Exception)) {
  let parameters = js.object([#("cacheTime", js.int(0))])
  read(client, "getBlockNumber", [parameters], fn(value) {
    option.from_result(int.parse(js.big_int_digits(value)))
  })
}

pub fn transaction(
  client: Client,
  hash: String,
) -> Promise(Result(Js, Exception)) {
  let parameters = js.object([#("hash", js.string(hash))])
  read(client, "getTransaction", [parameters], fn(value) { Some(value) })
}

pub fn transaction_receipt(
  client: Client,
  hash: String,
) -> Promise(Result(Js, Exception)) {
  let parameters = js.object([#("hash", js.string(hash))])
  read(client, "getTransactionReceipt", [parameters], fn(value) { Some(value) })
}

fn read(
  client: Client,
  method: String,
  arguments: List(Js),
  convert: fn(Js) -> Option(a),
) -> Promise(Result(a, Exception)) {
  let settled = js.attempt_promise(js.call(client, method, arguments))
  promise.map(settled, fn(outcome) {
    case outcome {
      Error(reason) -> Error(reason)
      Ok(value) ->
        case convert(value) {
          Some(converted) -> Ok(converted)
          None ->
            Error(js.Exception(
              name: "RpcShapeError",
              message: "Unexpected " <> method <> " response.",
            ))
        }
    }
  })
}

@external(javascript, "../../asset-bindings.mjs", "erc20ABI")
fn erc20_abi() -> Js

@external(javascript, "../../asset-bindings.mjs", "encodeTransfer")
pub fn encode_transfer(recipient: String, amount: String) -> String

@external(javascript, "../../asset-bindings.mjs", "decodeTransfer")
pub fn decode_transfer(log: Js) -> Js

pub fn token_read(
  client: Client,
  contract: String,
  method: String,
  args: List(Js),
) -> Promise(Result(Js, Exception)) {
  js.attempt_promise(
    js.call(client, "readContract", [
      js.object([
        #("address", js.string(contract)),
        #("abi", erc20_abi()),
        #("functionName", js.string(method)),
        #("args", js.list(args)),
      ]),
    ]),
  )
}

pub fn balance(
  client: Client,
  address: String,
) -> Promise(Result(String, Exception)) {
  use value <- promise.try_await(
    js.attempt_promise(
      js.call(client, "getBalance", [
        js.object([#("address", js.string(address))]),
      ]),
    ),
  )
  promise.resolve(Ok(js.big_int_digits(value)))
}

pub fn simulate_transfer(
  client: Client,
  from: String,
  to: String,
  data: String,
) -> Promise(Result(Js, Exception)) {
  js.attempt_promise(
    js.call(client, "call", [
      js.object([
        #("account", js.string(from)),
        #("to", js.string(to)),
        #("data", js.string(data)),
        #("value", js.big_int("0")),
        #("blockTag", js.string("pending")),
      ]),
    ]),
  )
}

pub fn estimate_fees(client: Client) -> Promise(Result(Js, Exception)) {
  read(
    client,
    "estimateFeesPerGas",
    [js.object([#("type", js.string("eip1559"))])],
    fn(value) { Some(value) },
  )
}

pub fn estimate_gas(
  client: Client,
  parameters: Js,
) -> Promise(Result(String, Exception)) {
  read(client, "estimateGas", [parameters], fn(value) {
    Some(js.big_int_digits(value))
  })
}

pub fn received_token_logs(
  client: Client,
  address: String,
) -> Promise(Result(Js, Exception)) {
  read(
    client,
    "request",
    [
      js.object([
        #("method", js.string("eth_getLogs")),
        #(
          "params",
          js.list([
            js.object([
              #("fromBlock", js.string("0x0")),
              #("toBlock", js.string("latest")),
              #(
                "topics",
                js.list([
                  js.string(
                    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
                  ),
                  js.null(),
                  js.string(
                    "0x000000000000000000000000"
                    <> string.drop_start(address, 2),
                  ),
                ]),
              ),
            ]),
          ]),
        ),
      ]),
    ],
    fn(value) { Some(value) },
  )
}
