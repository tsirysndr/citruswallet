import citruswallet/app
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
import gleam/list
import gleam/option.{Some}
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
    option.unwrap(node.environment("EVM_CHAIN_ID"), "4326"),
  ))
  use chain <- result.try(network.reader(network))
  use _ <- result.try(network.reader(network.mainnet))
  use _ <- result.try(network.reader(network.megaeth))
  use _ <- result.try(network.reader(network.megaeth_testnet))
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
  let other_networks = case network.chain_id {
    1 -> [network.megaeth, network.megaeth_testnet]
    4326 -> [network.mainnet, network.megaeth_testnet]
    6343 -> [network.mainnet, network.megaeth]
    _ -> []
  }
  let stop_other_notifications =
    list.map(other_networks, fn(other) {
      let other_payments =
        payments.new(
          store,
          linking.new(store, origin, other.chain_id),
          identity.resolver(),
          origin,
          other.chain_id,
          result.unwrap(network.reader(other), option.None),
        )
      notification.start(
        store.client,
        fn(id, did) { payments.get(other_payments, did, Some(id)) },
        other.chain_id,
      )
    })
  let cleanup = node.every(60_000, fn() { store.cleanup(store, node.now()) })
  let stop = fn() {
    stop_notifications()
    list.each(stop_other_notifications, fn(stop) { stop() })
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
