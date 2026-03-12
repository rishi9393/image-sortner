const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const config = require("./config");
const routes = require("./routes");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");
const logger = require("./utils/logger");

// Initialize Express app
const app = express();

// ---------------------
// Global Middlewares
// ---------------------

// Enable CORS for frontend access
app.use(cors());

// HTTP request logging (dev format in development, combined in production)
app.use(morgan(config.nodeEnv === "development" ? "dev" : "combined"));

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically (for preview)
app.use("/uploads", express.static(path.join(config.paths.uploads)));

// Serve React build (production) — built output lives in Frontend/dist/
app.use(express.static(path.join(__dirname, "../../Frontend/dist")));

// ---------------------
// API Routes
// ---------------------

// All API routes mounted under /api
app.use("/api", routes);

// ---------------------
// SPA Catch-all (serves React index.html for any non-API route)
// Express 5 requires named wildcard syntax: /{*splat}
// ---------------------
app.get("/{*splat}", (req, res, next) => {
  const indexPath = path.join(__dirname, "../../Frontend/dist/index.html");
  res.sendFile(indexPath, (err) => {
    if (err) next(); // fallback to 404 handler if no build exists
  });
});

// ---------------------
// Error Handling
// ---------------------

// Handle 404 - Route not found
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
