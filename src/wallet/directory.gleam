import gleam/dynamic/decode.{type Decoder}
import gleam/int
import gleam/javascript/promise.{type Promise}
import gleam/json.{type Json}
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/string
import wallet/error.{type HttpError}
import wallet/ffi/atproto
import wallet/ffi/http
import wallet/ffi/url
import wallet/identity

pub type Actor {
  Actor(
    did: String,
    handle: String,
    display_name: Option(String),
    avatar: Option(String),
  )
}

pub type Search =
  fn(String) -> Promise(Result(List(Actor), HttpError))

pub const avatar_hosts = ["cdn.bsky.app"]

pub const suggestions = 8

const max_display_name = 64

pub fn appview(base_url: String) -> Result(Search, String) {
  let refusal = "APPVIEW_URL must be an HTTPS origin, or loopback HTTP."
  case url.parse(base_url) {
    Error(_) -> Error(refusal)
    Ok(parsed) ->
      case url.protocol(parsed), url.hostname(parsed) {
        "https:", _ | "http:", "127.0.0.1" | "http:", "localhost" ->
          Ok(fn(query) { typeahead(url.origin(parsed), query) })
        _, _ -> Error(refusal)
      }
  }
}

fn typeahead(
  origin: String,
  query: String,
) -> Promise(Result(List(Actor), HttpError)) {
  let endpoint =
    origin
    <> "/xrpc/app.bsky.actor.searchActorsTypeahead?limit="
    <> int.to_string(suggestions)
    <> "&q="
    <> url.encode_component(query)
  use body <- promise.map(http.get_json(endpoint, timeout: 4000))
  case body {
    Error(_) ->
      Error(error.HttpError(
        502,
        "Handle suggestions are unavailable right now.",
      ))
    Ok(body) ->
      case decode.run(body, decoder()) {
        Ok(actors) ->
          Ok(list.take(list.filter_map(actors, accept), suggestions))
        Error(_) -> Ok([])
      }
  }
}

fn decoder() -> Decoder(List(Actor)) {
  let actor = {
    use did <- decode.field("did", decode.string)
    use handle <- decode.field("handle", decode.string)
    use display_name <- decode.optional_field(
      "displayName",
      None,
      decode.optional(decode.string),
    )
    use avatar <- decode.optional_field(
      "avatar",
      None,
      decode.optional(decode.string),
    )
    decode.success(Actor(did, handle, display_name, avatar))
  }
  decode.at(["actors"], decode.list(actor))
}

/// Drops anything the app would refuse to address anyway, and keeps only an
/// avatar the page's own content policy permits.
pub fn vetted(actors: List(Actor)) -> List(Actor) {
  actors
  |> list.filter_map(accept)
  |> list.take(suggestions)
}

fn accept(actor: Actor) -> Result(Actor, Nil) {
  let handle = string.lowercase(actor.handle)
  case
    atproto.is_valid_did(actor.did)
    && identity.supported_method(actor.did)
    && atproto.is_valid_handle(handle)
  {
    False -> Error(Nil)
    True ->
      Ok(Actor(
        did: actor.did,
        handle: handle,
        display_name: name_of(actor.display_name),
        avatar: avatar_of(actor.avatar),
      ))
  }
}

fn name_of(display_name: Option(String)) -> Option(String) {
  use name <- option.then(display_name)
  case string.trim(name) {
    "" -> None
    name -> Some(string.slice(name, 0, max_display_name))
  }
}

fn avatar_of(avatar: Option(String)) -> Option(String) {
  use raw <- option.then(avatar)
  use parsed <- option.then(option.from_result(url.parse(raw)))
  case
    url.protocol(parsed) == "https:"
    && list.contains(avatar_hosts, url.hostname(parsed))
  {
    True -> Some(raw)
    False -> None
  }
}

pub fn to_json(actor: Actor) -> Json {
  json.object([
    #("did", json.string(actor.did)),
    #("handle", json.string(actor.handle)),
    #("displayName", json.nullable(actor.display_name, json.string)),
    #("avatar", json.nullable(actor.avatar, json.string)),
  ])
}
