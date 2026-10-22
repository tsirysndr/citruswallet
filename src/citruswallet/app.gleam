import citruswallet/directory
import citruswallet/error.{HttpError}
import citruswallet/ffi/hono
import citruswallet/ffi/node
import citruswallet/xrpc/auth
import citruswallet/xrpc/context
import citruswallet/xrpc/register
import gleam/javascript/promise

pub type Settings =
  context.Settings

const screens = ["/wallet", "/payments", "/activity"]

const guarded = ["/xrpc/*", "/auth/*"]

const suggesting = ["/xrpc/app.citruswallet.searchActors"]

pub fn build(settings: Settings) -> hono.App {
  let server = context.configure(settings)
  let app = hono.new()

  hono.use_(
    app,
    hono.security(
      context.is_secure(settings.origin),
      image_sources: directory.avatar_hosts,
    ),
  )
  hono.use_on(
    app,
    guarded,
    hono.body_limit(8192, fn(ctx) {
      promise.resolve(context.refuse(
        ctx,
        HttpError(413, "Request body is too large."),
      ))
    }),
  )
  hono.use_on(app, suggesting, context.limiting(server.search_limiter))
  hono.use_on(app, guarded, context.limiting(server.limiter))
  hono.use_on(app, guarded, context.no_store())
  hono.use_(app, context.same_origin(server))
  hono.use_on(app, guarded, context.csrf(server))

  register.register(app, server)
  hono.get(
    app,
    "/client-metadata.json",
    context.serve(server, auth.client_metadata),
  )
  hono.get(app, "/auth/callback", context.serve(server, auth.finish_login))

  hono.use_(app, hono.files(settings.public_directory))
  hono.use_on(app, screens, hono.document(settings.public_directory))
  hono.not_found(app, fn(ctx) {
    promise.resolve(context.refuse(ctx, error.not_found("Not found.")))
  })
  hono.on_error(app, fn(thrown, ctx) {
    node.log_error("Request failed: " <> thrown.name)
    context.refuse(ctx, HttpError(500, "Request failed. Please try again."))
  })
  app
}
