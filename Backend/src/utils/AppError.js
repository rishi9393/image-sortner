/**
 * Custom error class for application-specific errors.
 * Allows setting HTTP status code and error type.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, type = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.type = type;
    this.isOperational = true; // Distinguishes expected errors from bugs

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
