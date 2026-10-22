import citruswallet/error.{type HttpError}
import citruswallet/ffi/hono.{type Context}
import citruswallet/ffi/js
import citruswallet/ffi/node
import citruswallet/identity
import citruswallet/payments
import citruswallet/profiles
import gleam/int
import gleam/javascript/promise.{type Promise}
import gleam/json
import gleam/list
import gleam/option.{Some}
import gleam/result
import gleam/string

import citruswallet/xrpc/context.{type Reply, type Server, Payload}

pub fn resolve_recipient(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(context.read_body(ctx))
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  use #(recipient, address) <- promise.try_await(payments.resolve(
    server.payments,
    did,
    js.string_field(body, "identifier"),
  ))
  context.done(
    Ok(Payload(
      200,
      json.object(
        list.append(identity.to_json(recipient), [
          #("chainId", json.int(server.settings.network.chain_id)),
          #("address", json.nullable(address, json.string)),
        ]),
      ),
    )),
  )
}

pub fn create_payment(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(context.read_body(ctx))
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  use #(payment, invitation) <- promise.try_await(payments.create(
    server.payments,
    sender_did: did,
    identifier: js.string_field(body, "identifier"),
    expected_did: js.string_field(body, "expectedDid"),
    amount: js.string_field(body, "amount"),
    description: js.string_field(body, "description"),
  ))
  context.done(
    Ok(Payload(
      201,
      json.object([
        #("payment", payments.to_json(payment, server.payments, sender: True)),
        #("invitationUrl", json.string(invitation)),
      ]),
    )),
  )
}

pub fn list_payments(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  use after <- context.attempt(timestamp_parameter(ctx, "after", 0))
  use before <- context.attempt(timestamp_parameter(
    ctx,
    "before",
    253_402_300_799_999,
  ))
  let filters =
    payments.Filters(
      query: hono.parameter(ctx, "q") |> option.unwrap("") |> string.trim,
      direction: hono.parameter(ctx, "direction") |> option.unwrap("all"),
      status: hono.parameter(ctx, "status") |> option.unwrap("all"),
      after: after,
      before: before,
      page: hono.int_parameter(ctx, "page") |> option.unwrap(1),
      page_size: hono.int_parameter(ctx, "pageSize") |> option.unwrap(20),
      sort: hono.parameter(ctx, "sort") |> option.unwrap("newest"),
    )
  use _ <- context.attempt(case filters.after <= filters.before {
    True -> Ok(Nil)
    False ->
      Error(error.bad_request("The start date must be before the end date."))
  })
  let page = payments.history(server.payments, did, filters)
  let dids =
    list.flat_map(page.payments, fn(payment) {
      [payment.sender_did, payment.recipient_did]
    })
    |> list.unique
  use _ <- promise.await(
    promise.await_list(
      list.map(dids, fn(did) {
        case profiles.get(server.settings.store, did) {
          Some(profile) ->
            case option.unwrap(profile.updated_at, 0) > node.now() - 3_600_000 {
              True -> promise.resolve(Ok(profile.actor))
              False ->
                profiles.refresh(
                  server.settings.store,
                  server.settings.directory,
                  did,
                )
            }
          _ ->
            profiles.refresh(
              server.settings.store,
              server.settings.directory,
              did,
            )
        }
      }),
    ),
  )
  context.done(
    Ok(Payload(
      200,
      json.object([
        #(
          "payments",
          json.array(page.payments, fn(payment) {
            payments.to_json(
              payment,
              server.payments,
              sender: payment.sender_did == did,
            )
          }),
        ),
        #("total", json.int(page.total)),
        #("page", json.int(filters.page)),
        #("pageSize", json.int(filters.page_size)),
      ]),
    )),
  )
}

pub fn read_payment(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  use payment <- promise.try_await(payments.get(
    server.payments,
    did,
    hono.parameter(ctx, "id"),
  ))
  context.done(
    Ok(one_payment(server, payment, sender: payment.sender_did == did)),
  )
}

pub fn invite(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  context.done({
    use #(_, did) <- result.try(context.authenticated(server, ctx))
    use invitation <- result.map(payments.invitation(
      server.payments,
      did,
      hono.parameter(ctx, "id"),
    ))
    Payload(200, json.object([#("invitationUrl", json.string(invitation))]))
  })
}

pub fn cancel_payment(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  context.done({
    use #(_, did) <- result.try(context.authenticated(server, ctx))
    use payment <- result.map(payments.cancel(
      server.payments,
      did,
      hono.parameter(ctx, "id"),
    ))
    one_payment(server, payment, sender: True)
  })
}

pub fn prepare_payment(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(context.read_body(ctx))
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  use attempt <- promise.try_await(payments.prepare(
    server.payments,
    did,
    hono.parameter(ctx, "id"),
    js.int_field(body, "revision"),
    js.string_field(body, "address"),
    js.string_field(body, "fromAddress"),
  ))
  context.done(
    Ok(Payload(200, payments.attempt_to_json(attempt, server.payments))),
  )
}

pub fn submit_payment(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(context.read_body(ctx))
  use #(_, did) <- context.attempt(context.authenticated(server, ctx))
  use payment <- promise.try_await(payments.submit(
    server.payments,
    did,
    hono.parameter(ctx, "id"),
    js.string_field(body, "attemptId"),
    js.string_field(body, "txHash"),
  ))
  context.done(Ok(one_payment(server, payment, sender: True)))
}

pub fn read_invitation(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  context.done({
    use #(_, did) <- result.try(context.authenticated(server, ctx))
    use payment <- result.map(payments.read_invitation(
      server.payments,
      hono.parameter(ctx, "token"),
      did,
    ))
    one_payment(server, payment, sender: False)
  })
}

pub fn accept_invitation(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  use body <- promise.try_await(context.read_body(ctx))
  context.done({
    use #(_, did) <- result.try(context.authenticated(server, ctx))
    use payment <- result.map(payments.accept(
      server.payments,
      hono.parameter(ctx, "token"),
      did,
      js.string_field(body, "address"),
    ))
    one_payment(server, payment, sender: False)
  })
}

pub fn one_payment(
  server: Server,
  payment: payments.Payment,
  sender sender: Bool,
) -> Reply {
  Payload(
    200,
    json.object([
      #("payment", payments.to_json(payment, server.payments, sender: sender)),
    ]),
  )
}

pub fn delete_payment(
  server: Server,
  ctx: Context,
) -> Promise(Result(Reply, HttpError)) {
  context.done({
    use #(_, did) <- result.try(context.authenticated(server, ctx))
    use _ <- result.map(payments.delete_cancelled(
      server.payments,
      did,
      hono.parameter(ctx, "id"),
    ))
    Payload(200, json.object([#("ok", json.bool(True))]))
  })
}

fn timestamp_parameter(
  ctx: Context,
  name: String,
  fallback: Int,
) -> Result(Int, HttpError) {
  case hono.parameter(ctx, name) {
    option.None -> Ok(fallback)
    Some(value) ->
      case int.parse(value) {
        Ok(value) if value >= 0 && value <= 253_402_300_799_999 -> Ok(value)
        _ -> Error(error.bad_request("Invalid date filter."))
      }
  }
}
