import gleam/bool
import gleam/dynamic/decode.{type Decoder}
import gleam/javascript/promise.{type Promise}
import gleam/json.{type Json}
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string
import peachlet/address_records
import peachlet/drizzle/orm.{
  type Assignment, all, bool_decoder, delete, descending, eq, from, gt, insert,
  on_conflict_update, one, order_by, pick, run as db_run, select, set, target,
  update as db_update, where,
}
import peachlet/drizzle/schema/challenges as challenges_schema
import peachlet/drizzle/schema/links as links_schema
import peachlet/error.{type HttpError}
import peachlet/ffi/node
import peachlet/ffi/url
import peachlet/ffi/viem
import peachlet/store.{type Store}
import peachlet/validate

pub type Links {
  Links(store: Store, origin: String, chain_id: Int, now: fn() -> Int)
}

pub type Link {
  Link(
    did: String,
    address: String,
    chain_id: Int,
    message: String,
    signature: String,
    linked_at: String,
    is_public: Bool,
    is_default: Bool,
  )
}

pub type Challenge {
  Challenge(
    id: String,
    session: String,
    did: String,
    address: String,
    message: String,
    expires: Int,
    is_public: Bool,
  )
}

const challenge_lifetime = 300_000

pub fn new(store: Store, origin: String, chain_id: Int) -> Links {
  Links(store: store, origin: origin, chain_id: chain_id, now: node.now)
}

fn link_decoder() -> Decoder(Link) {
  use did <- decode.field("did", decode.string)
  use address <- decode.field("address", decode.string)
  use chain_id <- decode.field("chain_id", decode.int)
  use message <- decode.field("message", decode.string)
  use signature <- decode.field("signature", decode.string)
  use linked_at <- decode.field("linked_at", decode.string)
  use is_public <- decode.field("public", bool_decoder())
  use is_default <- decode.field("is_default", bool_decoder())
  decode.success(Link(
    did: did,
    address: address,
    chain_id: chain_id,
    message: message,
    signature: signature,
    linked_at: linked_at,
    is_public: is_public,
    is_default: is_default,
  ))
}

fn challenge_decoder() -> Decoder(Challenge) {
  use id <- decode.field("id", decode.string)
  use session <- decode.field("session", decode.string)
  use did <- decode.field("did", decode.string)
  use address <- decode.field("address", decode.string)
  use message <- decode.field("message", decode.string)
  use expires <- decode.field("expires", decode.int)
  use is_public <- decode.field("public", bool_decoder())
  decode.success(Challenge(
    id: id,
    session: session,
    did: did,
    address: address,
    message: message,
    expires: expires,
    is_public: is_public,
  ))
}

fn table() -> links_schema.Links(Link) {
  links_schema.define(link_decoder())
}

fn challenges() -> challenges_schema.Challenges(Challenge) {
  challenges_schema.define(challenge_decoder())
}

pub fn create(
  links: Links,
  session session: String,
  did did: String,
  address address: Option(String),
  discoverable discoverable: Bool,
) -> Result(Challenge, HttpError) {
  use address <- result.try(require_address(address))
  let issued = links.now()
  let expires = issued + challenge_lifetime
  let challenge =
    Challenge(
      id: node.random_hex(24),
      session: session,
      did: did,
      address: string.lowercase(address),
      message: viem.siwe_message(
        viem.Siwe(
          domain: host_of(links.origin),
          address: address,
          chain_id: links.chain_id,
          uri: links.origin <> "/wallet-link",
          nonce: node.random_hex(24),
          issued_at: issued,
          expiration_time: expires,
          statement: "Link this wallet to AT Protocol account "
            <> did
            <> ". This does not authorize transactions.",
          resources: [did],
        ),
      ),
      expires: expires,
      is_public: discoverable,
    )
  store.forget_challenges(links.store, session)
  let challenges = challenges()
  let _ =
    insert(challenges.table, [
      set(challenges.id, challenge.id),
      set(challenges.session, challenge.session),
      set(challenges.did, challenge.did),
      set(challenges.address, challenge.address),
      set(challenges.message, challenge.message),
      set(challenges.expires, challenge.expires),
      set(challenges.is_public, challenge.is_public),
    ])
    |> db_run(links.store.database)
  Ok(challenge)
}

pub fn verify(
  links: Links,
  session session: String,
  did did: String,
  id id: Option(String),
  signature signature: Option(String),
) -> Promise(Result(List(Link), HttpError)) {
  case pending(links, session, did, id, signature) {
    Error(reason) -> promise.resolve(Error(reason))
    Ok(#(challenge, signature)) -> {
      use valid <- promise.await(viem.verify_message(
        address: viem.checksum(challenge.address),
        message: challenge.message,
        signature: signature,
      ))
      promise.resolve(case valid {
        False ->
          Error(error.bad_request(
            "Signature does not match the selected wallet.",
          ))
        True -> record(links, challenge, signature)
      })
    }
  }
}

fn pending(
  links: Links,
  session: String,
  did: String,
  id: Option(String),
  signature: Option(String),
) -> Result(#(Challenge, String), HttpError) {
  let invalid = error.bad_request("Invalid challenge or signature.")
  use id <- result.try(option.to_result(id, invalid))
  use signature <- result.try(option.to_result(signature, invalid))
  use <- bool.guard(
    when: !validate.is_hex_quantity(signature, digits: 130),
    return: Error(invalid),
  )
  let stale =
    error.bad_request(
      "Challenge expired or unavailable. Request a new signature.",
    )
  use challenge <- result.try(option.to_result(find_challenge(links, id), stale))
  use <- bool.guard(
    when: !{
      challenge.session == session
      && challenge.did == did
      && challenge.expires > links.now()
    },
    return: Error(stale),
  )
  use <- bool.guard(
    when: viem.siwe_chain_id(challenge.message) != Some(links.chain_id),
    return: Error(error.bad_request(
      "Network configuration changed. Request a new signature.",
    )),
  )
  Ok(#(challenge, signature))
}

fn record(
  links: Links,
  challenge: Challenge,
  signature: String,
) -> Result(List(Link), HttpError) {
  let table = table()
  let challenges = challenges()
  use _ <- result.map(
    store.transaction(
      links.store,
      failed: error.conflict("Could not record this wallet. Try again."),
      run: fn(database) {
        let consumed =
          delete(challenges.table, [
            eq(challenges.id, challenge.id),
            eq(challenges.session, challenge.session),
            eq(challenges.did, challenge.did),
            gt(challenges.expires, links.now()),
          ])
          |> db_run(database)
        use <- bool.guard(
          when: consumed != Ok(1),
          return: Error(error.bad_request("Challenge already used or expired.")),
        )
        use <- bool.guard(
          when: case owner_of(links, challenge.address) {
            Some(owner) -> owner != challenge.did
            None -> False
          },
          return: Error(error.conflict(
            "This address is linked to another DID. Unlink it there first.",
          )),
        )
        let written =
          insert(table.table, [
            set(table.did, challenge.did),
            set(table.address, challenge.address),
            set(table.chain_id, links.chain_id),
            set(table.message, challenge.message),
            set(table.signature, signature),
            set(table.linked_at, node.iso8601(links.now())),
            set(table.is_public, challenge.is_public),
            set(table.is_default, False),
          ])
          |> on_conflict_update(
            [
              target(table.did),
              target(table.address),
              target(table.chain_id),
            ],
            [
              set(table.message, challenge.message),
              set(table.signature, signature),
              set(table.linked_at, node.iso8601(links.now())),
              set(table.is_public, challenge.is_public),
              ..private_withdraws_default(table, challenge.is_public)
            ],
          )
          |> db_run(database)
        use <- bool.guard(
          when: result.is_error(written),
          return: Error(error.conflict(
            "Could not record this wallet. Try again.",
          )),
        )
        case
          challenge.is_public,
          default_address(links, challenge.did, links.chain_id)
        {
          True, None -> {
            let _ =
              db_update(table.table, [set(table.is_default, True)], [
                eq(table.did, challenge.did),
                eq(table.address, challenge.address),
                eq(table.chain_id, links.chain_id),
              ])
              |> db_run(database)
            Nil
          }
          _, _ -> Nil
        }
        address_records.queue_verified(
          links.store.client,
          challenge.did,
          links.chain_id,
          challenge.address,
          challenge.is_public,
          challenge.message,
          signature,
          node.iso8601(links.now()),
        )
        Ok(Nil)
      },
    ),
  )
  list(links, challenge.did, public_only: False)
}

fn private_withdraws_default(
  table: links_schema.Links(Link),
  is_public: Bool,
) -> List(Assignment) {
  case is_public {
    True -> []
    False -> [set(table.is_default, False)]
  }
}

pub fn list(
  links: Links,
  did: String,
  public_only public_only: Bool,
) -> List(Link) {
  let table = table()
  let filter = case public_only {
    True -> [eq(table.is_public, True)]
    False -> []
  }
  from(table.table)
  |> where([eq(table.did, did), ..filter])
  |> order_by([descending(table.linked_at)])
  |> all(links.store.database)
}

pub fn find(
  links: Links,
  did did: String,
  address address: String,
  chain_id chain_id: Int,
) -> Option(Link) {
  let table = table()
  from(table.table)
  |> where([
    eq(table.did, did),
    eq(table.address, string.lowercase(address)),
    eq(table.chain_id, chain_id),
  ])
  |> one(links.store.database)
}

pub fn default_address(
  links: Links,
  did: String,
  chain_id: Int,
) -> Option(Link) {
  let table = table()
  from(table.table)
  |> where([
    eq(table.did, did),
    eq(table.chain_id, chain_id),
    eq(table.is_public, True),
    eq(table.is_default, True),
  ])
  |> one(links.store.database)
}

pub fn set_default(
  links: Links,
  did: String,
  address: Option(String),
) -> Result(List(Link), HttpError) {
  use address <- result.try(require_address(address))
  let link = find(links, did: did, address: address, chain_id: links.chain_id)
  use <- bool.guard(
    when: option.map(link, fn(link) { link.is_public }) != Some(True),
    return: Error(error.bad_request(
      "Choose a publicly discoverable linked address on this network.",
    )),
  )
  let table = table()
  use _ <- result.map(
    store.transaction(
      links.store,
      failed: error.conflict(
        "Could not update the receiving default. Try again.",
      ),
      run: fn(database) {
        let _ =
          db_update(table.table, [set(table.is_default, False)], [
            eq(table.did, did),
            eq(table.chain_id, links.chain_id),
          ])
          |> db_run(database)
        db_update(table.table, [set(table.is_default, True)], [
          eq(table.did, did),
          eq(table.address, string.lowercase(address)),
          eq(table.chain_id, links.chain_id),
        ])
        |> db_run(database)
        |> result.replace_error(error.conflict(
          "Could not update the receiving default. Try again.",
        ))
      },
    ),
  )
  list(links, did, public_only: False)
}

pub fn unlink(
  links: Links,
  did: String,
  address: String,
) -> Result(Nil, HttpError) {
  use <- bool.guard(
    when: !viem.is_address(address),
    return: Error(error.bad_request("Invalid Ethereum address.")),
  )
  let table = table()
  store.transaction(
    links.store,
    failed: error.conflict("Could not unlink this wallet."),
    run: fn(database) {
      let removed =
        delete(table.table, [
          eq(table.did, did),
          eq(table.address, string.lowercase(address)),
          eq(table.chain_id, links.chain_id),
        ])
        |> db_run(database)
      use count <- result.try(result.replace_error(
        removed,
        error.conflict("Could not unlink this wallet."),
      ))
      case count > 0 {
        True ->
          address_records.queue_removed(
            links.store.client,
            did,
            links.chain_id,
            address,
          )
        False -> Nil
      }
      Ok(Nil)
    },
  )
}

pub fn to_json(link: Link) -> Json {
  json.object([
    #("did", json.string(link.did)),
    #("address", json.string(viem.checksum(link.address))),
    #("chain_id", json.int(link.chain_id)),
    #("message", json.string(link.message)),
    #("signature", json.string(link.signature)),
    #("linked_at", json.string(link.linked_at)),
    #("public", json.bool(link.is_public)),
    #("is_default", json.bool(link.is_default)),
  ])
}

pub fn challenge_to_json(challenge: Challenge, chain_id: Int) -> Json {
  json.object([
    #("id", json.string(challenge.id)),
    #("address", json.string(viem.checksum(challenge.address))),
    #("chainId", json.int(chain_id)),
    #("message", json.string(challenge.message)),
    #("expiresAt", json.string(node.iso8601(challenge.expires))),
  ])
}

fn require_address(address: Option(String)) -> Result(String, HttpError) {
  let invalid = error.bad_request("Invalid Ethereum address.")
  use address <- result.try(option.to_result(address, invalid))
  use <- bool.guard(when: !viem.is_address(address), return: Error(invalid))
  Ok(viem.checksum(address))
}

fn owner_of(links: Links, address: String) -> Option(String) {
  let table = table()
  select(table.table, pick("did", table.did))
  |> where([
    eq(table.address, address),
    eq(table.chain_id, links.chain_id),
  ])
  |> one(links.store.database)
}

fn find_challenge(links: Links, id: String) -> Option(Challenge) {
  let challenges = challenges()
  from(challenges.table)
  |> where([eq(challenges.id, id)])
  |> one(links.store.database)
}

fn host_of(origin: String) -> String {
  case url.parse(origin) {
    Ok(parsed) -> url.host(parsed)
    Error(_) -> origin
  }
}
