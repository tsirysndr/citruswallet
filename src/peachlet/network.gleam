import gleam/json.{type Json}
import gleam/list
import gleam/option.{Some}
import gleam/result
import peachlet/chain
import peachlet/ffi/node
import peachlet/ffi/url

pub type Currency {
  Currency(name: String, symbol: String, decimals: Int)
}

pub type Network {
  Network(
    chain_id: Int,
    chain_id_hex: String,
    name: String,
    rpc_urls: List(String),
    native_currency: Currency,
  )
}

pub const mainnet =
  Network(
    chain_id: 1,
    chain_id_hex: "0x1",
    name: "Ethereum mainnet",
    rpc_urls: ["https://ethereum-rpc.publicnode.com"],
    native_currency: Currency(name: "Ether", symbol: "ETH", decimals: 18),
  )

pub const megaeth =
  Network(
    4326,
    "0x10e6",
    "MegaETH",
    ["https://mainnet.megaeth.com/rpc"],
    Currency("Ether", "ETH", 18),
  )

pub const megaeth_testnet =
  Network(
    6343,
    "0x18c7",
    "MegaETH testnet",
    ["https://carrot.megaeth.com/rpc"],
    Currency("Testnet Ether", "ETH", 18),
  )

pub fn reader(network: Network) {
  let variable = case network.chain_id {
    4326 -> "MEGAETH_RPC_URL"
    6343 -> "MEGAETH_TESTNET_RPC_URL"
    _ -> "ETH_RPC_URL"
  }
  case node.environment(variable), network.rpc_urls {
    Some(rpc), _ -> result.map(chain.reader(rpc), Some)
    _, [rpc, ..] -> result.map(chain.reader(rpc), Some)
    _, _ -> Ok(option.None)
  }
}

pub const anvil =
  Network(
    chain_id: 31_337,
    chain_id_hex: "0x7a69",
    name: "Anvil local",
    rpc_urls: ["http://127.0.0.1:8545"],
    native_currency: Currency(name: "Local Ether", symbol: "ETH", decimals: 18),
  )

pub fn configured(origin: String, chain_id: String) -> Result(Network, String) {
  case chain_id, loopback(origin) {
    "1", _ -> Ok(mainnet)
    "4326", _ -> Ok(megaeth)
    "6343", _ -> Ok(megaeth_testnet)
    "31337", True -> Ok(anvil)
    _, _ ->
      Error(
        "EVM_CHAIN_ID must be 4326, 6343, 1, or 31337 with a loopback APP_URL for Anvil development.",
      )
  }
}

fn loopback(origin: String) -> Bool {
  case url.parse(origin) {
    Ok(parsed) -> url.hostname(parsed) == "127.0.0.1"
    Error(_) -> False
  }
}

pub fn to_json(network: Network) -> Json {
  let currency = network.native_currency
  json.object(
    list.append(
      [
        #("chainId", json.int(network.chain_id)),
        #("chainIdHex", json.string(network.chain_id_hex)),
        #("name", json.string(network.name)),
        #(
          "nativeCurrency",
          json.object([
            #("name", json.string(currency.name)),
            #("symbol", json.string(currency.symbol)),
            #("decimals", json.int(currency.decimals)),
          ]),
        ),
      ],
      case network.rpc_urls {
        [] -> []
        urls -> [#("rpcUrls", json.array(urls, json.string))]
      },
    ),
  )
}
