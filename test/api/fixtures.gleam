import gleam/dynamic/decode
import gleam/javascript/promise
import gleam/option.{None, Some}
import peachlet/chain
import peachlet/drizzle/orm.{insert, run, set}
import peachlet/drizzle/schema/links as schema
import peachlet/ffi/viem
import peachlet/identity.{Identity}
import peachlet/linking
import peachlet/payments
import peachlet/store

pub const alice = "did:plc:alice"

pub const bob = "did:plc:bob"

pub const carol = "did:plc:carol"

pub const alice_wallet = "0x1111111111111111111111111111111111111111"

pub const bob_wallet = "0x2222222222222222222222222222222222222222"

pub const other_wallet = "0x3333333333333333333333333333333333333333"

pub const hash =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

pub const now = 1_767_225_600_000

@external(javascript, "./chain_stub.mjs", "client")
pub fn client() -> viem.Client

@external(javascript, "./chain_stub.mjs", "setMode")
pub fn mode(client: viem.Client, mode: String) -> Nil

@external(javascript, "./chain_stub.mjs", "callCount")
pub fn call_count(client: viem.Client) -> Int

pub fn open() -> payments.Payments {
  let assert Ok(store) = store.open(":memory:", migrations: "./drizzle")
  let links = linking.Links(store, "https://peachlet.app", 1, fn() { now })
  payments.Payments(
    ..payments.new(
      store,
      links,
      fn(_) { promise.resolve(Ok(Identity(bob, Some("bob.test")))) },
      "https://peachlet.app",
      1,
      Some(chain.Chain(client())),
    ),
    now: fn() { now },
  )
}

pub fn link(
  payments: payments.Payments,
  did: String,
  address: String,
  public: Bool,
  default: Bool,
) {
  let table = schema.define(decode.success(Nil))
  let assert Ok(_) =
    insert(table.table, [
      set(table.did, did),
      set(table.address, address),
      set(table.chain_id, 1),
      set(table.message, "proof"),
      set(table.signature, "0x00"),
      set(table.linked_at, "2026-01-01T00:00:00.000Z"),
      set(table.is_public, public),
      set(table.is_default, default),
    ])
    |> run(payments.store.database)
  Nil
}

pub fn ready() -> payments.Payments {
  let service = open()
  link(service, alice, alice_wallet, False, False)
  link(service, bob, bob_wallet, True, True)
  service
}

pub fn create(service: payments.Payments) {
  use outcome <- promise.map(payments.create(
    service,
    alice,
    Some("bob.test"),
    Some(bob),
    Some("1"),
    None,
    None,
  ))
  let assert Ok(#(payment, _)) = outcome
  payment
}

pub fn prepare(service: payments.Payments, payment: payments.Payment) {
  payments.prepare(
    service,
    alice,
    Some(payment.id),
    Some(payment.revision),
    payment.address,
    Some(alice_wallet),
  )
}

pub fn set_mode(service: payments.Payments, value: String) {
  let assert Some(chain.Chain(client)) = service.chain
  mode(client, value)
}

pub fn calls(service: payments.Payments) {
  let assert Some(chain.Chain(client)) = service.chain
  call_count(client)
}
