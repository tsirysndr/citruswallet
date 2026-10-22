import gleam/int
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/string
import wallet/store.{type Store}

pub type Limiter {
  Limiter(store: Store, limit: Int, window: Int, proxy_hops: Int)
}

pub type Decision {
  Allowed(remaining: Int, resets_in: Int)
  Exceeded(resets_in: Int)
}

pub fn new(store: Store, limit: Int, proxy_hops: Int) -> Limiter {
  Limiter(store: store, limit: limit, window: 60_000, proxy_hops: proxy_hops)
}

pub fn check(limiter: Limiter, client: String, now now: Int) -> Decision {
  let window = now / limiter.window
  let expires = { window + 1 } * limiter.window
  let used =
    store.increment(
      limiter.store,
      namespace: "rate",
      key: client <> ":" <> int.to_string(window),
      expires: expires,
      now: now,
    )
  let resets_in = { expires - now + 999 } / 1000
  case used > limiter.limit {
    True -> Exceeded(resets_in)
    False -> Allowed(limiter.limit - used, resets_in)
  }
}

pub fn policy(limiter: Limiter) -> String {
  "\"default\";q="
  <> int.to_string(limiter.limit)
  <> ";w="
  <> int.to_string(limiter.window / 1000)
}

pub fn report(decision: Decision) -> String {
  let #(remaining, resets_in) = case decision {
    Allowed(remaining, resets_in) -> #(remaining, resets_in)
    Exceeded(resets_in) -> #(0, resets_in)
  }
  "\"default\";r="
  <> int.to_string(remaining)
  <> ";t="
  <> int.to_string(resets_in)
}

pub fn client(
  limiter: Limiter,
  socket: Option(String),
  forwarded: Option(String),
) -> String {
  let hops = case forwarded {
    Some(header) ->
      string.split(header, ",")
      |> list.map(string.trim)
      |> list.filter(fn(entry) { entry != "" })
      |> list.reverse
    None -> []
  }
  let addresses = [option.unwrap(socket, "unknown"), ..hops]
  let depth = int.min(limiter.proxy_hops, list.length(addresses) - 1)
  case list.drop(addresses, depth) {
    [address, ..] -> address
    [] -> "unknown"
  }
}
