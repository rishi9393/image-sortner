/**
 * Process Controller  –  v8 (Google Document AI Layout Parser Integration)
 *
 * Pipeline order:
 *  0.  Image Quality Analysis
 *  0a. Filename sequence (instant, zero I/O)
 *  0b. Messaging app names (WhatsApp, Telegram)
 *  1.  EXIF timestamps
 *  2.  ★ Document AI Layout Parser (primary) / Gemini Vision (fallback)
 *  3.  Full OCR + page detection (if AI unavailable)
 *  4.  Signal fusion
 *  5.  Cross-image / text continuity / upload order
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SORTING RULES (STRICT):
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  1. Sort pages STRICTLY by detected page numbers in ASCENDING order
 *  2. Do NOT attempt to fill missing page numbers
 *     Example: If pages are 1,2,3,8,9 → keep this order as-is
 *  3. Missing pages (like 4,5,6,7) should be IGNORED, not inferred
 *  4. ONLY if a page has NO detectable page number:
 *     - Use content-based analysis to place it approximately
 *     - Insert it logically between numbered pages
 *
 * Priority Order:
 *  1. Page number (highest priority)
 *  2. Content-based ordering (only if page number missing)
 */

"use strict";

const sessionService = require("../services/sessionService");
const metadataService = require("../services/metadataService");
const ocrService = require("../services/ocrService");
const pageDetectionService = require("../services/pageDetectionService");
const sortingService = require("../services/sortingService");
const documentAIService = require("../services/documentAIService");
const {
  detectMessagingAppOrder,
} = require("../services/messagingFilenameService");
const imageQualityService = require("../services/imageQualityService");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

const EXIF_QUORUM = 0.5;

// Log AI service availability on startup
if (documentAIService.isDocumentAIAvailable()) {
  logger.info(
    "✓ Document AI Layout Parser ENABLED — primary page detection method"
  );
} else if (documentAIService.isGeminiFallbackAvailable()) {
  logger.info(
    "✓ Gemini Vision ENABLED — fallback page detection (Document AI not configured)"
  );
} else {
  logger.info(
    "⚠ AI page detection DISABLED — falling back to OCR-only mode"
  );
}

// ─── POST /api/process/:sessionId ────────────────────────────────────────────

async function processSession(req, res, next) {
  const { sessionId } = req.params;
  const t0 = Date.now();

  try {
    const session = _guardSession(sessionId);
    if (session.status === "processed")
      return res.status(200).json(_buildResponse(session));

    sessionService.updateSession(sessionId, { status: "processing" });

    const { sortedImages, sortMethod, sortMethodDescription } =
      await _runPipeline(session, null);

    logger.info(
      `[${sessionId}] Done in ${Date.now() - t0} ms. Method: ${sortMethod}`
    );
    return _saveAndRespond(
      res,
      sessionId,
      sortedImages,
      sortMethod,
      sortMethodDescription
    );
  } catch (err) {
    sessionService.updateSession(sessionId, { status: "error" });
    next(err);
  }
}

// ─── GET /api/process/:sessionId/stream  (SSE) ───────────────────────────────

async function processSessionStream(req, res, next) {
  const { sessionId } = req.params;
  const t0 = Date.now();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let session;
  try {
    session = _guardSession(sessionId);
  } catch (err) {
    send({ type: "error", message: err.message });
    res.end();
    return;
  }

  if (session.status === "processed") {
    send({ type: "start", total: session.results.length });
    send({ type: "done", data: _buildResponse(session).data });
    res.end();
    return;
  }

  let clientGone = false;
  req.on("close", () => {
    clientGone = true;
  });

  try {
    sessionService.updateSession(sessionId, { status: "processing" });
    const files = session.files;
    send({ type: "start", total: files.length });

    const onProgress = (done, total, filename, stage) => {
      if (!clientGone)
        send({ type: "progress", done, total, filename, stage });
    };

    const { sortedImages, sortMethod, sortMethodDescription } =
      await _runPipeline(session, onProgress);

    if (clientGone) {
      sessionService.updateSession(sessionId, { status: "error" });
      return;
    }

    _persistResults(sessionId, sortedImages, sortMethod, sortMethodDescription);
    logger.info(
      `[${sessionId}] Stream done in ${Date.now() - t0} ms. Method: ${sortMethod}`
    );

    send({
      type: "done",
      data: _buildResponse(sessionService.getSession(sessionId)).data,
    });
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
    if (!session)
      throw new AppError("Session not found.", 404, "SESSION_NOT_FOUND");
    if (session.status !== "processed") {
      throw new AppError(
        `Session not processed yet (status: '${session.status}').`,
        400,
        "NOT_PROCESSED"
      );
    }
    return res.status(200).json(_buildResponse(session));
  } catch (err) {
    next(err);
  }
}

// ─── Core pipeline (v8 — Document AI Layout Parser) ──────────────────────────

async function _runPipeline(session, onProgress) {
  const { sessionId, files } = session;
  const n = files.length;

  // ════════════════════════════════════════════════════════════════════════
  // IMAGE QUALITY ANALYSIS
  // ════════════════════════════════════════════════════════════════════════
  try {
    const qualityAnalysis = await imageQualityService.analyzeBatch(files);
    const { warnings, recommendations, batchQuality } = qualityAnalysis;

    if (warnings.length > 0) {
      logger.warn(`[${sessionId}] ⚠️  Batch quality: ${batchQuality}`);
      warnings.forEach((w) => logger.warn(`  - ${w}`));
      recommendations.forEach((r) => logger.info(`  → ${r}`));

      sessionService.updateSession(sessionId, {
        qualityAnalysis,
        notes:
          (session.notes || "") +
          `\nQuality: ${batchQuality}. ${warnings.join(" ")}`,
      });
    }
  } catch (err) {
    logger.debug(`Quality analysis failed (non-critical): ${err.message}`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // FAST PATH 0a — Filename sequential order (1, 2, 3...)
  // ════════════════════════════════════════════════════════════════════════
  const bareAnalyses = files.map((file, i) => ({
    ...file,
    originalIndex: i,
    metadata: { hasMetadata: false },
    ocr: { text: "", confidence: 0 },
    regionOcr: { text: "", confidence: 0 },
    pageDetection: null,
  }));

  const fnResult = sortingService.sortImages(bareAnalyses, null);
  if (fnResult.sortMethod === "filename_order") {
    logger.info(`[${sessionId}] Fast path 0a (filename).`);
    if (onProgress)
      files.forEach((f, i) => onProgress(i + 1, n, f.originalName, "complete"));
    return fnResult;
  }

  // ════════════════════════════════════════════════════════════════════════
  // FAST PATH 0b — Messaging app filename patterns
  // ════════════════════════════════════════════════════════════════════════
  const msgResult = detectMessagingAppOrder(bareAnalyses);
  if (msgResult) {
    logger.info(`[${sessionId}] Fast path 0b (messaging app).`);
    if (onProgress)
      files.forEach((f, i) => onProgress(i + 1, n, f.originalName, "complete"));
    return msgResult;
  }

  // ════════════════════════════════════════════════════════════════════════
  // FAST PATH 1 — EXIF timestamps
  // ════════════════════════════════════════════════════════════════════════
  logger.info(`[${sessionId}] Step 1 — EXIF extraction…`);
  const allMetadata = await Promise.all(
    files.map((f) => metadataService.extractMetadata(f.filePath))
  );

  const withTs = allMetadata.filter(
    (m) => m.hasMetadata && m.earliestDate instanceof Date
  );
  const uniqueTs = new Set(withTs.map((m) => m.earliestDate.getTime()));
  const exifEnough = withTs.length / n >= EXIF_QUORUM && uniqueTs.size > 1;

  if (exifEnough) {
    logger.info(`[${sessionId}] Fast path 1 (EXIF): ${withTs.length}/${n}`);
    if (onProgress)
      files.forEach((f, i) => onProgress(i + 1, n, f.originalName, "complete"));
    const analyses = files.map((file, i) => ({
      ...file,
      originalIndex: i,
      metadata: allMetadata[i],
      ocr: { text: "", confidence: 0 },
      regionOcr: { text: "", confidence: 0 },
      pageDetection: null,
    }));
    return sortingService.sortImages(analyses, null);
  }

  // ════════════════════════════════════════════════════════════════════════
  // MAIN PATH — Document AI Layout Parser (or Gemini fallback)
  // ════════════════════════════════════════════════════════════════════════

  let aiResult = null;

  if (documentAIService.isAvailable()) {
    logger.info(`[${sessionId}] Step 2 — Document AI page number extraction…`);

    if (onProgress) {
      onProgress(0, n, "", "ai_detection");
    }

    try {
      const docAIResult = await documentAIService.detectAndSortPages(files);

      if (docAIResult && docAIResult.coverage >= 0.3) {
        // Convert to legacy AI result format for compatibility
        aiResult = {
          pageNumbers: docAIResult.pages.map((p) => p.detectedPageNumber),
          confidence: docAIResult.coverage,
          perImageConfidence: docAIResult.pages.map((p) =>
            p.confidence >= 0.8
              ? "high"
              : p.confidence >= 0.5
              ? "medium"
              : "low"
          ),
          model: docAIResult.method,
          coverage: docAIResult.coverage,
          verified: false,
        };

        logger.info(
          `[${sessionId}] Document AI result: ` +
            `[${aiResult.pageNumbers.map((p) => (p !== null ? p : "?")).join(", ")}] ` +
            `(${(docAIResult.coverage * 100).toFixed(0)}% coverage)`
        );
      }
    } catch (err) {
      logger.warn(`[${sessionId}] Document AI failed: ${err.message}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 3 — Full OCR (in parallel with AI or as fallback)
  // ════════════════════════════════════════════════════════════════════════
  logger.info(`[${sessionId}] Step 3 — Full-image OCR…`);

  const ocrResults = await ocrService.extractTextBatch(
    files.map((f) => f.filePath),
    onProgress
      ? (done, total, filename) => onProgress(done, total, filename, "ocr")
      : null
  );

  // ════════════════════════════════════════════════════════════════════════
  // Step 4 — Per-image page detection (OCR-based fallback)
  // ════════════════════════════════════════════════════════════════════════
  const perImageDetections = ocrResults.map((ocr, i) => {
    const det = pageDetectionService.detectPageNumber(ocr.text);
    if (det) {
      logger.debug(
        `[${sessionId}] OCR page detect — Image ${i + 1}: page ${det.pageNumber} ` +
          `(${det.pattern}, conf=${det.confidence.toFixed(2)})`
      );
    }
    return det;
  });

  // ════════════════════════════════════════════════════════════════════════
  // Step 5 — Region OCR for headers/footers (if needed)
  // ════════════════════════════════════════════════════════════════════════
  let regionOcrResults = files.map(() => ({ text: "", confidence: 0 }));
  const detectedCount = perImageDetections.filter(Boolean).length;
  const aiDetectedCount = aiResult
    ? aiResult.pageNumbers.filter((p) => p !== null).length
    : 0;

  // Only run region OCR if both AI and regular OCR are failing
  const shouldRunRegionOcr =
    !aiResult && detectedCount < n * 0.5;

  if (shouldRunRegionOcr) {
    logger.info(`[${sessionId}] Step 5 — Region OCR (headers/footers)…`);
    try {
      regionOcrResults = await ocrService.extractPageRegionTextBatch(
        files.map((f) => f.filePath)
      );
      for (let i = 0; i < n; i++) {
        if (regionOcrResults[i]?.text) {
          const regionDet = pageDetectionService.detectPageNumber(
            regionOcrResults[i].text
          );
          if (
            regionDet &&
            (!perImageDetections[i] ||
              regionDet.confidence > perImageDetections[i].confidence)
          ) {
            perImageDetections[i] = regionDet;
          }
        }
      }
    } catch (err) {
      logger.warn(`[${sessionId}] Region OCR failed: ${err.message}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 6 — Build analyses and sort
  //
  // STRICT SORTING RULES:
  //  1. Sort by page numbers in ascending order
  //  2. Do NOT fill missing page numbers (1,2,3,8,9 stays as-is)
  //  3. Pages without numbers are inserted by content analysis
  // ════════════════════════════════════════════════════════════════════════
  const analyses = files.map((file, i) => ({
    ...file,
    originalIndex: i,
    metadata: allMetadata[i],
    ocr: ocrResults[i],
    regionOcr: regionOcrResults[i],
    pageDetection: perImageDetections[i],
  }));

  return sortingService.sortImages(analyses, aiResult);
}

// ─── Guards & helpers ─────────────────────────────────────────────────────────

function _guardSession(sessionId) {
  const session = sessionService.getSession(sessionId);
  if (!session)
    throw new AppError("Session not found.", 404, "SESSION_NOT_FOUND");
  if (session.status === "processing") {
    throw new AppError(
      "Already processing. Please wait.",
      409,
      "ALREADY_PROCESSING"
    );
  }
  return session;
}

function _persistResults(
  sessionId,
  sortedImages,
  sortMethod,
  sortMethodDescription
) {
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
  return results;
}

function _saveAndRespond(
  res,
  sessionId,
  sortedImages,
  sortMethod,
  sortMethodDescription
) {
  _persistResults(sessionId, sortedImages, sortMethod, sortMethodDescription);
  return res
    .status(200)
    .json(_buildResponse(sessionService.getSession(sessionId)));
}

function _buildResponse(session) {
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
        // ★ Include detected page number (or null if missing)
        detectedPageNumber: img.detectedPageNumber ?? null,
        signals: {
          pageNumber: img.pageDetection
            ? {
                value: img.pageDetection.pageNumber,
                confidence: img.pageDetection.confidence,
                matchedText: img.pageDetection.matchedText,
                pattern: img.pageDetection.pattern,
              }
            : img.detectedPageNumber
            ? {
                value: img.detectedPageNumber,
                confidence: img.pageNumberConfidence === "high" ? 0.95 : 0.75,
                matchedText: String(img.detectedPageNumber),
                pattern: "ai_detected",
              }
            : null,
          timestamp:
            img.metadata && img.metadata.earliestDate
              ? {
                  value: img.metadata.earliestDate,
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
