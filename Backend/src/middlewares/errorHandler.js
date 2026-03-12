const logger = require("../utils/logger");
const config = require("../config");

/**
 * Global error handling middleware.
 * Catches all errors and returns a consistent JSON response.
 */
function errorHandler(err, req, res, next) {
  // Default values
  const statusCode = err.statusCode || 500;
  const type = err.type || "INTERNAL_ERROR";

  // Log the error
  if (statusCode >= 500) {
    logger.error(`${type}: ${err.message}`, {
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
    });
  } else {
    logger.warn(`${type}: ${err.message}`);
  }

  // Build response
  const response = {
    success: false,
    error: {
      type: type,
      message: err.message || "Something went wrong",
    },
  };

  // Include stack trace only in development
  if (config.nodeEnv === "development") {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
