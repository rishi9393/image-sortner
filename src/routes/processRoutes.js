const express = require("express");
const router = express.Router();

const {
  processSession,
  getProcessResults,
} = require("../controllers/processController");

/**
 * POST /api/process/:sessionId
 * Trigger analysis + sorting for an uploaded session.
 */
router.post("/:sessionId", processSession);

/**
 * GET /api/process/:sessionId
 * Retrieve already-computed sorted results without re-running analysis.
 */
router.get("/:sessionId", getProcessResults);

module.exports = router;
