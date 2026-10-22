import citruswallet/drizzle/orm.{underlying}
import citruswallet/drizzle/schema/address_repository_records
import citruswallet/drizzle/schema/challenges
import citruswallet/drizzle/schema/kv
import citruswallet/drizzle/schema/links
import citruswallet/drizzle/schema/payments
import citruswallet/drizzle/schema/user_profiles
import citruswallet/ffi/js.{type Js}
import gleam/dynamic/decode

pub fn kv() -> Js {
  underlying(kv.define(decode.success(Nil)).table)
}

pub fn challenges() -> Js {
  underlying(challenges.define(decode.success(Nil)).table)
}

pub fn links() -> Js {
  underlying(links.define(decode.success(Nil)).table)
}

pub fn payments() -> Js {
  underlying(payments.define(decode.success(Nil)).table)
}

pub fn user_profiles() -> Js {
  underlying(user_profiles.define(decode.success(Nil)).table)
}

pub fn address_repository_records() -> Js {
  underlying(address_repository_records.define(decode.success(Nil)))
}
