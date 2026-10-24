import gleam/javascript/promise.{type Promise}
import peachlet/ffi/js.{type Js}

@external(javascript, "../../notification_transport.mjs", "closeStreams")
pub fn close_streams() -> Nil

@external(javascript, "../../notification_transport.mjs", "generateKeys")
pub fn generate_keys() -> Js

@external(javascript, "../../notification_transport.mjs", "validPublicKey")
pub fn valid_public_key(key: String) -> Bool

@external(javascript, "../../notification_transport.mjs", "sendWeb")
pub fn send_web(subscription: Js, payload: String, options: Js) -> Promise(Js)

@external(javascript, "../../notification_transport.mjs", "invoke")
pub fn invoke(callback: Js, args: Js) -> Promise(Js)

@external(javascript, "../../notification_transport.mjs", "stream")
pub fn stream(context: Js, key: String, limit: Int, poll: fn() -> Js) -> Js

@external(javascript, "../../notification_transport.mjs", "every")
pub fn every(
  milliseconds: Int,
  callback: fn(fn() -> Bool) -> Promise(Nil),
) -> fn() -> Nil
