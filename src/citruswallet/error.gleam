pub type HttpError {
  HttpError(status: Int, message: String)
}

pub fn bad_request(message: String) -> HttpError {
  HttpError(400, message)
}

pub fn unauthorized(message: String) -> HttpError {
  HttpError(401, message)
}

pub fn forbidden(message: String) -> HttpError {
  HttpError(403, message)
}

pub fn not_found(message: String) -> HttpError {
  HttpError(404, message)
}

pub fn conflict(message: String) -> HttpError {
  HttpError(409, message)
}

pub fn gone(message: String) -> HttpError {
  HttpError(410, message)
}

pub fn unavailable(message: String) -> HttpError {
  HttpError(503, message)
}
