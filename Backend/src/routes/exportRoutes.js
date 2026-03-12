const express = require("express");
const router = express.Router();

const { exportPDF } = require("../controllers/exportController");

/**
 * GET /api/export/:sessionId
 * Generate (or serve cached) PDF of sorted images and stream it to the client.
 */
router.get("/:sessionId", exportPDF);

module.exports = router;
