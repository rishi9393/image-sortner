/**
 * Process Controller  –  v2 (fast pipeline)
 *
 * Three-stage processing with early-exit fast paths:
 *
 *  Fast path 0 — Filename sequence
 *    If every filename contains a sequential page number (e.g. page1.jpg …
 *    page5.jpg) we sort instantly without touching the filesystem at all.
 *
 *  Fast path 1 — EXIF timestamps
 *    Run all EXIF extractions in parallel (cheap, ~5 ms each).
 *    If ≥ 50 % of images have unique timestamps the sort is determined — skip OCR.
 *
 *  Standard path — Parallel OCR
 *    All OCR jobs are fired concurrently.  The worker pool (3 workers) queues
 *    excess requests so memory stays bounded.  EXIF metadata (already extracted)
 *    is reused — no double-read.
 */

"use strict";

const sessionService    = require("../services/sessionService");
const metadataService   = require("../services/metadataService");
const ocrService        = require("../services/ocrService");
const pageDetectionService = require("../services/pageDetectionService");
const sortingService    = require("../services/sortingService");
const AppError          = require("../utils/AppError");
const logger            = require("../utils/logger");

// Must match sortingService constant
const EXIF_QUORUM = 0.5;

// ─── POST /api/process/:sessionId ────────────────────────────────────────────

async function processSession(req, res, next) {
  const { sessionId } = req.params;
  const t0 = Date.now();

  try {
    // ── Guard checks ─────────────────────────────────────────────────────────
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
      return res.status(200).json(_buildResponse(session));
    }

    sessionService.updateSession(sessionId, { status: "processing" });

    const files = session.files;
    const n     = files.length;
    logger.info(`[${sessionId}] Processing ${n} image(s)…`);

    // ════════════════════════════════════════════════════════════════════════
    // FAST PATH 0 — Filename sequential order
    // Build bare analyses (no I/O) and ask sortingService if filenames encode
    // the page order.  If so, we're done without reading a single file.
    // ════════════════════════════════════════════════════════════════════════
    const bareAnalyses = files.map((file, i) => ({
      ...file,
      originalIndex: i,
      metadata:      { hasMetadata: false },
      ocr:           { text: "", confidence: 0 },
      pageDetection: null,
    }));

    const { sortMethod: fnMethod, sortedImages: fnSorted, sortMethodDescription: fnDesc } =
      sortingService.sortImages(bareAnalyses);

    if (fnMethod === "filename_order") {
      logger.info(
        `[${sessionId}] Fast path 0 (filename). Done in ${Date.now() - t0} ms.`
      );
      return _saveAndRespond(res, sessionId, fnSorted, fnMethod, fnDesc);
    }

    // ════════════════════════════════════════════════════════════════════════
    // FAST PATH 1 — EXIF timestamps
    // Read EXIF from all images in parallel (very fast ~5 ms each).
    // If enough unique timestamps exist, timestamps alone decide the order
    // and we skip OCR entirely.
    // ════════════════════════════════════════════════════════════════════════
    logger.info(`[${sessionId}] Step 1/2 — EXIF extraction (parallel)…`);
    const allMetadata = await Promise.all(
      files.map((f) => metadataService.extractMetadata(f.filePath))
    );

    const withTs     = allMetadata.filter((m) => m.hasMetadata && m.earliestDate instanceof Date);
    const uniqueTs   = new Set(withTs.map((m) => m.earliestDate.getTime()));
    const exifEnough = withTs.length / n >= EXIF_QUORUM && uniqueTs.size > 1;

    if (exifEnough) {
      logger.info(
        `[${sessionId}] Fast path 1 (EXIF): ${withTs.length}/${n} unique timestamps — skipping OCR.`
      );

      const analyses = files.map((file, i) => ({
        ...file,
        originalIndex: i,
        metadata:      allMetadata[i],
        ocr:           { text: "", confidence: 0 },
        pageDetection: null,
      }));

      const { sortedImages, sortMethod, sortMethodDescription } =
        sortingService.sortImages(analyses);

      logger.info(
        `[${sessionId}] Done in ${Date.now() - t0} ms. Method: ${sortMethod}`
      );
      return _saveAndRespond(res, sessionId, sortedImages, sortMethod, sortMethodDescription);
    }

    // ════════════════════════════════════════════════════════════════════════
    // STANDARD PATH — Parallel OCR
    // Fire all OCR jobs at once.  The worker pool (ocrService) queues jobs
    // beyond its pool size, so we never spin up more workers than configured.
    // EXIF metadata from step 1 is reused — not re-read.
    // ════════════════════════════════════════════════════════════════════════
    logger.info(
      `[${sessionId}] Step 2/2 — OCR (parallel, pool size 3)…`
    );

    const ocrResults = await Promise.all(
      files.map((f) => ocrService.extractText(f.filePath))
    );

    const analyses = files.map((file, i) => ({
      ...file,
      originalIndex: i,
      metadata:      allMetadata[i],
      ocr:           ocrResults[i],
      pageDetection: pageDetectionService.detectPageNumber(ocrResults[i].text),
    }));

    const { sortedImages, sortMethod, sortMethodDescription } =
      sortingService.sortImages(analyses);

    logger.info(
      `[${sessionId}] Done in ${Date.now() - t0} ms. Method: ${sortMethod}`
    );
    return _saveAndRespond(res, sessionId, sortedImages, sortMethod, sortMethodDescription);

  } catch (err) {
    sessionService.updateSession(sessionId, { status: "error" });
    next(err);
  }
}

// ─── GET /api/process/:sessionId ─────────────────────────────────────────────

async function getProcessResults(req, res, next) {
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
    return res.status(200).json(_buildResponse(session));
  } catch (err) {
    next(err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Persist results to the session store and send the HTTP response. */
function _saveAndRespond(res, sessionId, sortedImages, sortMethod, sortMethodDescription) {
  const results = sortedImages.map((img, idx) => ({ ...img, sortedIndex: idx + 1 }));

  sessionService.updateSession(sessionId, {
    status: "processed",
    results,
    sortMethod,
    sortMethodDescription,
  });

  return res.status(200).json(_buildResponse(sessionService.getSession(sessionId)));
}

/**
 * Build the public JSON response.
 * Internal fields (filePath) are stripped; only safe, client-facing data is returned.
 */
function _buildResponse(session) {
  return {
    success: true,
    data: {
      sessionId:            session.sessionId,
      sortMethod:           session.sortMethod,
      sortMethodDescription:session.sortMethodDescription,
      totalImages:          session.results.length,
      images: session.results.map((img) => ({
        sortedIndex:     img.sortedIndex,
        originalName:    img.originalName,
        storedFilename:  img.storedFilename,
        url:             img.url,
        size:            img.size,
        signals: {
          pageNumber: img.pageDetection
            ? {
                value:       img.pageDetection.pageNumber,
                confidence:  img.pageDetection.confidence,
                matchedText: img.pageDetection.matchedText,
                pattern:     img.pageDetection.pattern,
              }
            : null,
          timestamp: img.metadata && img.metadata.earliestDate
            ? {
                value:  img.metadata.earliestDate,
                source: img.metadata.timestamps?.[0]?.source || "unknown",
              }
            : null,
        },
        textPreview: img.ocr?.text
          ? img.ocr.text.substring(0, 300).replace(/\s+/g, " ").trim()
          : null,
        ocrConfidence: img.ocr?.confidence ?? null,
      })),
    },
  };
}

module.exports = { processSession, getProcessResults };
