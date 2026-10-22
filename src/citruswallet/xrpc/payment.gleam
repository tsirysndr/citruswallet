import citruswallet/error.{type HttpError}
import citruswallet/ffi/hono.{type Context}
import citruswallet/ffi/js
import citruswallet/identity
import citruswallet/payments
import gleam/javascript/promise.{type Promise}
import gleam/json
import gleam/list
import gleam/result

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
  context.done({
    use #(_, did) <- result.map(context.authenticated(server, ctx))
    Payload(
      200,
      json.object([
        #(
          "payments",
          json.array(payments.list(server.payments, did), fn(payment) {
            payments.to_json(payment, server.payments, sender: True)
          }),
        ),
      ]),
    )
  })
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
  context.done(Ok(one_payment(server, payment, sender: True)))
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
