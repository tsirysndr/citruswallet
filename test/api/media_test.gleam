import gleam/json
import gleam/list
import gleam/option.{None, Some}
import gleam/string
import peachlet/payment_media

fn media(kind: String, slug: String, title: String, url: String) {
  Some(
    json.to_string(
      json.object([
        #("kind", json.string(kind)),
        #("slug", json.string(slug)),
        #("title", json.string(title)),
        #("url", json.string(url)),
        #("preview", json.string("https://static.klipy.com/preview.webp")),
      ]),
    ),
  )
}

pub fn valid_media_kinds_and_absent_attachments_are_accepted_test() {
  assert payment_media.valid(None)
  list.each(["gifs", "stickers", "static-memes", "clips"], fn(kind) {
    assert payment_media.valid(media(
      kind,
      "thanks",
      "Thanks",
      "https://static1.klipy.com/image.webp",
    ))
  })
}

pub fn media_rejects_unsafe_or_lookalike_hosts_test() {
  list.each(
    [
      "http://static.klipy.com/image",
      "https://static.klipy.com.evil.test/image",
      "https://static.klipy.com@evil.test/image",
      "https://static.klipy.com:444/image",
      "https://static.klipy.com/\\evil.test/image",
      "https://static.klipy.com/a b", "javascript:alert(1)",
      "data:image/png;base64,abc",
    ],
    fn(url) {
      assert !payment_media.valid(media("gifs", "thanks", "Thanks", url))
    },
  )
}

pub fn media_limits_count_utf8_bytes_and_require_a_known_schema_test() {
  let url = "https://static.klipy.com/image.webp"
  assert payment_media.valid(media(
    "gifs",
    string.repeat("é", 100),
    string.repeat("é", 150),
    url,
  ))
  assert !payment_media.valid(media(
    "gifs",
    string.repeat("é", 101),
    "Title",
    url,
  ))
  assert !payment_media.valid(media(
    "gifs",
    "slug",
    string.repeat("é", 151),
    url,
  ))
  assert !payment_media.valid(media("unknown", "slug", "Title", url))
  assert !payment_media.valid(media("gifs", "", "Title", url))
  assert !payment_media.valid(Some("{}"))
  assert !payment_media.valid(Some("not json"))
}
