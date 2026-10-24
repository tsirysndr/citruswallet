import gleam/dynamic/decode
import peachlet/drizzle/orm.{underlying}
import peachlet/drizzle/schema/address_repository_records
import peachlet/drizzle/schema/challenges
import peachlet/drizzle/schema/kv
import peachlet/drizzle/schema/links
import peachlet/drizzle/schema/notifications as notification_schema
import peachlet/drizzle/schema/payments
import peachlet/drizzle/schema/user_profiles
import peachlet/ffi/js.{type Js}

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

pub fn notifications() -> Js {
  underlying(notification_schema.notifications())
}

pub fn push_devices() -> Js {
  underlying(notification_schema.push_devices())
}

pub fn push_deliveries() -> Js {
  underlying(notification_schema.push_deliveries())
}
