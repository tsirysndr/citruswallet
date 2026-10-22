import gleam/dynamic/decode
import wallet/drizzle/orm
import wallet/drizzle/schema/challenges
import wallet/drizzle/schema/kv
import wallet/drizzle/schema/links
import wallet/drizzle/schema/payments
import wallet/ffi/js.{type Js}

pub fn kv() -> Js {
  orm.underlying(kv.define(decode.success(Nil)).table)
}

pub fn challenges() -> Js {
  orm.underlying(challenges.define(decode.success(Nil)).table)
}

pub fn links() -> Js {
  orm.underlying(links.define(decode.success(Nil)).table)
}

pub fn payments() -> Js {
  orm.underlying(payments.define(decode.success(Nil)).table)
}
