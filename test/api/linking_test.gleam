import api/fixtures as f
import peachlet/error
import peachlet/linking
import peachlet/store
import gleam/javascript/promise
import gleam/option.{Some}
import gleam/string

const stale = "Challenge expired or unavailable. Request a new signature."

pub fn challenge_rejects_another_session_test() {
  let service = f.open()
  let assert Ok(challenge) =
    linking.create(
      service.links,
      "original",
      f.alice,
      Some(f.alice_wallet),
      False,
    )
  use outcome <- promise.map(linking.verify(
    service.links,
    "other",
    f.alice,
    Some(challenge.id),
    Some("0x" <> string.repeat("0", 130)),
  ))
  assert outcome == Error(error.bad_request(stale))
  assert linking.list(service.links, f.alice, False) == []
  store.close(service.store)
}

pub fn challenge_cannot_be_reused_by_another_did_test() {
  let service = f.open()
  let assert Ok(challenge) =
    linking.create(
      service.links,
      "session",
      f.alice,
      Some(f.alice_wallet),
      True,
    )
  use outcome <- promise.map(linking.verify(
    service.links,
    "session",
    f.bob,
    Some(challenge.id),
    Some("0x" <> string.repeat("0", 130)),
  ))
  assert outcome == Error(error.bad_request(stale))
  assert linking.list(service.links, f.bob, False) == []
  store.close(service.store)
}

pub fn challenge_expires_at_its_exact_deadline_test() {
  let service = f.open()
  let assert Ok(challenge) =
    linking.create(
      service.links,
      "session",
      f.alice,
      Some(f.alice_wallet),
      False,
    )
  let expired = linking.Links(..service.links, now: fn() { challenge.expires })
  use outcome <- promise.map(linking.verify(
    expired,
    "session",
    f.alice,
    Some(challenge.id),
    Some("0x" <> string.repeat("0", 130)),
  ))
  assert outcome == Error(error.bad_request(stale))
  store.close(service.store)
}

pub fn replacement_challenge_invalidates_the_previous_id_test() {
  let service = f.open()
  let assert Ok(first) =
    linking.create(
      service.links,
      "session",
      f.alice,
      Some(f.alice_wallet),
      False,
    )
  let assert Ok(second) =
    linking.create(
      service.links,
      "session",
      f.alice,
      Some(f.alice_wallet),
      False,
    )
  assert first.id != second.id
  use outcome <- promise.map(linking.verify(
    service.links,
    "session",
    f.alice,
    Some(first.id),
    Some("0x" <> string.repeat("0", 130)),
  ))
  assert outcome == Error(error.bad_request(stale))
  store.close(service.store)
}

pub fn challenge_cannot_survive_a_network_configuration_change_test() {
  let service = f.open()
  let assert Ok(challenge) =
    linking.create(
      service.links,
      "session",
      f.alice,
      Some(f.alice_wallet),
      False,
    )
  let changed = linking.Links(..service.links, chain_id: 31_337)
  use outcome <- promise.map(linking.verify(
    changed,
    "session",
    f.alice,
    Some(challenge.id),
    Some("0x" <> string.repeat("0", 130)),
  ))
  assert outcome
    == Error(error.bad_request(
      "Network configuration changed. Request a new signature.",
    ))
  store.close(service.store)
}
