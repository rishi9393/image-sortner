const express = require("express");
const router  = express.Router();

const {
  processSession,
  processSessionStream,
  getProcessResults,
} = require("../controllers/processController");

/**
 * POST /api/process/:sessionId
 * Trigger analysis + sorting; returns full JSON result when complete.
 */
router.post("/:sessionId", processSession);

/**
 * GET /api/process/:sessionId/stream
 * Server-Sent Events (SSE) endpoint.
 * Streams real-time per-image progress then sends the full sorted result.
 * Use this instead of the POST endpoint when you want live progress feedback.
 */
router.get("/:sessionId/stream", processSessionStream);

/**
 * GET /api/process/:sessionId
 * Retrieve already-computed sorted results without re-running analysis.
 */
router.get("/:sessionId", getProcessResults);

module.exports = router;
