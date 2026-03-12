/**
 * Server entry point.
 *
 * Starts the Tesseract worker pool BEFORE the HTTP server begins accepting
 * requests, so that the very first upload never pays the cold-start cost.
 *
 * Also registers SIGTERM / SIGINT handlers for graceful shutdown:
 *   1. Stop accepting new HTTP connections
 *   2. Drain the OCR worker pool
 *   3. Exit cleanly
 */

"use strict";

const app    = require("./app");
const config = require("./config");
const logger = require("./utils/logger");
const { initPool, shutdownPool } = require("./services/ocrService");

async function start() {
  // ── 1. Warm up OCR worker pool ────────────────────────────────────────────
  // Tesseract workers each load ~30 MB of WASM + language data.
  // Doing this at startup means the first real request is served at full speed.
  try {
    await initPool();
  } catch (err) {
    // Non-fatal: the pool has a single-worker fallback, so the server can
    // still function — just slower on the very first request.
    logger.error(`Failed to initialise OCR worker pool: ${err.message}`);
  }

  // ── 2. Start HTTP server ──────────────────────────────────────────────────
  const server = app.listen(config.port, () => {
    logger.info(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
    logger.info(`Health check: http://localhost:${config.port}/api/health`);
  });

  // ── 3. Graceful shutdown ──────────────────────────────────────────────────
  async function shutdown(signal) {
    logger.info(`${signal} received — shutting down gracefully…`);
    server.close(async () => {
      await shutdownPool();
      logger.info("Clean exit.");
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
