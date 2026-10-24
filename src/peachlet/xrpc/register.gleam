import peachlet/ffi/hono
import peachlet/xrpc/actor
import peachlet/xrpc/address
import peachlet/xrpc/asset
import peachlet/xrpc/auth
import peachlet/xrpc/context.{type Server}
import peachlet/xrpc/fees
import peachlet/xrpc/methods
import peachlet/xrpc/native
import peachlet/xrpc/notification
import peachlet/xrpc/payment

pub fn register(app: hono.App, server: Server) -> Nil {
  hono.xrpc(app, methods.estimate_fees, context.serve(server, fees.estimate))
  hono.xrpc(
    app,
    methods.mark_all_notifications_read,
    context.serve(server, notification.read_all),
  )
  hono.xrpc(
    app,
    methods.get_web_push_config,
    context.serve(server, notification.web_settings),
  )
  hono.xrpc(
    app,
    methods.register_web_push,
    context.serve(server, notification.register_web),
  )
  hono.xrpc(
    app,
    methods.unregister_web_push,
    context.serve(server, notification.remove_web),
  )
  hono.xrpc(
    app,
    methods.list_notifications,
    context.serve(server, notification.listing),
  )
  hono.xrpc(
    app,
    methods.mark_notification_read,
    context.serve(server, notification.read),
  )
  hono.xrpc(
    app,
    methods.register_push_token,
    context.serve(server, notification.register_device),
  )
  hono.xrpc(
    app,
    methods.unregister_push_token,
    context.serve(server, notification.remove_device),
  )
  hono.xrpc(app, methods.subscribe_notifications, fn(ctx) {
    notification.subscribe(server, ctx)
  })
  hono.xrpc(
    app,
    methods.exchange_native_session,
    context.serve(server, native.redeem),
  )
  hono.xrpc(
    app,
    methods.get_session,
    context.serve(server, auth.current_session),
  )
  hono.xrpc(app, methods.start_login, context.serve(server, auth.start_login))
  hono.xrpc(
    app,
    methods.create_challenge,
    context.serve(server, address.create_challenge),
  )
  hono.xrpc(
    app,
    methods.verify_challenge,
    context.serve(server, address.verify_challenge),
  )
  hono.xrpc(
    app,
    methods.unlink_address,
    context.serve(server, address.unlink_wallet),
  )
  hono.xrpc(
    app,
    methods.set_default_address,
    context.serve(server, address.choose_default),
  )
  hono.xrpc(
    app,
    methods.resolve_recipient,
    context.serve(server, payment.resolve_recipient),
  )
  hono.xrpc(
    app,
    methods.create_payment,
    context.serve(server, payment.create_payment),
  )
  hono.xrpc(
    app,
    methods.list_payments,
    context.serve(server, payment.list_payments),
  )
  hono.xrpc(
    app,
    methods.get_payment,
    context.serve(server, payment.read_payment),
  )
  hono.xrpc(
    app,
    methods.create_invitation,
    context.serve(server, payment.invite),
  )
  hono.xrpc(
    app,
    methods.delete_payment,
    context.serve(server, payment.delete_payment),
  )
  hono.xrpc(
    app,
    methods.cancel_payment,
    context.serve(server, payment.cancel_payment),
  )
  hono.xrpc(
    app,
    methods.prepare_payment,
    context.serve(server, payment.prepare_payment),
  )
  hono.xrpc(
    app,
    methods.submit_payment,
    context.serve(server, payment.submit_payment),
  )
  hono.xrpc(
    app,
    methods.get_invitation,
    context.serve(server, payment.read_invitation),
  )
  hono.xrpc(
    app,
    methods.accept_invitation,
    context.serve(server, payment.accept_invitation),
  )
  hono.xrpc(app, methods.get_assets, context.serve(server, asset.listing))
  hono.xrpc(app, methods.get_asset, context.serve(server, asset.get))
  hono.xrpc(app, methods.logout, context.serve(server, auth.logout))
  hono.xrpc(
    app,
    methods.get_addresses,
    context.serve(server, address.public_links),
  )
  hono.xrpc(
    app,
    methods.search_actors,
    context.serve(server, actor.suggest_actors),
  )
  hono.xrpc(
    app,
    methods.get_profile,
    context.serve(server, actor.account_profile),
  )
  hono.xrpc(
    app,
    methods.sync_addresses,
    context.serve(server, address.sync_addresses),
  )
}
