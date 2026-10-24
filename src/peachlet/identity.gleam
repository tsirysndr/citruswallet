import gleam/bool
import gleam/javascript/promise.{type Promise}
import gleam/json.{type Json}
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string
import peachlet/error.{type HttpError}
import peachlet/ffi/atproto
import peachlet/ffi/js

pub type Identity {
  Identity(did: String, handle: Option(String))
}

pub type Lookup =
  fn(Option(String)) -> Promise(Result(Identity, HttpError))

const supported_methods = ["did:plc:", "did:web:"]

pub fn normalize(value: Option(String)) -> Result(String, HttpError) {
  use value <- result.try(option.to_result(
    value,
    error.bad_request("Enter an AT Protocol handle or DID."),
  ))
  let input = case string.trim(value) {
    "@" <> handle -> handle
    other -> other
  }
  case is_did(input) {
    True -> {
      use <- bool.guard(
        when: string.length(input) > 2048
          || !atproto.is_valid_did(input)
          || !supported_method(input),
        return: Error(error.bad_request("Invalid AT Protocol DID.")),
      )
      Ok(input)
    }
    False -> {
      let handle = string.lowercase(input)
      use <- bool.guard(
        when: !atproto.is_valid_handle(handle),
        return: Error(error.bad_request("Invalid AT Protocol handle.")),
      )
      Ok(handle)
    }
  }
}

pub fn is_did(value: String) -> Bool {
  string.starts_with(value, "did:")
}

pub fn supported_method(did: String) -> Bool {
  list.any(supported_methods, string.starts_with(did, _))
}

pub fn resolver() -> Lookup {
  let resolver = atproto.resolver(5000)
  fn(identifier) {
    case normalize(identifier) {
      Error(reason) -> promise.resolve(Error(reason))
      Ok(input) -> resolve(resolver, input)
    }
  }
}

fn resolve(
  resolver: atproto.Resolver,
  input: String,
) -> Promise(Result(Identity, HttpError)) {
  use did <- promise.try_await(case is_did(input) {
    True -> promise.resolve(Ok(input))
    False ->
      promise.map(atproto.resolve_handle(resolver, input), fn(outcome) {
        case outcome {
          Ok(Some(did)) -> Ok(did)
          Ok(None) ->
            Error(error.not_found("Recipient handle could not be resolved."))
          Error(reason) -> Error(unavailable(reason))
        }
      })
  })
  use document <- promise.try_await(
    promise.map(
      atproto.resolve_atproto_data(resolver, did, fresh: True),
      result.map_error(_, unavailable),
    ),
  )
  use <- guard_await(
    document.did == did,
    error.conflict("Recipient DID document does not match."),
  )
  let claimed = option.map(document.handle, string.lowercase)
  use <- guard_await(
    is_did(input) || claimed == Some(input),
    error.conflict("Handle and DID do not match in both directions."),
  )
  let handle = case document.handle {
    Some(handle) ->
      case atproto.is_valid_handle(handle) {
        True -> Some(string.lowercase(handle))
        False -> None
      }
    None -> None
  }
  case is_did(input), handle {
    True, Some(handle) ->
      promise.map(atproto.resolve_handle(resolver, handle), fn(outcome) {
        case outcome {
          Ok(Some(resolved)) if resolved == did ->
            Ok(Identity(did: did, handle: Some(handle)))
          _ -> Ok(Identity(did: did, handle: None))
        }
      })
    _, _ -> promise.resolve(Ok(Identity(did: did, handle: handle)))
  }
}

pub fn to_json(identity: Identity) -> List(#(String, Json)) {
  [
    #("did", json.string(identity.did)),
    #("handle", json.nullable(identity.handle, json.string)),
  ]
}

fn unavailable(_reason: js.Exception) -> HttpError {
  error.HttpError(
    502,
    "Could not verify the recipient identity. Please try again.",
  )
}

fn guard_await(
  condition: Bool,
  reason: HttpError,
  continue: fn() -> Promise(Result(a, HttpError)),
) -> Promise(Result(a, HttpError)) {
  case condition {
    True -> continue()
    False -> promise.resolve(Error(reason))
  }
}
