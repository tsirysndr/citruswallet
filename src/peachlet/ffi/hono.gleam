import peachlet/ffi/js.{type Exception, type Js}
import gleam/javascript/promise.{type Promise}
import gleam/list
import gleam/option.{type Option, None, Some}

pub type App =
  Js

pub type Context =
  Js

pub type Response =
  Js

pub type Server =
  Js

pub type Handler =
  fn(Context) -> Promise(Response)

pub type Middleware =
  Js

@external(javascript, "hono", "Hono")
fn hono_class() -> Js

pub fn new() -> App {
  js.construct(js.coerce(hono_class), [])
}

pub fn get(app: App, path: String, handler: Handler) -> Nil {
  route(app, "get", path, handler)
}

pub fn post(app: App, path: String, handler: Handler) -> Nil {
  route(app, "post", path, handler)
}

pub fn delete(app: App, path: String, handler: Handler) -> Nil {
  route(app, "delete", path, handler)
}

fn route(app: App, method: String, path: String, handler: Handler) -> Nil {
  let _ = js.call(app, method, [js.string(path), js.coerce(handler)])
  Nil
}

pub fn use_(app: App, middleware: Middleware) -> Nil {
  let _ = js.call(app, "use", [middleware])
  Nil
}

pub fn use_on(app: App, paths: List(String), middleware: Middleware) -> Nil {
  list.each(paths, fn(path) {
    let _ = js.call(app, "use", [js.string(path), middleware])
    Nil
  })
}

pub fn gate(decide: fn(Context) -> Promise(Option(Response))) -> Middleware {
  js.coerce(fn(context: Context, next: Js) -> Promise(Response) {
    use decision <- promise.await(decide(context))
    case decision {
      Some(response) -> promise.resolve(response)
      None -> continue(next)
    }
  })
}

pub fn continue(next: Js) -> Promise(Response) {
  js.coerce(js.apply(next, []))
}

pub fn not_found(app: App, handler: Handler) -> Nil {
  let _ = js.call(app, "notFound", [js.coerce(handler)])
  Nil
}

pub fn on_error(app: App, handler: fn(Exception, Context) -> Response) -> Nil {
  let wrapped = fn(thrown: Js, context: Context) -> Response {
    handler(
      js.Exception(name: name_of(thrown), message: message_of(thrown)),
      context,
    )
  }
  let _ = js.call(app, "onError", [js.coerce(wrapped)])
  Nil
}

fn name_of(thrown: Js) -> String {
  option.unwrap(js.string_field(thrown, "name"), "Error")
}

fn message_of(thrown: Js) -> String {
  option.unwrap(js.string_field(thrown, "message"), "Unknown error")
}

pub fn method(context: Context) -> String {
  option.unwrap(js.string_field(request(context), "method"), "GET")
}

pub fn url(context: Context) -> String {
  option.unwrap(js.string_field(request(context), "url"), "")
}

pub fn path(context: Context) -> String {
  option.unwrap(js.string_field(request(context), "path"), "/")
}

pub fn query_parameter(context: Context, name: String) -> Option(String) {
  js.as_string(js.call(request(context), "query", [js.string(name)]))
}

pub fn header(context: Context, name: String) -> Option(String) {
  js.as_string(js.call(request(context), "header", [js.string(name)]))
}

@external(javascript, "../../xrpc.mjs", "registerXrpc")
pub fn xrpc(app: App, nsid: String, handler: Handler) -> Nil

@external(javascript, "../../xrpc.mjs", "xrpcParameter")
fn xrpc_parameter(context: Context, name: String) -> Js

pub fn parameter(context: Context, name: String) -> Option(String) {
  js.as_string(xrpc_parameter(context, name))
}

pub fn text_body(context: Context) -> Promise(Result(String, Exception)) {
  js.attempt_promise(js.call(request(context), "text", []))
}

fn request(context: Context) -> Js {
  js.get(context, "req")
}

pub fn set_header(context: Context, name: String, value: String) -> Nil {
  let _ = js.call(context, "header", [js.string(name), js.string(value)])
  Nil
}

pub fn json(context: Context, status: Int, body: String) -> Response {
  js.call(context, "newResponse", [
    js.string(body),
    js.int(status),
    js.object([#("content-type", js.string("application/json; charset=UTF-8"))]),
  ])
}

pub fn json_value(context: Context, status: Int, body: Js) -> Response {
  js.call(context, "json", [body, js.int(status)])
}

pub fn redirect(context: Context, location: String) -> Response {
  js.call(context, "redirect", [js.string(location), js.int(302)])
}

pub type Cookie {
  Cookie(
    http_only: Bool,
    secure: Bool,
    same_site: String,
    path: String,
    max_age: Option(Int),
  )
}

@external(javascript, "hono/cookie", "getCookie")
fn get_cookie(context: Context, name: String) -> Js

pub fn cookie(context: Context, name: String) -> Option(String) {
  js.as_string(get_cookie(context, name))
}

@external(javascript, "hono/cookie", "setCookie")
fn set_cookie(context: Context, name: String, value: String, options: Js) -> Nil

pub fn set(
  context: Context,
  name: String,
  value: String,
  cookie: Cookie,
) -> Nil {
  set_cookie(context, name, value, cookie_options(cookie))
}

@external(javascript, "hono/cookie", "deleteCookie")
fn delete_cookie(context: Context, name: String, options: Js) -> Js

pub fn clear(context: Context, name: String, cookie: Cookie) -> Nil {
  let _ = delete_cookie(context, name, cookie_options(cookie))
  Nil
}

fn cookie_options(cookie: Cookie) -> Js {
  let fixed = [
    #("httpOnly", js.bool(cookie.http_only)),
    #("secure", js.bool(cookie.secure)),
    #("sameSite", js.string(cookie.same_site)),
    #("path", js.string(cookie.path)),
  ]
  js.object(case cookie.max_age {
    Some(milliseconds) -> [#("maxAge", js.int(milliseconds / 1000)), ..fixed]
    None -> fixed
  })
}

@external(javascript, "hono/secure-headers", "secureHeaders")
fn secure_headers(options: Js) -> Middleware

pub fn security(
  secure: Bool,
  image_sources image_sources: List(String),
) -> Middleware {
  secure_headers(
    js.object([
      #("contentSecurityPolicy", content_security_policy(secure, image_sources)),
      #("strictTransportSecurity", case secure {
        True -> js.string("max-age=15552000; includeSubDomains")
        False -> js.bool(False)
      }),
    ]),
  )
}

fn content_security_policy(secure: Bool, image_sources: List(String)) -> Js {
  let directives = [
    #("defaultSrc", js.list([js.string("'self'")])),
    #("baseUri", js.list([js.string("'self'")])),
    #(
      "fontSrc",
      js.list([js.string("'self'"), js.string("https:"), js.string("data:")]),
    ),
    #("formAction", js.list([js.string("'self'")])),
    #("frameAncestors", js.list([js.string("'self'")])),
    #(
      "imgSrc",
      js.list(
        list.flatten([
          [
            js.string("'self'"),
            js.string("data:"),
            js.string("https://static.klipy.com"),
            js.string("https://static1.klipy.com"),
            js.string("https://static2.klipy.com"),
            // Hosts in the generated, chain-specific token logo registry.
            js.string("https://raw.githubusercontent.com"),
            js.string("https://assets.coingecko.com"),
            js.string("https://coin-images.coingecko.com"),
            js.string("https://assets.kraken.com"),
            js.string("https://s2.coinmarketcap.com"),
            js.string("https://www.geckoterminal.com"),
            js.string("https://arbitrum.foundation"),
          ],
          list.map(image_sources, fn(host) { js.string("https://" <> host) }),
        ]),
      ),
    ),
    #(
      "connectSrc",
      js.list([
        js.string("'self'"),
        // User-selected RPC endpoints are HTTPS, fetched directly by the device.
        js.string("https:"),
        js.string("wss://mm-sdk-relay.api.cx.metamask.io"),
      ]),
    ),
    #(
      "mediaSrc",
      js.list([
        js.string("'self'"),
        js.string("https://static.klipy.com"),
        js.string("https://static1.klipy.com"),
        js.string("https://static2.klipy.com"),
      ]),
    ),
    #("objectSrc", js.list([js.string("'none'")])),
    #("scriptSrc", js.list([js.string("'self'")])),
    #("scriptSrcAttr", js.list([js.string("'none'")])),
    #(
      "styleSrc",
      js.list([
        js.string("'self'"),
        js.string("https:"),
        js.string("'unsafe-inline'"),
      ]),
    ),
  ]
  js.object(case secure {
    True -> [#("upgradeInsecureRequests", js.list([])), ..directives]
    False -> directives
  })
}

@external(javascript, "hono/body-limit", "bodyLimit")
fn body_limit_raw(options: Js) -> Middleware

pub fn body_limit(bytes: Int, reject: Handler) -> Middleware {
  body_limit_raw(
    js.object([
      #("maxSize", js.int(bytes)),
      #("onError", js.coerce(reject)),
    ]),
  )
}

@external(javascript, "@hono/node-server/serve-static", "serveStatic")
fn serve_static(options: Js) -> Middleware

pub fn files(root: String) -> Middleware {
  serve_static(js.object([#("root", js.string(root))]))
}

/// Serves the single built document, whatever path asked for it, so a
/// client-side route survives a reload or a shared link.
pub fn document(root: String) -> Middleware {
  serve_static(
    js.object([#("root", js.string(root)), #("path", js.string("index.html"))]),
  )
}

@external(javascript, "@hono/node-server/conninfo", "getConnInfo")
fn conn_info(context: Context) -> Js

pub fn remote_address(context: Context) -> Option(String) {
  js.string_field(js.get(conn_info(context), "remote"), "address")
}

@external(javascript, "@hono/node-server", "serve")
fn serve(options: Js, ready: fn(Js) -> Nil) -> Server

pub fn listen(
  app: App,
  port: Int,
  hostname: String,
  ready: fn() -> Nil,
) -> Server {
  serve(
    js.object([
      #("fetch", js.get(app, "fetch")),
      #("port", js.int(port)),
      #("hostname", js.string(hostname)),
    ]),
    fn(_) { ready() },
  )
}

pub fn shutdown(server: Server, finished: fn() -> Nil) -> Nil {
  let _ = js.call(server, "close", [js.coerce(fn(_) { finished() })])
  Nil
}

pub fn int_parameter(context: Context, name: String) -> Option(Int) {
  js.as_int(xrpc_parameter(context, name))
}
