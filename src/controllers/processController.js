/**
 * Process Controller
 * Runs the full analysis pipeline on an uploaded session:
 *   1. Extract EXIF metadata
 *   2. OCR each image
 *   3. Detect page numbers in the extracted text
 *   4. Sort using the best available signal
 *
 * Also handles retrieving already-processed results.
 */

const sessionService = require("../services/sessionService");
const metadataService = require("../services/metadataService");
const ocrService = require("../services/ocrService");
const pageDetectionService = require("../services/pageDetectionService");
const sortingService = require("../services/sortingService");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

// ─── POST /api/process/:sessionId ────────────────────────────────────────────

/**
 * Trigger processing for a session.
 * This is intentionally synchronous (awaits completion) so the client
 * gets the sorted result in the same response. For very large batches
 * the client should be prepared to wait.
 */
async function processSession(req, res, next) {
  const { sessionId } = req.params;

  try {
    const session = sessionService.getSession(sessionId);
    if (!session) {
      throw new AppError("Session not found.", 404, "SESSION_NOT_FOUND");
    }
    if (session.status === "processing") {
      throw new AppError(
        "Session is already being processed. Please wait.",
        409,
        "ALREADY_PROCESSING"
      );
    }
    if (session.status === "processed") {
      // Return cached results immediately
      return res.status(200).json(buildResponse(session));
    }

    // ── Mark as processing ───────────────────────────────────────────────────
    sessionService.updateSession(sessionId, { status: "processing" });

    // ── Analyse each image ───────────────────────────────────────────────────
    logger.info(`Processing session ${sessionId} (${session.files.length} images)…`);

    const analyses = [];

    for (let i = 0; i < session.files.length; i++) {
      const file = session.files[i];

      logger.debug(`  Analysing [${i + 1}/${session.files.length}] ${file.originalName}`);

      // Run metadata extraction and OCR concurrently
      const [metadata, ocr] = await Promise.all([
        metadataService.extractMetadata(file.filePath),
        ocrService.extractText(file.filePath),
      ]);

      const pageDetection = pageDetectionService.detectPageNumber(ocr.text);

      analyses.push({
        ...file,
        originalIndex: i,
        metadata,
        ocr,
        pageDetection,
      });
    }

    // ── Sort ─────────────────────────────────────────────────────────────────
    const { sortedImages, sortMethod, sortMethodDescription } =
      sortingService.sortImages(analyses);

    // Attach 1-based sortedIndex to each result
    const results = sortedImages.map((img, idx) => ({
      ...img,
      sortedIndex: idx + 1,
    }));

    sessionService.updateSession(sessionId, {
      status: "processed",
      results,
      sortMethod,
      sortMethodDescription,
    });

    logger.info(
      `Session ${sessionId} processed. Method: ${sortMethod}`
    );

    return res.status(200).json(buildResponse(sessionService.getSession(sessionId)));
  } catch (err) {
    // On error, reset status so the client can retry
    sessionService.updateSession(sessionId, { status: "error" });
    next(err);
  }
}

// ─── GET /api/process/:sessionId ─────────────────────────────────────────────

/**
 * Retrieve the processing results for a session without rerunning analysis.
 */
async function getProcessResults(req, res, next) {
  const { sessionId } = req.params;
  try {
    const session = sessionService.getSession(sessionId);
    if (!session) {
      throw new AppError("Session not found.", 404, "SESSION_NOT_FOUND");
    }
    if (session.status !== "processed") {
      throw new AppError(
        `Session has not been processed yet. Current status: '${session.status}'. POST to /api/process/${sessionId} first.`,
        400,
        "NOT_PROCESSED"
      );
    }
    return res.status(200).json(buildResponse(session));
  } catch (err) {
    next(err);
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Build a clean JSON response from a fully processed session.
 * Strips internal fields (filePath) from the public response.
 */
function buildResponse(session) {
  return {
    success: true,
    data: {
      sessionId: session.sessionId,
      sortMethod: session.sortMethod,
      sortMethodDescription: session.sortMethodDescription,
      totalImages: session.results.length,
      images: session.results.map((img) => ({
        sortedIndex: img.sortedIndex,
        originalName: img.originalName,
        storedFilename: img.storedFilename,
        url: img.url,
        size: img.size,
        signals: {
          pageNumber: img.pageDetection
            ? {
                value: img.pageDetection.pageNumber,
                confidence: img.pageDetection.confidence,
                matchedText: img.pageDetection.matchedText,
                pattern: img.pageDetection.pattern,
              }
            : null,
          timestamp: img.metadata && img.metadata.earliestDate
            ? {
                value: img.metadata.earliestDate,
                source: img.metadata.timestamps?.[0]?.source || "unknown",
              }
            : null,
        },
        // Include a short excerpt of extracted text for debugging/display
        textPreview: img.ocr?.text
          ? img.ocr.text.substring(0, 300).replace(/\s+/g, " ").trim()
          : null,
        ocrConfidence: img.ocr?.confidence ?? null,
      })),
    },
  };
}

module.exports = { processSession, getProcessResults };
