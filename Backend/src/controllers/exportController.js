/**
 * Export Controller
 * Generates and streams a PDF of the sorted images for a processed session.
 */

const path = require("path");
const fs = require("fs");

const sessionService = require("../services/sessionService");
const pdfService = require("../services/pdfService");
const config = require("../config");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

/**
 * GET /api/export/:sessionId
 *
 * Generates a PDF (or returns a cached one) and streams it to the client
 * with appropriate headers for browser download.
 */
async function exportPDF(req, res, next) {
  const { sessionId } = req.params;

  try {
    const session = sessionService.getSession(sessionId);

    if (!session) {
      throw new AppError("Session not found.", 404, "SESSION_NOT_FOUND");
    }
    if (session.status !== "processed") {
      throw new AppError(
        `Session has not been processed yet (status: '${session.status}'). POST to /api/process/${sessionId} first.`,
        400,
        "NOT_PROCESSED"
      );
    }

    // ── Use cached PDF if it already exists ──────────────────────────────────
    let pdfPath = session.pdfPath;
    const pdfExists = pdfPath && fs.existsSync(pdfPath);

    if (!pdfExists) {
      pdfPath = path.join(
        config.upload.processedDir,
        sessionId,
        `sorted-notes-${sessionId}.pdf`
      );

      logger.info(`Generating PDF for session ${sessionId}…`);

      // Map sorted results to the shape pdfService expects
      const sortedImages = session.results.map((img) => ({
        filePath: img.filePath,
        originalName: img.originalName,
      }));

      await pdfService.generatePDF(sortedImages, pdfPath);

      // Cache the path in the session so subsequent requests reuse the file
      sessionService.updateSession(sessionId, { pdfPath });
    } else {
      logger.info(`Serving cached PDF for session ${sessionId}`);
    }

    // ── Stream to client ─────────────────────────────────────────────────────
    const filename = `sorted-notes.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    const stat = fs.statSync(pdfPath);
    res.setHeader("Content-Length", stat.size);

    const readStream = fs.createReadStream(pdfPath);
    readStream.on("error", (err) => {
      logger.error(`PDF read stream error: ${err.message}`);
      next(new AppError("Failed to read generated PDF.", 500, "PDF_READ_ERROR"));
    });

    readStream.pipe(res);
  } catch (err) {
    next(err);
  }
}

module.exports = { exportPDF };
