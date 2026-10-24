import peachlet/chain
import peachlet/error.{type HttpError}
import peachlet/ffi/amounts
import peachlet/ffi/hono.{type Context}
import peachlet/ffi/js.{type Js}
import peachlet/ffi/node
import peachlet/ffi/viem
import peachlet/linking
import peachlet/validate
import peachlet/xrpc/context.{type Reply, type Server, Payload}
import gleam/javascript/promise.{type Promise}
import gleam/json
import gleam/option.{None, Some}
import gleam/result
import gleam/string

// Only bounded ETH and ERC-20 transfers are accepted, never arbitrary RPC URLs
// or contract deployment/simulation requests.
pub fn valid_transfer(
  from: String,
  to: String,
  value: String,
  data: String,
  nonce: Int,
) -> Bool {
  viem.is_address(from)
  && viem.is_address(to)
  && amounts.valid_atomic(value)
  && nonce >= 0
  && nonce <= 9_007_199_254_740_991
  && {
    data == "0x"
    || {
      value == "0"
      && string.starts_with(data, "0xa9059cbb000000000000000000000000")
      && validate.is_hex_quantity(data, 136)
    }
  }
}

pub fn estimate(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  use body <- promise.try_await(context.read_body(ctx))
  let from =
    js.string_field(body, "from") |> option.unwrap("") |> string.lowercase
  let to = js.string_field(body, "to") |> option.unwrap("") |> string.lowercase
  let value = js.string_field(body, "value") |> option.unwrap("")
  let data =
    js.string_field(body, "data") |> option.unwrap("") |> string.lowercase
  let nonce = js.int_field(body, "nonce") |> option.unwrap(-1)
  let chain_id = server.settings.network.chain_id
  use _ <- context.attempt(
    case
      js.int_field(body, "chainId") == Some(chain_id)
      && valid_transfer(from, to, value, data, nonce)
    {
      True -> Ok(Nil)
      False ->
        Error(error.bad_request(
          "Invalid transfer or selected network mismatch.",
        ))
    },
  )
  use _ <- context.attempt(
    case linking.find(server.links, did:, address: from, chain_id:) {
      Some(_) -> Ok(Nil)
      None ->
        Error(error.forbidden(
          "Choose a wallet linked to your account on this network.",
        ))
    },
  )
  use reader <- promise.try_await(chain.require(server.settings.chain, chain_id))
  use fees <- promise.try_await(
    viem.estimate_fees(reader.client)
    |> promise.map(
      result.map_error(_, fn(_) {
        error.unavailable("Could not estimate network fees. Try again.")
      }),
    ),
  )
  use #(max_fee, priority) <- context.attempt(fee_fields(fees))
  let parameters =
    js.object([
      #("account", js.string(from)),
      #("to", js.string(to)),
      #("value", js.big_int(value)),
      #("data", js.string(data)),
      #("nonce", js.int(nonce)),
      #("blockTag", js.string("pending")),
      #("maxFeePerGas", js.big_int(max_fee)),
      #("maxPriorityFeePerGas", js.big_int(priority)),
    ])
  use gas <- promise.try_await(
    viem.estimate_gas(reader.client, parameters)
    |> promise.map(
      result.map_error(_, fn(_) {
        error.unavailable(
          "Transfer simulation failed. Check your balance and try again.",
        )
      }),
    ),
  )
  use _ <- context.attempt(case amounts.valid_atomic(gas) && gas != "0" {
    True -> Ok(Nil)
    False -> Error(error.unavailable("Invalid gas estimate from the network."))
  })
  context.done(
    Ok(Payload(
      200,
      json.object([
        #("chainId", json.int(chain_id)),
        #("from", json.string(from)),
        #("to", json.string(to)),
        #("value", json.string(value)),
        #("data", json.string(data)),
        #("nonce", json.int(nonce)),
        #("gasLimit", json.string(gas)),
        #("maxFeePerGas", json.string(max_fee)),
        #("maxPriorityFeePerGas", json.string(priority)),
        #("maxFeeWei", json.string(js.multiply_integers(gas, max_fee))),
        #("expiresAt", json.int(node.now() + 60_000)),
      ]),
    )),
  )
}

fn fee_fields(fees: Js) -> Result(#(String, String), HttpError) {
  case
    js.attempt(fn() {
      #(
        js.big_int_digits(js.get(fees, "maxFeePerGas")),
        js.big_int_digits(js.get(fees, "maxPriorityFeePerGas")),
      )
    })
  {
    Ok(#(max_fee, priority)) ->
      case amounts.valid_atomic(max_fee) && amounts.valid_atomic(priority) {
        True -> Ok(#(max_fee, priority))
        False -> Error(error.unavailable("Invalid network fee response."))
      }
    Error(_) -> Error(error.unavailable("Invalid network fee response."))
  }
}
