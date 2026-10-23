import api/fixtures as f
import citruswallet/error
import citruswallet/linking
import citruswallet/payments
import citruswallet/store
import gleam/javascript/promise
import gleam/list
import gleam/option.{None, Some}
import gleam/string

pub fn preparation_is_idempotent_and_reserves_one_nonce_test() {
  let service = f.ready()
  use payment <- promise.await(f.create(service))
  use first <- promise.await(f.prepare(service, payment))
  let assert Ok(first) = first
  use repeated <- promise.await(f.prepare(service, first.payment))
  assert repeated == Ok(first)
  use other <- promise.await(f.create(service))
  use conflict <- promise.map(f.prepare(service, other))
  assert conflict
    == Error(error.conflict(
      "Another payment reserves this wallet nonce. Finish that payment first.",
    ))
  assert first.nonce == 7
  assert first.value_wei == "1000000000000000000"
  store.close(service.store)
}

pub fn changed_nonce_requires_recovery_instead_of_a_second_attempt_test() {
  let service = f.ready()
  use payment <- promise.await(f.create(service))
  use prepared <- promise.await(f.prepare(service, payment))
  let assert Ok(attempt) = prepared
  f.set_mode(service, "used-nonce")
  use resumed <- promise.map(f.prepare(service, attempt.payment))
  assert resumed
    == Error(error.conflict(
      "This wallet nonce is already in use. Recover and attach the original transaction hash before retrying.",
    ))
  store.close(service.store)
}

pub fn stale_review_never_reaches_the_rpc_test() {
  let service = f.ready()
  use payment <- promise.await(f.create(service))
  use outcome <- promise.map(payments.prepare(
    service,
    f.alice,
    Some(payment.id),
    Some(payment.revision + 1),
    payment.address,
    Some(f.alice_wallet),
  ))
  assert outcome
    == Error(error.conflict(
      "Recipient details changed. Refresh and review the payment again.",
    ))
  assert f.calls(service) == 0
  store.close(service.store)
}

pub fn sender_cannot_use_another_accounts_wallet_test() {
  let service = f.ready()
  use payment <- promise.await(f.create(service))
  use outcome <- promise.map(payments.prepare(
    service,
    f.alice,
    Some(payment.id),
    Some(payment.revision),
    payment.address,
    Some(f.bob_wallet),
  ))
  assert outcome
    == Error(error.bad_request(
      "Use a wallet linked to your own DID on this network.",
    ))
  assert f.calls(service) == 0
  store.close(service.store)
}

pub fn recipient_can_read_but_cannot_cancel_or_delete_sender_intent_test() {
  let service = f.ready()
  use payment <- promise.await(f.create(service))
  use visible <- promise.map(payments.get(service, f.bob, Some(payment.id)))
  assert visible == Ok(payment)
  assert payments.cancel(service, f.bob, Some(payment.id))
    == Error(error.not_found("Payment not found."))
  assert payments.delete_cancelled(service, f.bob, Some(payment.id))
    == Error(error.not_found("Payment not found."))
  let assert Ok(cancelled) = payments.cancel(service, f.alice, Some(payment.id))
  assert cancelled.state == payments.Cancelled
  assert payments.delete_cancelled(service, f.alice, Some(payment.id))
    == Ok(Nil)
  assert payments.list(service, f.alice) == []
  store.close(service.store)
}

pub fn expiry_at_the_exact_boundary_blocks_preparation_without_rpc_test() {
  let service = f.ready()
  use payment <- promise.await(f.create(service))
  let expired = payments.Payments(..service, now: fn() { payment.expires_at })
  use outcome <- promise.map(f.prepare(expired, payment))
  assert outcome
    == Error(error.gone(
      "This payment intent has expired. No funds were reserved.",
    ))
  assert f.calls(service) == 0
  store.close(service.store)
}

pub fn recipient_unlink_invalidates_a_review_before_preparation_test() {
  let service = f.ready()
  use payment <- promise.await(f.create(service))
  let assert Ok(_) = linking.unlink(service.links, f.bob, f.bob_wallet)
  use outcome <- promise.await(f.prepare(service, payment))
  assert outcome
    == Error(error.conflict(
      "Recipient must choose a receiving wallet before you can send.",
    ))
  use changed <- promise.map(payments.get(service, f.alice, Some(payment.id)))
  let assert Ok(changed) = changed
  assert changed.state == payments.Waiting
  assert changed.address == None
  assert changed.revision > payment.revision
  assert f.calls(service) == 0
  store.close(service.store)
}

pub fn chain_mismatch_cannot_reserve_a_nonce_test() {
  let service = f.ready()
  use payment <- promise.await(f.create(service))
  f.set_mode(service, "wrong-chain")
  use outcome <- promise.await(f.prepare(service, payment))
  assert outcome
    == Error(error.unavailable(
      "Ethereum RPC chain does not match the payment network.",
    ))
  use unchanged <- promise.map(payments.get(service, f.alice, Some(payment.id)))
  assert unchanged == Ok(payment)
  assert f.calls(service) == 1
  store.close(service.store)
}

pub fn pending_confirming_and_confirmed_states_follow_chain_receipts_test() {
  let service = f.ready()
  use payment <- promise.await(f.create(service))
  use prepared <- promise.await(f.prepare(service, payment))
  let assert Ok(attempt) = prepared
  f.set_mode(service, "pending")
  use submitted <- promise.await(payments.submit(
    service,
    f.alice,
    Some(payment.id),
    Some(attempt.attempt_id),
    Some(f.hash),
  ))
  let assert Ok(submitted) = submitted
  assert submitted.state == payments.Submitted
  f.set_mode(service, "confirming")
  use confirming <- promise.await(payments.get(
    service,
    f.alice,
    Some(payment.id),
  ))
  let assert Ok(confirming) = confirming
  assert confirming.state == payments.Confirming
  f.set_mode(service, "confirmed")
  use confirmed <- promise.map(payments.get(service, f.alice, Some(payment.id)))
  let assert Ok(confirmed) = confirmed
  assert confirmed.state == payments.Confirmed
  assert confirmed.tx_hash == Some(f.hash)
  assert confirmed.error == None
  store.close(service.store)
}

pub fn transaction_mismatches_fail_verification_test() {
  [
    "wrong-sender",
    "wrong-recipient",
    "contract-creation",
    "wrong-value",
    "wrong-data",
    "wrong-nonce",
    "wrong-transaction-chain",
  ]
  |> list.map(fn(mode) {
    let service = f.ready()
    use payment <- promise.await(f.create(service))
    use prepared <- promise.await(f.prepare(service, payment))
    let assert Ok(attempt) = prepared
    f.set_mode(service, mode)
    use result <- promise.map(payments.submit(
      service,
      f.alice,
      Some(payment.id),
      Some(attempt.attempt_id),
      Some(f.hash),
    ))
    let assert Ok(failed) = result
    assert failed.state == payments.Failed
    assert failed.error != None
    assert failed.tx_hash == Some(f.hash)
    store.close(service.store)
  })
  |> promise.await_list
}

pub fn rpc_failure_preserves_broadcast_hash_for_recovery_test() {
  let service = f.ready()
  use payment <- promise.await(f.create(service))
  use prepared <- promise.await(f.prepare(service, payment))
  let assert Ok(attempt) = prepared
  f.set_mode(service, "offline")
  use submitted <- promise.await(payments.submit(
    service,
    f.alice,
    Some(payment.id),
    Some(attempt.attempt_id),
    Some(f.hash),
  ))
  let assert Ok(submitted) = submitted
  assert submitted.state == payments.Submitted
  assert submitted.tx_hash == Some(f.hash)
  assert submitted.error != None
  f.set_mode(service, "confirmed")
  use recovered <- promise.map(payments.get(service, f.alice, Some(payment.id)))
  let assert Ok(recovered) = recovered
  assert recovered.state == payments.Confirmed
  assert recovered.error == None
  store.close(service.store)
}

pub fn an_attempt_cannot_be_rebound_to_a_different_hash_test() {
  let service = f.ready()
  use payment <- promise.await(f.create(service))
  use prepared <- promise.await(f.prepare(service, payment))
  let assert Ok(attempt) = prepared
  use wrong_attempt <- promise.await(payments.submit(
    service,
    f.alice,
    Some(payment.id),
    Some("other"),
    Some(f.hash),
  ))
  assert wrong_attempt
    == Error(error.bad_request("Invalid payment attempt or transaction hash."))
  use _ <- promise.await(payments.submit(
    service,
    f.alice,
    Some(payment.id),
    Some(attempt.attempt_id),
    Some(f.hash),
  ))
  use different <- promise.map(payments.submit(
    service,
    f.alice,
    Some(payment.id),
    Some(attempt.attempt_id),
    Some("0x" <> string.repeat("b", 64)),
  ))
  assert different
    == Error(error.conflict(
      "A transaction is already attached to this payment.",
    ))
  store.close(service.store)
}

pub fn reverted_transaction_is_failed_not_confirmed_test() {
  let service = f.ready()
  use payment <- promise.await(f.create(service))
  use prepared <- promise.await(f.prepare(service, payment))
  let assert Ok(attempt) = prepared
  f.set_mode(service, "reverted")
  use outcome <- promise.map(payments.submit(
    service,
    f.alice,
    Some(payment.id),
    Some(attempt.attempt_id),
    Some(f.hash),
  ))
  let assert Ok(failed) = outcome
  assert failed.state == payments.Failed
  assert failed.error
    == Some(
      "Transaction reverted on-chain. Network fees may have been charged.",
    )
  store.close(service.store)
}

fn token_payment(service) {
  f.set_mode(service, "erc20")
  use outcome <- promise.map(payments.create_asset(
    service,
    f.alice,
    Some("bob.test"),
    Some(f.bob),
    Some("1"),
    None,
    None,
    Some("eip155:1/erc20:0x4444444444444444444444444444444444444444"),
  ))
  let assert Ok(#(payment, _)) = outcome
  assert payment.amount_atomic == "1000000"
  assert payment.asset.decimals == 6
  payment
}

pub fn erc20_requires_exact_transfer_receipt_test() {
  [
    "erc20",
    "log-contract",
    "log-sender",
    "log-recipient",
    "log-amount",
    "log-missing",
    "log-duplicate",
    "reverted",
    "wrong-data",
    "wrong-value",
    "wrong-recipient",
    "wrong-sender",
    "wrong-nonce",
    "wrong-transaction-chain",
  ]
  |> list.map(fn(mode) {
    let service = f.ready()
    use payment <- promise.await(token_payment(service))
    use prepared <- promise.await(f.prepare(service, payment))
    let assert Ok(attempt) = prepared
    assert attempt.value_wei == "0"
    assert attempt.to == "0x4444444444444444444444444444444444444444"
    f.set_mode(service, mode)
    use submitted <- promise.map(payments.submit(
      service,
      f.alice,
      Some(payment.id),
      Some(attempt.attempt_id),
      Some(f.hash),
    ))
    let assert Ok(confirmed) = submitted
    assert confirmed.state
      == case mode {
        "erc20" -> payments.Confirmed
        _ -> payments.Failed
      }
    store.close(service.store)
  })
  |> promise.await_list
}

pub fn erc20_preflight_rejects_changed_decimals_balance_and_failed_simulations_test() {
  ["changed-decimals", "insufficient", "simulation-revert", "simulation-false"]
  |> list.map(fn(mode) {
    let service = f.ready()
    use payment <- promise.await(token_payment(service))
    f.set_mode(service, mode)
    use prepared <- promise.map(f.prepare(service, payment))
    let assert Error(_) = prepared
    store.close(service.store)
  })
  |> promise.await_list
}
