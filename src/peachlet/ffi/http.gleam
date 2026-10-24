import peachlet/ffi/js.{type Exception, type Js}
import gleam/javascript/promise.{type Promise}
import gleam/option.{Some}

pub fn get_json(
  url: String,
  timeout timeout_ms: Int,
) -> Promise(Result(Js, Exception)) {
  let request =
    js.apply(js.global("fetch"), [
      js.string(url),
      js.object([
        #("method", js.string("GET")),
        #("redirect", js.string("error")),
        #("headers", js.object([#("accept", js.string("application/json"))])),
        #("signal", timeout(timeout_ms)),
      ]),
    ])
  use response <- promise.try_await(js.attempt_promise(request))
  case js.as_bool(js.get(response, "ok")) {
    Some(True) -> js.attempt_promise(js.call(response, "json", []))
    _ ->
      promise.resolve(
        Error(js.Exception(
          name: "HttpStatusError",
          message: "Upstream responded with an error status.",
        )),
      )
  }
}

fn timeout(milliseconds: Int) -> Js {
  js.call(js.global("AbortSignal"), "timeout", [js.int(milliseconds)])
}
