/**
 * Process Controller  –  v3 (fast pipeline + SSE streaming)
 *
 * Two entry points:
 *
 *  POST /api/process/:sessionId
 *    Classic JSON endpoint.  Same fast-path logic as v2 but now uses
 *    extractTextBatch() with onProgress to log per-image timing.
 *
 *  GET  /api/process/:sessionId/stream          ← NEW
 *    Server-Sent Events (SSE) endpoint.  The client receives real-time
 *    progress events as each image is OCR-processed:
 *      { type: "start",        total: N }
 *      { type: "ocr_progress", done: N, total: N, filename: "…" }
 *      { type: "done",         data: { …full results… } }
 *      { type: "error",        message: "…" }   (on failure)
 *
 *    This replaces the fake setTimeout timers in the frontend with
 *    accurate, server-driven progress.
 *
 * Fast paths (unchanged from v2):
 *  0. Filename sequence  — zero I/O, instant
 *  1. EXIF timestamps    — skip OCR entirely if ≥ 50 % unique timestamps
 *  2. Full OCR           — parallel, worker-pooled, cached (v3 ocrService)
 */

"use strict";

const sessionService       = require("../services/sessionService");
const metadataService      = require("../services/metadataService");
const ocrService           = require("../services/ocrService");
const pageDetectionService = require("../services/pageDetectionService");
const sortingService       = require("../services/sortingService");
const AppError             = require("../utils/AppError");
const logger               = require("../utils/logger");

const EXIF_QUORUM = 0.5;

// ─── POST /api/process/:sessionId ────────────────────────────────────────────

async function processSession(req, res, next) {
  const { sessionId } = req.params;
  const t0 = Date.now();

  try {
    const session = _guardSession(sessionId);

    // Already processed? return cached result immediately.
    if (session.status === "processed") {
      return res.status(200).json(_buildResponse(session));
    }

    sessionService.updateSession(sessionId, { status: "processing" });

    const { sortedImages, sortMethod, sortMethodDescription } =
      await _runPipeline(session, null /* no SSE progress */);

    logger.info(`[${sessionId}] Done in ${Date.now() - t0} ms. Method: ${sortMethod}`);
    return _saveAndRespond(res, sessionId, sortedImages, sortMethod, sortMethodDescription);

  } catch (err) {
    sessionService.updateSession(sessionId, { status: "error" });
    next(err);
  }
}

// ─── GET /api/process/:sessionId/stream  (SSE) ───────────────────────────────

async function processSessionStream(req, res, next) {
  const { sessionId } = req.params;
  const t0 = Date.now();

  // ── SSE handshake ─────────────────────────────────────────────────────────
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Helper: send one SSE event
  const send = (data) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  // ── Guard ─────────────────────────────────────────────────────────────────
  let session;
  try {
    session = _guardSession(sessionId);
  } catch (err) {
    send({ type: "error", message: err.message });
    res.end();
    return;
  }

  // Already processed? stream the cached result instantly.
  if (session.status === "processed") {
    send({ type: "start",    total: session.results.length });
    send({ type: "done",     data: _buildResponse(session).data });
    res.end();
    return;
  }

  // Detect when client disconnects (browser tab close, navigation, etc.)
  let clientGone = false;
  req.on("close", () => { clientGone = true; });

  try {
    sessionService.updateSession(sessionId, { status: "processing" });

    const files = session.files;
    send({ type: "start", total: files.length });

    // Progress callback — fires after each individual OCR job completes
    const onOcrProgress = (done, total, filename) => {
      if (!clientGone) {
        send({ type: "ocr_progress", done, total, filename });
      }
    };

    const { sortedImages, sortMethod, sortMethodDescription } =
      await _runPipeline(session, onOcrProgress);

    if (clientGone) {
      sessionService.updateSession(sessionId, { status: "error" });
      return;
    }

    const results = _persistResults(sessionId, sortedImages, sortMethod, sortMethodDescription);
    logger.info(`[${sessionId}] Stream done in ${Date.now() - t0} ms. Method: ${sortMethod}`);

    send({ type: "done", data: _buildResponse(sessionService.getSession(sessionId)).data });
    res.end();

  } catch (err) {
    sessionService.updateSession(sessionId, { status: "error" });
    send({ type: "error", message: err.message || "Processing failed." });
    res.end();
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

// ─── Core pipeline ────────────────────────────────────────────────────────────

/**
 * Shared processing pipeline used by both the classic POST and SSE endpoints.
 *
 * @param {import('../services/sessionService').Session} session
 * @param {((done: number, total: number, filename: string) => void) | null} onOcrProgress
 * @returns {Promise<{ sortedImages: any[], sortMethod: string, sortMethodDescription: string }>}
 */
async function _runPipeline(session, onOcrProgress) {
  const { sessionId, files } = session;
  const n = files.length;

  // ════════════════════════════════════════════════════════════════════════
  // FAST PATH 0 — Filename sequential order  (zero I/O)
  // ════════════════════════════════════════════════════════════════════════
  const bareAnalyses = files.map((file, i) => ({
    ...file,
    originalIndex: i,
    metadata:      { hasMetadata: false },
    ocr:           { text: "", confidence: 0 },
    pageDetection: null,
  }));

  const fnResult = sortingService.sortImages(bareAnalyses);
  if (fnResult.sortMethod === "filename_order") {
    logger.info(`[${sessionId}] Fast path 0 (filename).`);
    // If streaming, pretend all images were "processed" so the progress bar fills
    if (onOcrProgress) {
      files.forEach((f, i) =>
        onOcrProgress(i + 1, n, f.originalName)
      );
    }
    return fnResult;
  }

  // ════════════════════════════════════════════════════════════════════════
  // FAST PATH 1 — EXIF timestamps  (skip OCR if enough unique timestamps)
  // ════════════════════════════════════════════════════════════════════════
  logger.info(`[${sessionId}] Step 1 — EXIF extraction (parallel)…`);
  const allMetadata = await Promise.all(
    files.map((f) => metadataService.extractMetadata(f.filePath))
  );

  const withTs     = allMetadata.filter((m) => m.hasMetadata && m.earliestDate instanceof Date);
  const uniqueTs   = new Set(withTs.map((m) => m.earliestDate.getTime()));
  const exifEnough = withTs.length / n >= EXIF_QUORUM && uniqueTs.size > 1;

  if (exifEnough) {
    logger.info(`[${sessionId}] Fast path 1 (EXIF): ${withTs.length}/${n} — skipping OCR.`);
    if (onOcrProgress) {
      files.forEach((f, i) => onOcrProgress(i + 1, n, f.originalName));
    }
    const analyses = files.map((file, i) => ({
      ...file,
      originalIndex: i,
      metadata:      allMetadata[i],
      ocr:           { text: "", confidence: 0 },
      pageDetection: null,
    }));
    return sortingService.sortImages(analyses);
  }

  // ════════════════════════════════════════════════════════════════════════
  // STANDARD PATH — Parallel OCR  (pooled + cached + per-image progress)
  // ════════════════════════════════════════════════════════════════════════
  logger.info(`[${sessionId}] Step 2 — OCR (parallel, pool ${ocrService.getCacheStats ? "" : ""}size dynamic)…`);

  const ocrResults = await ocrService.extractTextBatch(
    files.map((f) => f.filePath),
    onOcrProgress
      ? (done, total, filename) => onOcrProgress(done, total, filename)
      : null
  );

  const analyses = files.map((file, i) => ({
    ...file,
    originalIndex: i,
    metadata:      allMetadata[i],
    ocr:           ocrResults[i],
    pageDetection: pageDetectionService.detectPageNumber(ocrResults[i].text),
  }));

  return sortingService.sortImages(analyses);
}

// ─── Guards & helpers ─────────────────────────────────────────────────────────

function _guardSession(sessionId) {
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
  return session;
}

function _persistResults(sessionId, sortedImages, sortMethod, sortMethodDescription) {
  const results = sortedImages.map((img, idx) => ({ ...img, sortedIndex: idx + 1 }));
  sessionService.updateSession(sessionId, {
    status: "processed",
    results,
    sortMethod,
    sortMethodDescription,
  });
  return results;
}

function _saveAndRespond(res, sessionId, sortedImages, sortMethod, sortMethodDescription) {
  _persistResults(sessionId, sortedImages, sortMethod, sortMethodDescription);
  return res.status(200).json(_buildResponse(sessionService.getSession(sessionId)));
}

/**
 * Build the public JSON response payload.
 * Internal fields (filePath) are stripped.
 */
function _buildResponse(session) {
  return {
    success: true,
    data: {
      sessionId:             session.sessionId,
      sortMethod:            session.sortMethod,
      sortMethodDescription: session.sortMethodDescription,
      totalImages:           session.results.length,
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

module.exports = { processSession, processSessionStream, getProcessResults };
