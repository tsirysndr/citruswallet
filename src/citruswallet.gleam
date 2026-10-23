import citruswallet/app
import citruswallet/chain.{type Chain}
import citruswallet/directory
import citruswallet/ffi/hono
import citruswallet/ffi/node
import citruswallet/ffi/url
import citruswallet/identity
import citruswallet/jetstream
import citruswallet/linking
import citruswallet/network.{type Network}
import citruswallet/oauth
import citruswallet/payments
import citruswallet/store.{type Store}
import citruswallet/xrpc/context
import citruswallet/xrpc/notification
import gleam/int
import gleam/javascript/promise
import gleam/option.{type Option, None, Some}
import gleam/result

pub fn main() -> Nil {
  case start() {
    Ok(_) -> Nil
    Error(reason) -> {
      node.log_error(reason)
      node.exit(1)
    }
  }
}

fn start() -> Result(Nil, String) {
  let port =
    node.environment("PORT")
    |> option.then(fn(value) { option.from_result(int.parse(value)) })
    |> option.unwrap(4747)
  let origin =
    option.unwrap(
      node.environment("APP_URL"),
      "http://127.0.0.1:" <> int.to_string(port),
    )
  use _ <- result.try(check_origin(origin))
  use network <- result.try(network.configured(
    origin,
    option.unwrap(node.environment("EVM_CHAIN_ID"), "1"),
  ))
  use chain <- result.try(reader(network))
  use directory <- result.try(
    directory.appview(option.unwrap(
      node.environment("APPVIEW_URL"),
      "https://public.api.bsky.app",
    )),
  )
  use signup_provider <- result.try(
    oauth.provider(option.unwrap(
      node.environment("SIGNUP_PDS"),
      "https://selfhosted.social",
    )),
  )
  use store <- result.try(database(network))
  let app =
    app.build(context.Settings(
      store: store,
      oauth: oauth.client(store, origin),
      origin: origin,
      proxy_hops: node.environment("TRUST_PROXY_HOPS")
        |> option.then(fn(value) { option.from_result(int.parse(value)) })
        |> option.unwrap(0),
      network: network,
      identities: identity.resolver(),
      directory: directory,
      signup_provider: signup_provider,
      chain: chain,
      public_directory: option.unwrap(
        node.environment("PUBLIC_DIR"),
        "./web/dist",
      ),
    ))
  use listener <- result.try(
    result.map_error(jetstream.start(store, directory, origin), fn(reason) {
      reason.message
    }),
  )
  let host = option.unwrap(node.environment("HOST"), "127.0.0.1")
  let server =
    hono.listen(app, port, host, fn() {
      node.log(
        "Citrus Wallet running at "
        <> origin
        <> " · "
        <> network.name
        <> " ("
        <> int.to_string(network.chain_id)
        <> ")",
      )
    })
  let notification_payments =
    payments.new(
      store,
      linking.new(store, origin, network.chain_id),
      identity.resolver(),
      origin,
      network.chain_id,
      chain,
    )
  let stop_notifications =
    notification.start(
      store.client,
      fn(id, did) { payments.get(notification_payments, did, Some(id)) },
      network.chain_id,
    )
  let cleanup = node.every(60_000, fn() { store.cleanup(store, node.now()) })
  let stop = fn() {
    stop_notifications()
    node.cancel(cleanup)
    let _ =
      promise.map(jetstream.stop(listener), fn(_) {
        hono.shutdown(server, fn() {
          store.close(store)
          node.exit(0)
        })
      })
    Nil
  }
  node.on_signal("SIGINT", stop)
  node.on_signal("SIGTERM", stop)
  Ok(Nil)
}

fn check_origin(origin: String) -> Result(Nil, String) {
  let refusal =
    "APP_URL must be an HTTPS origin, or http://127.0.0.1:PORT for development, without a trailing slash."
  use parsed <- result.try(result.replace_error(url.parse(origin), refusal))
  case
    url.origin(parsed) == origin,
    url.protocol(parsed),
    url.hostname(parsed)
  {
    True, "https:", _ -> Ok(Nil)
    True, "http:", "127.0.0.1" -> Ok(Nil)
    _, _, _ -> Error(refusal)
  }
}

fn reader(network: Network) -> Result(Option(Chain), String) {
  case node.environment("ETH_RPC_URL"), network.rpc_urls {
    Some(rpc_url), _ -> result.map(chain.reader(rpc_url), Some)
    None, [rpc_url, ..] -> result.map(chain.reader(rpc_url), Some)
    None, [] -> Ok(None)
  }
}

fn database(network: Network) -> Result(Store, String) {
  let path =
    node.absolute(
      option.unwrap(node.environment("DATABASE_PATH"), case network.chain_id {
        31_337 -> "./data/local.sqlite"
        _ -> "./data/wallet.sqlite"
      }),
    )
  node.umask(0o077)
  use _ <- result.try(result.replace_error(
    node.make_directory(node.parent(path), 0o700),
    "Could not create the database directory at " <> node.parent(path) <> ".",
  ))
  let migrations =
    option.unwrap(node.environment("MIGRATIONS_DIR"), "./drizzle")
  use store <- result.try(result.replace_error(
    store.open(path, migrations: migrations),
    "Could not open or migrate the database at " <> path <> ".",
  ))
  let _ = node.set_mode(path, 0o600)
  Ok(store)
}
