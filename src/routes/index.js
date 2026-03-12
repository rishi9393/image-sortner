const express = require("express");
const router = express.Router();

const healthRoutes = require("./healthRoutes");
const uploadRoutes = require("./uploadRoutes");
const processRoutes = require("./processRoutes");
const exportRoutes = require("./exportRoutes");

// ── Route modules ─────────────────────────────────────────────────────────────

router.use("/health", healthRoutes);

// POST /api/upload  → receive image batch, create session
router.use("/upload", uploadRoutes);

// POST /api/process/:sessionId  → run OCR + sort
// GET  /api/process/:sessionId  → retrieve results
router.use("/process", processRoutes);

// GET /api/export/:sessionId  → download sorted PDF
router.use("/export", exportRoutes);

module.exports = router;
