import gleam/dynamic/decode
import gleam/json
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/string

type Media {
  Media(kind: String, slug: String, url: String, preview: String, title: String)
}

fn decoder() {
  use kind <- decode.field("kind", decode.string)
  use slug <- decode.field("slug", decode.string)
  use url <- decode.field("url", decode.string)
  use preview <- decode.field("preview", decode.string)
  use title <- decode.field("title", decode.string)
  decode.success(Media(kind, slug, url, preview, title))
}

fn safe_url(url: String) -> Bool {
  string.byte_size(url) <= 2048
  && list.any(
    ["static.klipy.com", "static1.klipy.com", "static2.klipy.com"],
    fn(host) { string.starts_with(url, "https://" <> host <> "/") },
  )
  && !list.any(["\\", "\n", "\r", "\t", " "], fn(char) {
    string.contains(url, char)
  })
}

pub fn valid(value: Option(String)) -> Bool {
  case value {
    None -> True
    Some(value) ->
      case json.parse(value, decoder()) {
        Error(_) -> False
        Ok(media) ->
          list.contains(
            ["gifs", "stickers", "static-memes", "clips"],
            media.kind,
          )
          && string.byte_size(media.slug) > 0
          && string.byte_size(media.slug) <= 200
          && string.byte_size(media.title) <= 300
          && safe_url(media.url)
          && safe_url(media.preview)
      }
  }
}

pub fn to_json(value: Option(String)) -> json.Json {
  let media =
    value
    |> option.then(fn(value) {
      json.parse(value, decoder()) |> option.from_result
    })
  json.nullable(media, fn(media) {
    json.object([
      #("kind", json.string(media.kind)),
      #("slug", json.string(media.slug)),
      #("url", json.string(media.url)),
      #("preview", json.string(media.preview)),
      #("title", json.string(media.title)),
    ])
  })
}
