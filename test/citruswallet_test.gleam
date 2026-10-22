import citruswallet/directory.{type Actor, Actor}
import citruswallet/drizzle/orm.{insert, run, set}
import citruswallet/drizzle/schema/links as links_schema
import citruswallet/error
import citruswallet/identity.{Identity}
import citruswallet/linking
import citruswallet/network
import citruswallet/oauth
import citruswallet/payments
import citruswallet/profiles
import citruswallet/rate_limit
import citruswallet/store
import citruswallet/validate
import gleam/dynamic/decode
import gleam/javascript/promise
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string
import gleeunit

pub fn main() -> Nil {
  gleeunit.main()
}

const alice_wallet = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"

const bob_wallet = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"

fn open_store() -> store.Store {
  let assert Ok(store) = store.open(":memory:", migrations: "./drizzle")
  store
}

fn token_of(invitation_url: String) -> String {
  let assert [_, token] = string.split(invitation_url, "#invite=")
  token
}

fn open_links() -> #(store.Store, linking.Links) {
  let store = open_store()
  #(store, linking.new(store, "http://127.0.0.1:4747", 31_337))
}

fn link_row(
  links: linking.Links,
  did: String,
  address: String,
  is_public: Bool,
  is_default: Bool,
) -> Nil {
  let schema = links_schema.define(decode.success(Nil))
  let assert Ok(_) =
    insert(schema.table, [
      set(schema.did, did),
      set(schema.address, address),
      set(schema.chain_id, 31_337),
      set(schema.message, "message"),
      set(schema.signature, "0x00"),
      set(schema.linked_at, "2026-01-01T00:00:00.000Z"),
      set(schema.is_public, is_public),
      set(schema.is_default, is_default),
    ])
    |> run(links.store.database)
  Nil
}

// Validation.

pub fn hex_shapes_test() {
  assert validate.is_hex("0123456789abcdef", length: 16)
  assert !validate.is_hex("0123456789ABCDEF", length: 16)
  assert !validate.is_hex("abc", length: 16)
  assert validate.is_hex_quantity("0xAbC1", digits: 4)
  assert !validate.is_hex_quantity("AbC1", digits: 4)
  assert !validate.is_hex_quantity("0xzz", digits: 2)
}

pub fn ether_amounts_test() {
  assert validate.is_ether_amount("0")
  assert validate.is_ether_amount("0.01")
  assert validate.is_ether_amount("1.000000000000000001")
  assert !validate.is_ether_amount("01")
  assert !validate.is_ether_amount("1.2.3")
  assert !validate.is_ether_amount("1.")
  assert !validate.is_ether_amount("1.0000000000000000001")
  assert !validate.is_ether_amount("-1")
  assert !validate.is_ether_amount("")
}

// Network configuration.

pub fn network_requires_loopback_for_anvil_test() {
  assert network.configured("http://127.0.0.1:4747", "1") == Ok(network.mainnet)
  assert network.configured("http://127.0.0.1:4747", "31337")
    == Ok(network.anvil)
  assert network.configured("https://wallet.example", "31337")
    != Ok(network.anvil)
  assert network.configured("https://wallet.example", "5")
    != Ok(network.mainnet)
}

// The expiring key/value table.

pub fn store_expires_values_test() {
  let store = open_store()
  store.put(store, namespace: "ns", key: "k", value: "v", expires: 2000)
  assert store.get(store, namespace: "ns", key: "k", now: 1000) == Some("v")
  assert store.get(store, namespace: "ns", key: "k", now: 2000) == None
  store.put(store, namespace: "ns", key: "k", value: "w", expires: 3000)
  assert store.get(store, namespace: "ns", key: "k", now: 1000) == Some("w")
  store.delete(store, namespace: "ns", key: "k")
  assert store.get(store, namespace: "ns", key: "k", now: 1000) == None
}

pub fn store_cleanup_removes_expired_test() {
  let store = open_store()
  store.put(store, namespace: "ns", key: "old", value: "v", expires: 500)
  store.put(store, namespace: "ns", key: "new", value: "v", expires: 5000)
  store.cleanup(store, 1000)
  assert store.get(store, namespace: "ns", key: "old", now: 400) == None
  assert store.get(store, namespace: "ns", key: "new", now: 400) == Some("v")
}

// Wallet linking.

pub fn challenge_names_the_did_test() {
  let #(_, links) = open_links()
  let assert Ok(challenge) =
    linking.create(
      links,
      session: "session",
      did: "did:plc:alice",
      address: Some("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
      discoverable: True,
    )
  assert challenge.address == "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
  assert challenge.is_public
}

pub fn challenge_rejects_bad_address_test() {
  let #(_, links) = open_links()
  assert linking.create(
      links,
      session: "session",
      did: "did:plc:alice",
      address: Some("0xnope"),
      discoverable: False,
    )
    == Error(error.bad_request("Invalid Ethereum address."))
  assert linking.create(
      links,
      session: "session",
      did: "did:plc:alice",
      address: None,
      discoverable: False,
    )
    == Error(error.bad_request("Invalid Ethereum address."))
}

pub fn only_one_challenge_per_session_test() {
  let #(_, links) = open_links()
  let address = Some("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")
  let assert Ok(first) =
    linking.create(
      links,
      session: "session",
      did: "did:plc:alice",
      address: address,
      discoverable: False,
    )
  let assert Ok(second) =
    linking.create(
      links,
      session: "session",
      did: "did:plc:alice",
      address: address,
      discoverable: False,
    )
  assert first.id != second.id
}

pub fn links_round_trip_test() {
  let #(_, links) = open_links()
  link_row(links, "did:plc:alice", alice_wallet, True, True)
  link_row(links, "did:plc:alice", bob_wallet, False, False)
  let all = linking.list(links, "did:plc:alice", public_only: False)
  assert list.length(all) == 2
  let public = linking.list(links, "did:plc:alice", public_only: True)
  assert list.map(public, fn(link) { link.address }) == [alice_wallet]
  assert option.map(
      linking.default_address(links, "did:plc:alice", 31_337),
      fn(link) { link.address },
    )
    == Some(alice_wallet)
  assert option.map(
      linking.find(
        links,
        did: "did:plc:alice",
        address: bob_wallet,
        chain_id: 31_337,
      ),
      fn(link) { link.is_public },
    )
    == Some(False)
}

pub fn default_must_be_public_test() {
  let #(_, links) = open_links()
  link_row(links, "did:plc:alice", alice_wallet, True, True)
  link_row(links, "did:plc:alice", bob_wallet, False, False)
  assert linking.set_default(links, "did:plc:alice", Some(bob_wallet))
    == Error(error.bad_request(
      "Choose a publicly discoverable linked address on this network.",
    ))
}

pub fn unlink_removes_the_link_test() {
  let #(_, links) = open_links()
  link_row(links, "did:plc:alice", alice_wallet, True, True)
  let assert Ok(_) = linking.unlink(links, "did:plc:alice", alice_wallet)
  assert linking.list(links, "did:plc:alice", public_only: False) == []
}

// Identity.

pub fn normalize_identifiers_test() {
  assert identity.normalize(Some(" @Alice.Bsky.Social "))
    == Ok("alice.bsky.social")
  assert identity.normalize(Some("did:plc:abc123")) == Ok("did:plc:abc123")
  assert identity.normalize(Some("did:key:abc")) != Ok("did:key:abc")
  assert identity.normalize(Some("not a handle")) != Ok("not a handle")
  assert identity.normalize(None)
    == Error(error.bad_request("Enter an AT Protocol handle or DID."))
}

// Payments.

fn open_payments(handle: String) -> #(linking.Links, payments.Payments) {
  let #(store, links) = open_links()
  let identities = fn(_) {
    promise.resolve(Ok(Identity(did: "did:plc:bob", handle: Some(handle))))
  }
  #(
    links,
    payments.new(
      store: store,
      links: links,
      identities: identities,
      origin: "http://127.0.0.1:4747",
      chain_id: 31_337,
      chain: None,
    ),
  )
}

pub fn create_payment_waits_for_a_receiving_address_test() {
  let #(_, payments) = open_payments("bob.bsky.social")
  use outcome <- promise.map(payments.create(
    payments,
    sender_did: "did:plc:alice",
    identifier: Some("bob.bsky.social"),
    expected_did: Some("did:plc:bob"),
    amount: Some("0.25"),
    description: None,
    media: None,
  ))
  let assert Ok(#(payment, invitation)) = outcome
  assert payment.state == payments.Waiting
  assert payment.amount_wei == "250000000000000000"
  assert payment.recipient_label == "bob.bsky.social"
  assert payment.address == None
  assert invitation != "http://127.0.0.1:4747/#invite="
}

pub fn create_payment_is_ready_when_a_default_exists_test() {
  let #(links, payments) = open_payments("bob.bsky.social")
  link_row(links, "did:plc:bob", bob_wallet, True, True)
  use outcome <- promise.map(payments.create(
    payments,
    sender_did: "did:plc:alice",
    identifier: Some("bob.bsky.social"),
    expected_did: Some("did:plc:bob"),
    amount: Some("1"),
    description: None,
    media: None,
  ))
  let assert Ok(#(payment, _)) = outcome
  assert payment.state == payments.Ready
  assert payment.address == Some(bob_wallet)
  assert payment.source == payments.FromDefault
}

pub fn create_payment_rejects_a_changed_identity_test() {
  let #(_, payments) = open_payments("bob.bsky.social")
  use outcome <- promise.map(payments.create(
    payments,
    sender_did: "did:plc:alice",
    identifier: Some("bob.bsky.social"),
    expected_did: Some("did:plc:someone-else"),
    amount: Some("1"),
    description: None,
    media: None,
  ))
  assert outcome
    == Error(error.conflict(
      "Recipient identity changed. Resolve and review it again.",
    ))
}

pub fn create_payment_rejects_self_payment_test() {
  let #(_, payments) = open_payments("bob.bsky.social")
  use outcome <- promise.map(payments.create(
    payments,
    sender_did: "did:plc:bob",
    identifier: Some("bob.bsky.social"),
    expected_did: Some("did:plc:bob"),
    amount: Some("1"),
    description: None,
    media: None,
  ))
  assert outcome
    == Error(error.bad_request(
      "You cannot send ETH to yourself. Choose another account.",
    ))
}

pub fn resolve_rejects_self_by_handle_or_did_test() {
  let #(_, payments) = open_payments("bob.bsky.social")
  use handle <- promise.await(payments.resolve(
    payments,
    "did:plc:bob",
    Some("bob.bsky.social"),
  ))
  use did <- promise.map(payments.resolve(
    payments,
    "did:plc:bob",
    Some("did:plc:bob"),
  ))
  let expected =
    Error(error.bad_request(
      "You cannot send ETH to yourself. Choose another account.",
    ))
  assert handle == expected
  assert did == expected
  assert payments.list(payments, "did:plc:bob") == []
}

pub fn create_payment_rejects_bad_amounts_test() {
  let #(_, payments) = open_payments("bob.bsky.social")
  use zero <- promise.await(payments.create(
    payments,
    sender_did: "did:plc:alice",
    identifier: Some("bob.bsky.social"),
    expected_did: Some("did:plc:bob"),
    amount: Some("0"),
    description: None,
    media: None,
  ))
  assert zero
    == Error(error.bad_request("ETH amount must be greater than zero."))
  use malformed <- promise.map(payments.create(
    payments,
    sender_did: "did:plc:alice",
    identifier: Some("bob.bsky.social"),
    expected_did: Some("did:plc:bob"),
    amount: Some("1,5"),
    description: None,
    media: None,
  ))
  assert malformed
    == Error(error.bad_request(
      "Enter a positive ETH amount with at most 18 decimal places.",
    ))
}

pub fn payment_cannot_be_prepared_without_an_rpc_test() {
  let #(links, payments) = open_payments("bob.bsky.social")
  link_row(links, "did:plc:bob", bob_wallet, True, True)
  link_row(links, "did:plc:alice", alice_wallet, False, False)
  use created <- promise.await(payments.create(
    payments,
    sender_did: "did:plc:alice",
    identifier: Some("bob.bsky.social"),
    expected_did: Some("did:plc:bob"),
    amount: Some("1"),
    description: None,
    media: None,
  ))
  let assert Ok(#(payment, _)) = created
  use outcome <- promise.map(payments.prepare(
    payments,
    "did:plc:alice",
    Some(payment.id),
    Some(payment.revision),
    Some(bob_wallet),
    Some(alice_wallet),
  ))
  assert outcome
    == Error(error.unavailable(
      "Configure ETH_RPC_URL on the server to enable verified ETH payments.",
    ))
}

pub fn payment_history_is_private_to_its_sender_test() {
  let #(_, payments) = open_payments("bob.bsky.social")
  use created <- promise.await(payments.create(
    payments,
    sender_did: "did:plc:alice",
    identifier: Some("bob.bsky.social"),
    expected_did: Some("did:plc:bob"),
    amount: Some("1"),
    description: None,
    media: None,
  ))
  let assert Ok(#(payment, _)) = created
  assert list.length(payments.list(payments, "did:plc:alice")) == 1
  assert payments.list(payments, "did:plc:carol") == []
  use outcome <- promise.map(payments.get(
    payments,
    "did:plc:carol",
    Some(payment.id),
  ))
  assert outcome == Error(error.not_found("Payment not found."))
}

pub fn invitation_is_bound_to_the_pinned_recipient_test() {
  let #(links, payments) = open_payments("bob.bsky.social")
  use created <- promise.map(payments.create(
    payments,
    sender_did: "did:plc:alice",
    identifier: Some("bob.bsky.social"),
    expected_did: Some("did:plc:bob"),
    amount: Some("1"),
    description: None,
    media: None,
  ))
  let assert Ok(#(payment, _)) = created
  let assert Ok(url) =
    payments.invitation(payments, "did:plc:alice", Some(payment.id))
  let token = token_of(url)
  assert payments.read_invitation(payments, Some(token), "did:plc:carol")
    == Error(error.forbidden(
      "Sign in with the AT Protocol account this invitation was sent to.",
    ))
  let assert Ok(seen) =
    payments.read_invitation(payments, Some(token), "did:plc:bob")
  assert seen.id == payment.id
  // A recipient may share a private address with this sender alone.
  link_row(links, "did:plc:bob", bob_wallet, False, False)
  let assert Ok(accepted) =
    payments.accept(payments, Some(token), "did:plc:bob", Some(bob_wallet))
  assert accepted.state == payments.Ready
  assert accepted.source == payments.FromRecipient
  assert accepted.address == Some(bob_wallet)
  // Rotating the invitation invalidates the previous link.
  let assert Ok(_) =
    payments.invitation(payments, "did:plc:alice", Some(payment.id))
  assert payments.read_invitation(payments, Some(token), "did:plc:bob")
    == Error(error.not_found("Invitation not found."))
}

pub fn cancel_only_applies_before_preparation_test() {
  let #(_, payments) = open_payments("bob.bsky.social")
  use created <- promise.map(payments.create(
    payments,
    sender_did: "did:plc:alice",
    identifier: Some("bob.bsky.social"),
    expected_did: Some("did:plc:bob"),
    amount: Some("1"),
    description: None,
    media: None,
  ))
  let assert Ok(#(payment, _)) = created
  let assert Ok(cancelled) =
    payments.cancel(payments, "did:plc:alice", Some(payment.id))
  assert cancelled.state == payments.Cancelled
  assert payments.cancel(payments, "did:plc:alice", Some(payment.id))
    == Error(error.conflict(
      "Only an unprepared payment intent can be cancelled.",
    ))
}

// Handle suggestions.

fn suggestion(
  did: String,
  handle: String,
  display_name: Option(String),
  avatar: Option(String),
) -> Actor {
  Actor(did: did, handle: handle, display_name: display_name, avatar: avatar)
}

pub fn suggestions_keep_only_addressable_actors_test() {
  let accepted =
    suggestion("did:plc:abc123", "Alice.BSky.Social", Some("Alice"), None)
  let unsupported_method =
    suggestion("did:key:abc123", "bob.bsky.social", None, None)
  let bad_handle = suggestion("did:plc:abc123", "not a handle", None, None)
  let vetted = directory.vetted([accepted, unsupported_method, bad_handle])
  assert list.map(vetted, fn(actor) { actor.handle }) == ["alice.bsky.social"]
}

pub fn suggestions_only_keep_permitted_avatars_test() {
  let allowed = "https://cdn.bsky.app/img/avatar/plain/x@jpeg"
  let cases = [
    #(Some(allowed), Some(allowed)),
    #(Some("http://cdn.bsky.app/img/avatar/x@jpeg"), None),
    #(Some("https://evil.example/x.png"), None),
    #(Some("not a url"), None),
    #(None, None),
  ]
  list.each(cases, fn(pair) {
    let #(given, expected) = pair
    let assert [actor] =
      directory.vetted([
        suggestion("did:plc:abc123", "alice.bsky.social", None, given),
      ])
    assert actor.avatar == expected
  })
}

pub fn suggestions_tidy_display_names_test() {
  let assert [blank] =
    directory.vetted([
      suggestion("did:plc:abc123", "alice.bsky.social", Some("   "), None),
    ])
  assert blank.display_name == None
  let assert [named] =
    directory.vetted([
      suggestion("did:plc:abc123", "alice.bsky.social", Some("Alice"), None),
    ])
  assert named.display_name == Some("Alice")
  let assert [long] =
    directory.vetted([
      suggestion(
        "did:plc:abc123",
        "alice.bsky.social",
        Some(string.repeat("a", 200)),
        None,
      ),
    ])
  assert option.map(long.display_name, string.length) == Some(64)
}

pub fn suggestions_are_capped_test() {
  let many =
    list.repeat(
      suggestion("did:plc:abc123", "alice.bsky.social", None, None),
      20,
    )
  assert list.length(directory.vetted(many)) == directory.suggestions
}

pub fn appview_must_be_trusted_test() {
  assert result.is_ok(directory.appview("https://public.api.bsky.app"))
  assert result.is_ok(directory.appview("http://127.0.0.1:2583"))
  assert result.is_error(directory.appview("http://appview.example"))
  assert result.is_error(directory.appview("not a url"))
}

pub fn signup_provider_must_be_trusted_test() {
  assert oauth.provider("https://selfhosted.social")
    == Ok("https://selfhosted.social")
  // An origin is kept, anything after it is dropped.
  assert oauth.provider("https://selfhosted.social/signup")
    == Ok("https://selfhosted.social")
  assert oauth.provider("http://127.0.0.1:2583") == Ok("http://127.0.0.1:2583")
  assert result.is_error(oauth.provider("http://pds.example"))
  assert result.is_error(oauth.provider("selfhosted.social"))
}

pub fn appview_offers_search_and_profile_test() {
  let assert Ok(directory.Directory(search: _, profile: _)) =
    directory.appview("https://public.api.bsky.app")
}

// Rate limiting.

pub fn rate_limit_counts_a_fixed_window_test() {
  let store = open_store()
  let limiter =
    rate_limit.new(store, namespace: "rate", limit: 2, proxy_hops: 0)
  assert rate_limit.check(limiter, "1.2.3.4", now: 0)
    == rate_limit.Allowed(1, 60)
  assert rate_limit.check(limiter, "1.2.3.4", now: 10_000)
    == rate_limit.Allowed(0, 50)
  assert rate_limit.check(limiter, "1.2.3.4", now: 20_000)
    == rate_limit.Exceeded(40)
  assert rate_limit.check(limiter, "5.6.7.8", now: 20_000)
    == rate_limit.Allowed(1, 40)
  assert rate_limit.check(limiter, "1.2.3.4", now: 60_000)
    == rate_limit.Allowed(1, 60)
}

pub fn rate_limit_trusts_only_configured_hops_test() {
  let store = open_store()
  let direct =
    rate_limit.new(store, namespace: "rate", limit: 60, proxy_hops: 0)
  assert rate_limit.client(direct, Some("10.0.0.1"), Some("1.1.1.1, 2.2.2.2"))
    == "10.0.0.1"
  let behind_one =
    rate_limit.new(store, namespace: "rate", limit: 60, proxy_hops: 1)
  assert rate_limit.client(
      behind_one,
      Some("10.0.0.1"),
      Some("1.1.1.1, 2.2.2.2"),
    )
    == "2.2.2.2"
  let behind_two =
    rate_limit.new(store, namespace: "rate", limit: 60, proxy_hops: 2)
  assert rate_limit.client(
      behind_two,
      Some("10.0.0.1"),
      Some("1.1.1.1, 2.2.2.2"),
    )
    == "1.1.1.1"
  // A header cannot invent more hops than the configuration trusts.
  assert rate_limit.client(behind_two, Some("10.0.0.1"), Some("9.9.9.9"))
    == "9.9.9.9"
  assert rate_limit.client(direct, None, None) == "unknown"
}

pub fn profile_upsert_preserves_creation_and_updates_optional_fields_test() {
  let store = open_store()
  let actor =
    Actor(
      "did:plc:abc123",
      "alice.bsky.social",
      Some("Alice"),
      Some("https://cdn.bsky.app/avatar.jpg"),
    )
  assert profiles.save(store, actor, 1000) == Ok(actor)
  let changed =
    Actor(
      ..actor,
      handle: "alice.example.com",
      display_name: None,
      avatar: None,
    )
  assert profiles.save(store, changed, 2000) == Ok(changed)
  let assert Some(saved) = profiles.get(store, actor.did)
  assert saved.actor == changed
  assert saved.created_at == Some(1000)
  assert saved.updated_at == Some(2000)
  store.close(store)
}

pub fn profile_refresh_saves_authenticated_profile_test() {
  let store = open_store()
  let actor =
    Actor(
      "did:plc:abc123",
      "alice.bsky.social",
      Some("Alice"),
      Some("https://cdn.bsky.app/avatar.jpg"),
    )
  let directory =
    directory.Directory(
      search: fn(_) { promise.resolve(Ok([])) },
      profile: fn(_) { promise.resolve(Ok(Some(actor))) },
    )
  use outcome <- promise.map(profiles.refresh(store, directory, actor.did))
  assert outcome == Ok(actor)
  let assert Some(saved) = profiles.get(store, actor.did)
  assert saved.actor == actor
  assert saved.created_at != None
  assert saved.created_at == saved.updated_at
  store.close(store)
}

pub fn profile_refresh_keeps_saved_data_on_failure_or_wrong_did_test() {
  let store = open_store()
  let actor = Actor("did:plc:abc123", "alice.bsky.social", Some("Alice"), None)
  let assert Ok(_) = profiles.save(store, actor, 1000)
  let missing =
    directory.Directory(
      search: fn(_) { promise.resolve(Ok([])) },
      profile: fn(_) { promise.resolve(Ok(None)) },
    )
  use absent <- promise.await(profiles.refresh(store, missing, actor.did))
  assert absent == Ok(actor)
  let failing =
    directory.Directory(..missing, profile: fn(_) {
      promise.resolve(Error(error.unavailable("Offline")))
    })
  use failed <- promise.await(profiles.refresh(store, failing, actor.did))
  assert failed == Ok(actor)
  let wrong =
    directory.Directory(..missing, profile: fn(_) {
      promise.resolve(Ok(Some(Actor(..actor, did: "did:plc:another"))))
    })
  use mismatch <- promise.map(profiles.refresh(store, wrong, actor.did))
  assert mismatch == Ok(actor)
  let assert Some(saved) = profiles.get(store, actor.did)
  assert saved.updated_at == Some(1000)
  assert profiles.get(store, "did:plc:another") == None
  store.close(store)
}

pub fn first_login_records_did_when_appview_is_unavailable_test() {
  let store = open_store()
  let directory =
    directory.Directory(
      search: fn(_) { promise.resolve(Ok([])) },
      profile: fn(_) { promise.resolve(Ok(None)) },
    )
  use outcome <- promise.map(profiles.refresh(
    store,
    directory,
    "did:plc:abc123",
  ))
  let assert Ok(actor) = outcome
  assert actor.did == "did:plc:abc123"
  assert actor.handle == ""
  assert actor.display_name == None
  assert actor.avatar == None
  assert profiles.get(store, actor.did) != None
  store.close(store)
}
