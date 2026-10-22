import citruswallet/drizzle/orm
import citruswallet/drizzle/schema/challenges
import citruswallet/drizzle/schema/kv
import citruswallet/drizzle/schema/links
import citruswallet/drizzle/schema/payments
import citruswallet/drizzle/schema/user_profiles
import citruswallet/ffi/js.{type Js}
import gleam/dynamic/decode

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

pub fn user_profiles() -> Js {
  orm.underlying(user_profiles.define(decode.success(Nil)).table)
}
