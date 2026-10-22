import citruswallet/chain.{type Chain}
import citruswallet/directory
import citruswallet/drizzle/orm.{
  all, all_of, any_of, ascending, columns_equal, contains, count_rows, delete,
  descending, eq, exists, from as db_from, gt, in_list, insert, is_null, limit,
  lte, offset, one, order_by, pick, run, select, set, update, where,
}
import citruswallet/drizzle/schema/payments as payments_schema
import citruswallet/drizzle/schema/user_profiles
import citruswallet/error.{type HttpError}
import citruswallet/ffi/node
import citruswallet/ffi/viem
import citruswallet/identity.{type Identity, type Lookup}
import citruswallet/linking.{type Link, type Links}
import citruswallet/payment_media
import citruswallet/profiles
import citruswallet/store.{type Store}
import citruswallet/validate
import gleam/bool
import gleam/dynamic/decode.{type Decoder}
import gleam/int
import gleam/javascript/promise.{type Promise}
import gleam/json.{type Json}
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string

pub type State {
  Waiting
  Ready
  Prepared
  Submitted
  Confirming
  Confirmed
  Failed
  Cancelled
  Expired
}

pub type Source {
  FromDefault
  FromRecipient
}

pub type Payment {
  Payment(
    id: String,
    sender_did: String,
    recipient_did: String,
    recipient_label: String,
    chain_id: Int,
    amount_wei: String,
    description: Option(String),
    media: Option(String),
    state: State,
    source: Source,
    address: Option(String),
    fingerprint: Option(String),
    revision: Int,
    created_at: Int,
    expires_at: Int,
    attempt_id: Option(String),
    from_address: Option(String),
    nonce: Option(Int),
    tx_hash: Option(String),
    error: Option(String),
  )
}

pub type Payments {
  Payments(
    store: Store,
    links: Links,
    identities: Lookup,
    origin: String,
    chain_id: Int,
    chain: Option(Chain),
    now: fn() -> Int,
    confirmations: Int,
  )
}

const intent_lifetime = 604_800_000

const open_states = [Waiting, Ready]

const rpc_unavailable =
  "RPC verification is unavailable. The transaction may already be broadcast; refresh its status rather than sending again."

pub fn new(
  store store: Store,
  links links: Links,
  identities identities: Lookup,
  origin origin: String,
  chain_id chain_id: Int,
  chain chain: Option(Chain),
) -> Payments {
  Payments(
    store: store,
    links: links,
    identities: identities,
    origin: origin,
    chain_id: chain_id,
    chain: chain,
    now: node.now,
    confirmations: case chain_id {
      31_337 -> 1
      _ -> 12
    },
  )
}

pub fn resolve(
  payments: Payments,
  sender_did: String,
  identifier: Option(String),
) -> Promise(Result(#(Identity, Option(String)), HttpError)) {
  use identity <- promise.try_await(payments.identities(identifier))
  use <- guard(
    identity.did != sender_did,
    error.bad_request(
      "You cannot send ETH to yourself. Choose another account.",
    ),
  )
  let link =
    linking.default_address(payments.links, identity.did, payments.chain_id)
  promise.resolve(Ok(#(identity, option.map(link, fn(link) { link.address }))))
}

pub fn create(
  payments: Payments,
  sender_did sender_did: String,
  identifier identifier: Option(String),
  expected_did expected_did: Option(String),
  amount amount: Option(String),
  description description: Option(String),
  media media: Option(String),
) -> Promise(Result(#(Payment, String), HttpError)) {
  use <- guard(
    payment_media.valid(media),
    error.bad_request("Invalid KLIPY attachment."),
  )
  let description = option.map(description, string.trim)
  use <- guard(
    string.length(option.unwrap(description, "")) <= 500,
    error.bad_request("Payment description must be 500 characters or fewer."),
  )
  let description = case description {
    Some("") -> None
    _ -> description
  }
  case wei_of(amount) {
    Error(reason) -> promise.resolve(Error(reason))
    Ok(amount_wei) -> {
      use #(recipient, _) <- promise.try_await(resolve(
        payments,
        sender_did,
        identifier,
      ))
      use <- guard(
        expected_did == Some(recipient.did),
        error.conflict(
          "Recipient identity changed. Resolve and review it again.",
        ),
      )
      let link =
        linking.default_address(
          payments.links,
          recipient.did,
          payments.chain_id,
        )
      let id = node.random_hex(32)
      let token = node.random_hex(32)
      let now = payments.now()
      let table = table()
      let _ =
        insert(table.table, [
          set(table.id, id),
          set(table.sender_did, sender_did),
          set(table.recipient_did, recipient.did),
          set(
            table.recipient_label,
            option.unwrap(recipient.handle, recipient.did),
          ),
          set(table.chain_id, payments.chain_id),
          set(table.amount_wei, amount_wei),
          set(table.description, description),
          set(table.media, media),
          set(
            table.state,
            state_name(case link {
              Some(_) -> Ready
              None -> Waiting
            }),
          ),
          set(table.source, source_name(FromDefault)),
          set(table.address, option.map(link, fn(link) { link.address })),
          set(table.fingerprint, option.map(link, fingerprint)),
          set(table.invitation_hash, Some(node.sha256(token))),
          set(table.revision, 1),
          set(table.created_at, now),
          set(table.expires_at, now + intent_lifetime),
        ])
        |> run(payments.store.database)
      promise.resolve(
        result.map(row(payments, Some(id)), fn(payment) {
          #(payment, invitation_url(payments, token))
        }),
      )
    }
  }
}

fn wei_of(amount: Option(String)) -> Result(String, HttpError) {
  let invalid =
    error.bad_request(
      "Enter a positive ETH amount with at most 18 decimal places.",
    )
  use amount <- result.try(option.to_result(amount, invalid))
  use <- bool.guard(
    when: !validate.is_ether_amount(amount),
    return: Error(invalid),
  )
  use wei <- result.try(result.replace_error(viem.to_wei(amount), invalid))
  use <- bool.guard(
    when: wei == "0",
    return: Error(error.bad_request("ETH amount must be greater than zero.")),
  )
  Ok(wei)
}

pub type Filters {
  Filters(
    query: String,
    direction: String,
    status: String,
    after: Int,
    before: Int,
    page: Int,
    page_size: Int,
    sort: String,
  )
}

pub type Page {
  Page(payments: List(Payment), total: Int)
}

pub fn list(payments: Payments, did: String) -> List(Payment) {
  history(
    payments,
    did,
    Filters("", "all", "all", 0, 253_402_300_799_999, 1, 20, "newest"),
  ).payments
}

pub fn history(payments: Payments, did: String, filters: Filters) -> Page {
  let table = table()
  let participant = case filters.direction {
    "sent" -> eq(table.sender_did, did)
    "received" -> eq(table.recipient_did, did)
    _ -> any_of([eq(table.sender_did, did), eq(table.recipient_did, did)])
  }
  let conditions = [
    participant,
    eq(table.chain_id, payments.chain_id),
    gt(table.created_at, filters.after - 1),
    lte(table.created_at, filters.before),
  ]
  let conditions = case filters.status {
    "all" -> conditions
    "expired" -> [
      any_of([
        eq(table.state, "expired"),
        option.unwrap(
          all_of([
            in_list(table.state, ["waiting", "ready", "prepared"]),
            lte(table.expires_at, payments.now()),
          ]),
          eq(table.state, "expired"),
        ),
      ]),
      ..conditions
    ]
    status -> {
      let conditions = [eq(table.state, status), ..conditions]
      case list.contains(["waiting", "ready", "prepared"], status) {
        True -> [gt(table.expires_at, payments.now()), ..conditions]
        False -> conditions
      }
    }
  }
  let conditions = case string.trim(filters.query) {
    "" -> conditions
    query -> {
      let profiles = user_profiles.define(decode.success(Nil))
      let matching_profiles = fn(participant) {
        select(profiles.table, pick("did", profiles.did))
        |> where([
          columns_equal(profiles.did, participant),
          any_of([
            contains(profiles.handle, query),
            contains(profiles.display_name, query),
          ]),
        ])
      }
      [
        any_of([
          contains(table.description, query),
          contains(table.recipient_label, query),
          contains(table.sender_did, query),
          contains(table.recipient_did, query),
          contains(table.address, query),
          contains(table.from_address, query),
          contains(table.tx_hash, query),
          exists(matching_profiles(table.sender_did), payments.store.database),
          exists(
            matching_profiles(table.recipient_did),
            payments.store.database,
          ),
        ]),
        ..conditions
      ]
    }
  }
  let total =
    select(table.table, count_rows())
    |> where(conditions)
    |> one(payments.store.database)
    |> option.unwrap(0)
  let order = case filters.sort {
    "oldest" -> [ascending(table.created_at), ascending(table.id)]
    _ -> [descending(table.created_at), descending(table.id)]
  }
  let rows =
    db_from(table.table)
    |> where(conditions)
    |> order_by(order)
    |> limit(filters.page_size)
    |> offset({ filters.page - 1 } * filters.page_size)
    |> all(payments.store.database)
  Page(rows, total)
}

fn profile_json(payments: Payments, did: String) -> Json {
  case profiles.get(payments.store, did) {
    Some(profile) -> directory.to_json(profile.actor)
    None -> json.null()
  }
}

pub fn get(
  payments: Payments,
  sender_did: String,
  id: Option(String),
) -> Promise(Result(Payment, HttpError)) {
  case
    result.map(participant(payments, id, sender_did), reconcile(payments, _))
  {
    Error(reason) -> promise.resolve(Error(reason))
    Ok(payment) ->
      case payment.tx_hash, payment.state {
        Some(_), Submitted | Some(_), Confirming | Some(_), Confirmed ->
          check_transaction(payments, payment)
        _, _ -> promise.resolve(Ok(payment))
      }
  }
}

pub fn invitation(
  payments: Payments,
  sender_did: String,
  id: Option(String),
) -> Result(String, HttpError) {
  use payment <- result.try(
    result.map(owned(payments, id, sender_did), reconcile(payments, _)),
  )
  use _ <- result.try(require_open(payments, payment))
  use <- bool.guard(
    when: !list.contains(open_states, payment.state),
    return: Error(error.conflict(
      "This payment can no longer issue invitations.",
    )),
  )
  let token = node.random_hex(32)
  let table = table()
  let _ =
    update(table.table, [set(table.invitation_hash, Some(node.sha256(token)))], [
      eq(table.id, payment.id),
    ])
    |> run(payments.store.database)
  Ok(invitation_url(payments, token))
}

pub fn read_invitation(
  payments: Payments,
  token: Option(String),
  recipient_did: String,
) -> Result(Payment, HttpError) {
  use payment <- result.map(invited(payments, token, recipient_did))
  reconcile(payments, payment)
}

pub fn accept(
  payments: Payments,
  token: Option(String),
  recipient_did: String,
  address: Option(String),
) -> Result(Payment, HttpError) {
  use payment <- result.try(invited(payments, token, recipient_did))
  use _ <- result.try(require_open(payments, payment))
  use <- bool.guard(
    when: !list.contains(open_states, payment.state),
    return: Error(error.conflict(
      "This payment is already being sent or is closed.",
    )),
  )
  use address <- result.try(option.to_result(
    address,
    error.bad_request("Choose a linked wallet address."),
  ))
  use <- bool.guard(
    when: !viem.is_address(address),
    return: Error(error.bad_request("Choose a linked wallet address.")),
  )
  use link <- result.try(option.to_result(
    linking.find(
      payments.links,
      did: recipient_did,
      address: address,
      chain_id: payments.chain_id,
    ),
    error.bad_request("Link this wallet on the payment network first."),
  ))
  let table = table()
  let _ =
    update(
      table.table,
      [
        set(table.address, Some(link.address)),
        set(table.fingerprint, Some(fingerprint(link))),
        set(table.source, source_name(FromRecipient)),
        set(table.state, state_name(Ready)),
        set(table.revision, payment.revision + 1),
      ],
      [
        eq(table.id, payment.id),
        eq(table.revision, payment.revision),
      ],
    )
    |> run(payments.store.database)
  row(payments, Some(payment.id))
}

pub fn cancel(
  payments: Payments,
  sender_did: String,
  id: Option(String),
) -> Result(Payment, HttpError) {
  use payment <- result.try(owned(payments, id, sender_did))
  use <- bool.guard(
    when: !list.contains(open_states, payment.state),
    return: Error(error.conflict(
      "Only an unprepared payment intent can be cancelled.",
    )),
  )
  let table = table()
  let _ =
    update(
      table.table,
      [
        set(table.state, state_name(Cancelled)),
        set(table.invitation_hash, None),
      ],
      [eq(table.id, payment.id)],
    )
    |> run(payments.store.database)
  row(payments, Some(payment.id))
}

pub type Attempt {
  Attempt(
    payment: Payment,
    attempt_id: String,
    from: String,
    to: String,
    value_wei: String,
    nonce: Int,
  )
}

pub fn prepare(
  payments: Payments,
  sender_did: String,
  id: Option(String),
  revision: Option(Int),
  address: Option(String),
  from_address: Option(String),
) -> Promise(Result(Attempt, HttpError)) {
  case reviewed(payments, sender_did, id, revision, address, from_address) {
    Error(reason) -> promise.resolve(Error(reason))
    Ok(#(payment, from)) -> {
      use chain <- promise.try_await(chain.require(
        payments.chain,
        payments.chain_id,
      ))
      use nonce <- promise.try_await(chain.nonce(chain, from))
      case payment.state {
        Prepared -> promise.resolve(resume(payment, from, nonce))
        _ ->
          promise.resolve(reserve(
            payments,
            sender_did,
            id,
            revision,
            address,
            from,
            nonce,
          ))
      }
    }
  }
}

fn reviewed(
  payments: Payments,
  sender_did: String,
  id: Option(String),
  revision: Option(Int),
  address: Option(String),
  from_address: Option(String),
) -> Result(#(Payment, String), HttpError) {
  use payment <- result.try(
    result.map(owned(payments, id, sender_did), reconcile(payments, _)),
  )
  use _ <- result.try(require_open(payments, payment))
  use <- bool.guard(
    when: !list.contains([Ready, Prepared], payment.state)
      || payment.address == None,
    return: Error(error.conflict(
      "Recipient must choose a receiving wallet before you can send.",
    )),
  )
  let stale =
    error.conflict(
      "Recipient details changed. Refresh and review the payment again.",
    )
  use <- bool.guard(
    when: payment.revision != option.unwrap(revision, -1)
      || option.map(address, string.lowercase) != payment.address,
    return: Error(stale),
  )
  let desired = desired(payments, payment)
  use <- bool.guard(
    when: option.map(desired, fingerprint) != payment.fingerprint
      || option.map(desired, fn(link) { link.address }) != payment.address,
    return: Error(error.conflict(
      "The receiving wallet changed. This prepared intent cannot be retargeted; create a new intent.",
    )),
  )
  let own =
    error.bad_request("Use a wallet linked to your own DID on this network.")
  use sender_address <- result.try(option.to_result(from_address, own))
  use <- bool.guard(when: !viem.is_address(sender_address), return: Error(own))
  let from = string.lowercase(sender_address)
  use <- bool.guard(
    when: !is_linked(payments, sender_did, from),
    return: Error(own),
  )
  Ok(#(payment, from))
}

fn resume(
  payment: Payment,
  from: String,
  nonce: Int,
) -> Result(Attempt, HttpError) {
  use <- bool.guard(
    when: payment.from_address != Some(from),
    return: Error(error.conflict(
      "This payment is already prepared for a different sender wallet.",
    )),
  )
  use <- bool.guard(
    when: nonce > option.unwrap(payment.nonce, 0),
    return: Error(error.conflict(
      "This wallet nonce is already in use. Recover and attach the original transaction hash before retrying.",
    )),
  )
  attempt(payment)
}

fn reserve(
  payments: Payments,
  sender_did: String,
  id: Option(String),
  revision: Option(Int),
  address: Option(String),
  from: String,
  nonce: Int,
) -> Result(Attempt, HttpError) {
  let table = table()
  let _ =
    update(table.table, [set(table.state, state_name(Expired))], [
      eq(table.state, state_name(Prepared)),
      lte(table.expires_at, payments.now()),
    ])
    |> run(payments.store.database)
  use payment <- result.try(
    result.map(owned(payments, id, sender_did), reconcile(payments, _)),
  )
  use _ <- result.try(require_open(payments, payment))
  use <- bool.guard(
    when: payment.state != Ready
      || payment.revision != option.unwrap(revision, -1)
      || option.map(address, string.lowercase) != payment.address,
    return: Error(error.conflict(
      "Payment changed while preparing. Refresh and review again.",
    )),
  )
  use <- bool.guard(
    when: !is_linked(payments, sender_did, from),
    return: Error(error.conflict("Sender wallet was unlinked.")),
  )
  let written =
    update(
      table.table,
      [
        set(table.state, state_name(Prepared)),
        set(table.attempt_id, Some(node.random_hex(32))),
        set(table.from_address, Some(from)),
        set(table.nonce, Some(nonce)),
        set(table.prepared_at, Some(payments.now())),
      ],
      [
        eq(table.id, payment.id),
        eq(table.state, state_name(Ready)),
        eq(table.revision, payment.revision),
      ],
    )
    |> run(payments.store.database)
  use _ <- result.try(result.replace_error(
    written,
    error.conflict(
      "Another payment reserves this wallet nonce. Finish that payment first.",
    ),
  ))
  use prepared <- result.try(row(payments, Some(payment.id)))
  attempt(prepared)
}

fn attempt(payment: Payment) -> Result(Attempt, HttpError) {
  case
    payment.attempt_id,
    payment.from_address,
    payment.address,
    payment.nonce
  {
    Some(attempt_id), Some(from), Some(to), Some(nonce) ->
      Ok(Attempt(
        payment: payment,
        attempt_id: attempt_id,
        from: viem.checksum(from),
        to: viem.checksum(to),
        value_wei: payment.amount_wei,
        nonce: nonce,
      ))
    _, _, _, _ ->
      Error(error.conflict("Payment is not prepared. Refresh and review again."))
  }
}

pub fn submit(
  payments: Payments,
  sender_did: String,
  id: Option(String),
  attempt_id: Option(String),
  tx_hash: Option(String),
) -> Promise(Result(Payment, HttpError)) {
  case accepted(payments, sender_did, id, attempt_id, tx_hash) {
    Error(reason) -> promise.resolve(Error(reason))
    Ok(payment) ->
      case payment.tx_hash {
        Some(_) -> check_transaction(payments, payment)
        None ->
          promise.resolve(
            Error(error.conflict("Payment lost its transaction.")),
          )
      }
  }
}

fn accepted(
  payments: Payments,
  sender_did: String,
  id: Option(String),
  attempt_id: Option(String),
  tx_hash: Option(String),
) -> Result(Payment, HttpError) {
  use payment <- result.try(owned(payments, id, sender_did))
  let invalid =
    error.bad_request("Invalid payment attempt or transaction hash.")
  use hash <- result.try(option.to_result(tx_hash, invalid))
  use <- bool.guard(
    when: !validate.is_hex_quantity(hash, digits: 64)
      || payment.attempt_id == None
      || attempt_id != payment.attempt_id,
    return: Error(invalid),
  )
  let hash = string.lowercase(hash)
  use <- bool.guard(
    when: payment.tx_hash != None && payment.tx_hash != Some(hash),
    return: Error(error.conflict(
      "A transaction is already attached to this payment.",
    )),
  )
  use <- bool.guard(
    when: !list.contains(
      [Prepared, Expired, Submitted, Confirming, Confirmed],
      payment.state,
    ),
    return: Error(error.conflict("Payment cannot accept a transaction.")),
  )
  let table = table()
  use _ <- result.try(case payment.tx_hash {
    Some(_) -> Ok(0)
    None ->
      update(
        table.table,
        [
          set(table.tx_hash, Some(hash)),
          set(table.state, state_name(Submitted)),
          set(table.error, None),
        ],
        [eq(table.id, payment.id), is_null(table.tx_hash)],
      )
      |> run(payments.store.database)
      |> result.replace_error(error.conflict(
        "This transaction is already attached to another payment.",
      ))
  })
  row(payments, Some(payment.id))
}

fn check_transaction(
  payments: Payments,
  payment: Payment,
) -> Promise(Result(Payment, HttpError)) {
  case payment.tx_hash {
    None -> promise.resolve(Ok(payment))
    Some(hash) -> {
      use outcome <- promise.await(verify(payments, payment, hash))
      let table = table()
      let record = fn(values) {
        let _ =
          update(table.table, values, [
            eq(table.id, payment.id),
          ])
          |> run(payments.store.database)
        row(payments, Some(payment.id))
      }
      promise.resolve(case outcome {
        Ok(#(state, reason)) ->
          record([
            set(table.state, state_name(state)),
            set(table.error, reason),
          ])
        Error(_) -> record([set(table.error, Some(rpc_unavailable))])
      })
    }
  }
}

fn verify(
  payments: Payments,
  payment: Payment,
  hash: String,
) -> Promise(Result(#(State, Option(String)), HttpError)) {
  use chain <- promise.try_await(chain.require(payments.chain, payment.chain_id))
  use found <- promise.try_await(chain.transaction(chain, hash))
  case found {
    None ->
      promise.resolve(
        Ok(#(
          Submitted,
          Some(
            "Transaction not yet visible on the configured RPC. Refresh to check again.",
          ),
        )),
      )
    Some(transaction) ->
      case matches(payment, transaction) {
        False ->
          promise.resolve(
            Ok(#(
              Failed,
              Some(
                "Transaction does not match the reviewed sender, recipient, amount, nonce, or network. Check the hash in your wallet.",
              ),
            )),
          )
        True -> {
          use receipt <- promise.try_await(chain.receipt(chain, hash))
          case receipt {
            None -> promise.resolve(Ok(#(Submitted, None)))
            Some(receipt) if receipt.status == "reverted" ->
              promise.resolve(
                Ok(#(
                  Failed,
                  Some(
                    "Transaction reverted on-chain. Network fees may have been charged.",
                  ),
                )),
              )
            Some(receipt) -> {
              use height <- promise.try_await(chain.block_number(chain))
              let confirmations = height - receipt.block_number + 1
              promise.resolve(
                Ok(#(
                  case confirmations >= payments.confirmations {
                    True -> Confirmed
                    False -> Confirming
                  },
                  None,
                )),
              )
            }
          }
        }
      }
  }
}

fn matches(payment: Payment, transaction: chain.Transaction) -> Bool {
  Some(string.lowercase(transaction.from)) == payment.from_address
  && option.map(transaction.to, string.lowercase) == payment.address
  && transaction.value == payment.amount_wei
  && Some(transaction.nonce) == payment.nonce
  && transaction.input == "0x"
  && case transaction.chain_id {
    Some(chain_id) -> chain_id == payment.chain_id
    None -> True
  }
}

fn row(payments: Payments, id: Option(String)) -> Result(Payment, HttpError) {
  let missing = error.not_found("Payment not found.")
  use id <- result.try(option.to_result(id, missing))
  let table = table()
  db_from(table.table)
  |> where([
    eq(table.id, id),
    eq(table.chain_id, payments.chain_id),
  ])
  |> one(payments.store.database)
  |> option.to_result(missing)
}

fn owned(
  payments: Payments,
  id: Option(String),
  sender_did: String,
) -> Result(Payment, HttpError) {
  use payment <- result.try(row(payments, id))
  use <- bool.guard(
    when: payment.sender_did != sender_did,
    return: Error(error.not_found("Payment not found.")),
  )
  Ok(payment)
}

fn invited(
  payments: Payments,
  token: Option(String),
  recipient_did: String,
) -> Result(Payment, HttpError) {
  let missing = error.not_found("Invitation not found.")
  use token <- result.try(option.to_result(token, missing))
  use <- bool.guard(
    when: !validate.is_hex(token, length: 64),
    return: Error(missing),
  )
  let table = table()
  use payment <- result.try(
    db_from(table.table)
    |> where([
      eq(table.invitation_hash, Some(node.sha256(token))),
      eq(table.chain_id, payments.chain_id),
    ])
    |> one(payments.store.database)
    |> option.to_result(missing),
  )
  use <- bool.guard(
    when: payment.recipient_did != recipient_did,
    return: Error(error.forbidden(
      "Sign in with the AT Protocol account this invitation was sent to.",
    )),
  )
  Ok(payment)
}

fn desired(payments: Payments, payment: Payment) -> Option(Link) {
  case payment.source, payment.address {
    FromDefault, _ ->
      linking.default_address(
        payments.links,
        payment.recipient_did,
        payment.chain_id,
      )
    FromRecipient, Some(address) ->
      linking.find(
        payments.links,
        did: payment.recipient_did,
        address: address,
        chain_id: payment.chain_id,
      )
    FromRecipient, None -> None
  }
}

fn reconcile(payments: Payments, payment: Payment) -> Payment {
  use <- unless(list.contains(open_states, payment.state), payment)
  let link = desired(payments, payment)
  let address = option.map(link, fn(link) { link.address })
  let proof = option.map(link, fingerprint)
  use <- unless(
    address != payment.address || proof != payment.fingerprint,
    payment,
  )
  let table = table()
  let _ =
    update(
      table.table,
      [
        set(table.address, address),
        set(table.fingerprint, proof),
        set(
          table.state,
          state_name(case link {
            Some(_) -> Ready
            None -> Waiting
          }),
        ),
        set(table.revision, payment.revision + 1),
      ],
      [
        eq(table.id, payment.id),
        eq(table.revision, payment.revision),
        in_list(table.state, list.map(open_states, state_name)),
      ],
    )
    |> run(payments.store.database)
  result.unwrap(row(payments, Some(payment.id)), payment)
}

fn require_open(
  payments: Payments,
  payment: Payment,
) -> Result(Nil, HttpError) {
  use <- bool.guard(
    when: payment.expires_at <= payments.now(),
    return: Error(error.gone(
      "This payment intent has expired. No funds were reserved.",
    )),
  )
  Ok(Nil)
}

fn is_linked(payments: Payments, did: String, address: String) -> Bool {
  linking.find(
    payments.links,
    did: did,
    address: address,
    chain_id: payments.chain_id,
  )
  != None
}

fn fingerprint(link: Link) -> String {
  node.sha256(
    link.address <> ":" <> int.to_string(link.chain_id) <> ":" <> link.signature,
  )
}

fn invitation_url(payments: Payments, token: String) -> String {
  payments.origin <> "/#invite=" <> token
}

pub fn to_json(
  payment: Payment,
  payments: Payments,
  sender sender: Bool,
) -> Json {
  let displayed = case
    payment.expires_at <= payments.now()
    && list.contains([Waiting, Ready, Prepared], payment.state)
  {
    True -> Expired
    False -> payment.state
  }
  let common = [
    #("id", json.string(payment.id)),
    #("senderDid", json.string(payment.sender_did)),
    #("recipientDid", json.string(payment.recipient_did)),
    #("recipientLabel", json.string(payment.recipient_label)),
    #("chainId", json.int(payment.chain_id)),
    #("asset", json.string("ETH")),
    #("amount", json.string(viem.to_ether(payment.amount_wei))),
    #("amountWei", json.string(payment.amount_wei)),
    #("description", json.nullable(payment.description, json.string)),
    #("media", payment_media.to_json(payment.media)),
    #("sender", profile_json(payments, payment.sender_did)),
    #("recipient", profile_json(payments, payment.recipient_did)),
    #("state", json.string(state_name(displayed))),
    #(
      "address",
      json.nullable(option.map(payment.address, viem.checksum), json.string),
    ),
    #("revision", json.int(payment.revision)),
    #("source", json.string(source_name(payment.source))),
    #("createdAt", json.string(node.iso8601(payment.created_at))),
    #("expiresAt", json.string(node.iso8601(payment.expires_at))),
    #("txHash", json.nullable(payment.tx_hash, json.string)),
    #("error", json.nullable(payment.error, json.string)),
    #("confirmationsRequired", json.int(payments.confirmations)),
  ]
  json.object(case sender {
    False -> common
    True ->
      list.append(common, [
        #("attemptId", json.nullable(payment.attempt_id, json.string)),
        #(
          "fromAddress",
          json.nullable(
            option.map(payment.from_address, viem.checksum),
            json.string,
          ),
        ),
        #("nonce", json.nullable(payment.nonce, json.int)),
      ])
  })
}

pub fn attempt_to_json(attempt: Attempt, payments: Payments) -> Json {
  json.object([
    #("payment", to_json(attempt.payment, payments, sender: True)),
    #("attemptId", json.string(attempt.attempt_id)),
    #(
      "transaction",
      json.object([
        #("from", json.string(attempt.from)),
        #("to", json.string(attempt.to)),
        #("value", json.string(viem.hex_of_wei(attempt.value_wei))),
        #("chainId", json.string(viem.hex_of_int(attempt.payment.chain_id))),
        #("nonce", json.string(viem.hex_of_int(attempt.nonce))),
        #("data", json.string("0x")),
      ]),
    ),
  ])
}

fn state_name(state: State) -> String {
  case state {
    Waiting -> "waiting"
    Ready -> "ready"
    Prepared -> "prepared"
    Submitted -> "submitted"
    Confirming -> "confirming"
    Confirmed -> "confirmed"
    Failed -> "failed"
    Cancelled -> "cancelled"
    Expired -> "expired"
  }
}

fn state_of(name: String) -> Option(State) {
  case name {
    "waiting" -> Some(Waiting)
    "ready" -> Some(Ready)
    "prepared" -> Some(Prepared)
    "submitted" -> Some(Submitted)
    "confirming" -> Some(Confirming)
    "confirmed" -> Some(Confirmed)
    "failed" -> Some(Failed)
    "cancelled" -> Some(Cancelled)
    "expired" -> Some(Expired)
    _ -> None
  }
}

fn source_name(source: Source) -> String {
  case source {
    FromDefault -> "default"
    FromRecipient -> "recipient"
  }
}

fn payment_decoder() -> Decoder(Payment) {
  use id <- decode.field("id", decode.string)
  use sender_did <- decode.field("sender_did", decode.string)
  use recipient_did <- decode.field("recipient_did", decode.string)
  use recipient_label <- decode.field("recipient_label", decode.string)
  use chain_id <- decode.field("chain_id", decode.int)
  use amount_wei <- decode.field("amount_wei", decode.string)
  use description <- decode.field("description", decode.optional(decode.string))
  use media <- decode.field("media", decode.optional(decode.string))
  use state <- decode.field("state", decode.string)
  use source <- decode.field("source", decode.string)
  use address <- decode.field("address", decode.optional(decode.string))
  use fingerprint <- decode.field("fingerprint", decode.optional(decode.string))
  use revision <- decode.field("revision", decode.int)
  use created_at <- decode.field("created_at", decode.int)
  use expires_at <- decode.field("expires_at", decode.int)
  use attempt_id <- decode.field("attempt_id", decode.optional(decode.string))
  use from_address <- decode.field(
    "from_address",
    decode.optional(decode.string),
  )
  use nonce <- decode.field("nonce", decode.optional(decode.int))
  use tx_hash <- decode.field("tx_hash", decode.optional(decode.string))
  use error <- decode.field("error", decode.optional(decode.string))
  decode.success(Payment(
    id: id,
    sender_did: sender_did,
    recipient_did: recipient_did,
    recipient_label: recipient_label,
    chain_id: chain_id,
    amount_wei: amount_wei,
    description: description,
    media: media,
    state: option.unwrap(state_of(state), Failed),
    source: case source {
      "recipient" -> FromRecipient
      _ -> FromDefault
    },
    address: address,
    fingerprint: fingerprint,
    revision: revision,
    created_at: created_at,
    expires_at: expires_at,
    attempt_id: attempt_id,
    from_address: from_address,
    nonce: nonce,
    tx_hash: tx_hash,
    error: error,
  ))
}

fn table() -> payments_schema.Payments(Payment) {
  payments_schema.define(payment_decoder())
}

fn guard(
  condition: Bool,
  reason: HttpError,
  continue: fn() -> Promise(Result(a, HttpError)),
) -> Promise(Result(a, HttpError)) {
  case condition {
    True -> continue()
    False -> promise.resolve(Error(reason))
  }
}

fn unless(condition: Bool, fallback: a, continue: fn() -> a) -> a {
  case condition {
    True -> continue()
    False -> fallback
  }
}

fn participant(
  payments: Payments,
  id: Option(String),
  did: String,
) -> Result(Payment, HttpError) {
  use payment <- result.try(row(payments, id))
  case payment.sender_did == did || payment.recipient_did == did {
    True -> Ok(payment)
    False -> Error(error.not_found("Payment not found."))
  }
}

/// Only the sender can remove a cancelled, never-broadcast intent.
pub fn delete_cancelled(
  payments: Payments,
  did: String,
  id: Option(String),
) -> Result(Nil, HttpError) {
  use payment <- result.try(owned(payments, id, did))
  use <- bool.guard(
    when: payment.state != Cancelled || payment.tx_hash != None,
    return: Error(error.conflict(
      "Only cancelled payment intents can be deleted.",
    )),
  )
  let table = table()
  use changed <- result.try(
    delete(table.table, [
      eq(table.id, payment.id),
      eq(table.sender_did, did),
      eq(table.state, "cancelled"),
      is_null(table.tx_hash),
    ])
    |> run(payments.store.database)
    |> result.replace_error(error.unavailable(
      "Could not delete the intent. Please try again.",
    )),
  )
  case changed {
    1 -> Ok(Nil)
    _ -> Error(error.conflict("The payment changed. Refresh and try again."))
  }
}
