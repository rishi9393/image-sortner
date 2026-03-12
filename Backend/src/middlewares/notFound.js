const AppError = require("../utils/AppError");

/**
 * Middleware to handle 404 - Route not found.
 * Placed after all route definitions.
 */
function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, "NOT_FOUND"));
}

module.exports = notFound;
