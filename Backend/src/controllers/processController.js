/**
 * Process Controller  –  v7 (Messaging Filenames + Enhanced AI Two-Pass + Quality Enhancements)
 *
 * Pipeline order:
 *  0. ★ Image Quality Analysis   ← NEW — warn about problematic batches
 *  0a. Filename sequence       (instant, zero I/O)
 *  0b. ★ Messaging app names   ← NEW — WhatsApp WA####, Telegram timestamps
 *  1. EXIF timestamps          (skip OCR if enough)
 *  2. ★ AI Vision (two-pass)   ← ENHANCED — chain-of-thought + verification
 *  3. Full OCR + page detection (fallback if no AI key)
 *  4. ★ Signal fusion          ← NEW — merge AI + OCR partial results
 *  5. Cross-image / text continuity / upload order
 *  6. ★ Accuracy Enhancements  ← NEW — digit validation, confidence aggregation
 *
 * When GEMINI_API_KEY is set, the AI call runs IN PARALLEL with OCR.
 */

"use strict";

const sessionService = require("../services/sessionService");
const metadataService = require("../services/metadataService");
const ocrService = require("../services/ocrService");
const pageDetectionService = require("../services/pageDetectionService");
const sortingService = require("../services/sortingService");
const aiPageDetection = require("../services/aiPageDetectionService");
const {
  detectMessagingAppOrder,
} = require("../services/messagingFilenameService");
const imageQualityService = require("../services/imageQualityService");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

const EXIF_QUORUM = 0.5;

// Log whether AI is available on startup
if (aiPageDetection.isAvailable()) {
  logger.info(
    "✓ AI page detection ENABLED (Gemini API key found) — two-pass mode",
  );
} else {
  logger.info(
    "⚠ AI page detection DISABLED (no GEMINI_API_KEY in .env) — falling back to OCR-only",
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
      `[${sessionId}] Done in ${Date.now() - t0} ms. Method: ${sortMethod}`,
    );
    return _saveAndRespond(
      res,
      sessionId,
      sortedImages,
      sortMethod,
      sortMethodDescription,
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

    const onOcrProgress = (done, total, filename) => {
      if (!clientGone) send({ type: "ocr_progress", done, total, filename });
    };

    const { sortedImages, sortMethod, sortMethodDescription } =
      await _runPipeline(session, onOcrProgress);

    if (clientGone) {
      sessionService.updateSession(sessionId, { status: "error" });
      return;
    }

    _persistResults(sessionId, sortedImages, sortMethod, sortMethodDescription);
    logger.info(
      `[${sessionId}] Stream done in ${Date.now() - t0} ms. Method: ${sortMethod}`,
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
        "NOT_PROCESSED",
      );
    }
    return res.status(200).json(_buildResponse(session));
  } catch (err) {
    next(err);
  }
}

// ─── Core pipeline (v7 — Messaging + Enhanced AI + Fusion + Quality) ────────

async function _runPipeline(session, onOcrProgress) {
  const { sessionId, files } = session;
  const n = files.length;

  // ════════════════════════════════════════════════════════════════════════
  // ★ NEW: IMAGE QUALITY ANALYSIS (Improvement #9)
  // ════════════════════════════════════════════════════════════════════════
  try {
    const qualityAnalysis = await imageQualityService.analyzeBatch(files);
    const { warnings, recommendations, batchQuality } = qualityAnalysis;

    if (warnings.length > 0) {
      logger.warn(`[${sessionId}] ⚠️  Batch quality: ${batchQuality}`);
      warnings.forEach((w) => logger.warn(`  - ${w}`));
      recommendations.forEach((r) => logger.info(`  → ${r}`));

      // Store quality info in session for potential later reporting
      sessionService.updateSession(sessionId, {
        qualityAnalysis,
        notes:
          (session.notes || "") +
          `\nQuality: ${batchQuality}. ${warnings.join(" ")}`,
      });
    }
  } catch (err) {
    // Quality analysis is non-blocking; errors don't halt processing
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
    if (onOcrProgress)
      files.forEach((f, i) => onOcrProgress(i + 1, n, f.originalName));
    return fnResult;
  }

  // ════════════════════════════════════════════════════════════════════════
  // FAST PATH 0b — ★ Messaging app filename patterns (WhatsApp, Telegram, etc.)
  // ════════════════════════════════════════════════════════════════════════
  const msgResult = detectMessagingAppOrder(bareAnalyses);
  if (msgResult) {
    logger.info(
      `[${sessionId}] Fast path 0b (messaging app filename: ${msgResult.sortMethod}).`,
    );
    if (onOcrProgress)
      files.forEach((f, i) => onOcrProgress(i + 1, n, f.originalName));
    return msgResult;
  }

  // ════════════════════════════════════════════════════════════════════════
  // FAST PATH 1 — EXIF timestamps
  // ════════════════════════════════════════════════════════════════════════
  logger.info(`[${sessionId}] Step 1 — EXIF extraction…`);
  const allMetadata = await Promise.all(
    files.map((f) => metadataService.extractMetadata(f.filePath)),
  );

  const withTs = allMetadata.filter(
    (m) => m.hasMetadata && m.earliestDate instanceof Date,
  );
  const uniqueTs = new Set(withTs.map((m) => m.earliestDate.getTime()));
  const exifEnough = withTs.length / n >= EXIF_QUORUM && uniqueTs.size > 1;

  if (exifEnough) {
    logger.info(`[${sessionId}] Fast path 1 (EXIF): ${withTs.length}/${n}`);
    if (onOcrProgress)
      files.forEach((f, i) => onOcrProgress(i + 1, n, f.originalName));
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
  // MAIN PATH — ★ AI Vision (two-pass) + OCR run IN PARALLEL
  // ════════════════════════════════════════════════════════════════════════

  // Start AI call (non-blocking) — will resolve to null if no API key
  const aiPromise = aiPageDetection.isAvailable()
    ? aiPageDetection.detectPageNumbers(files).catch((err) => {
        logger.warn(`[${sessionId}] AI detection failed: ${err.message}`);
        return null;
      })
    : Promise.resolve(null);

  // Start OCR in parallel
  logger.info(
    `[${sessionId}] Step 2 — Full-image OCR + AI Vision two-pass (parallel)…`,
  );
  const ocrResults = await ocrService.extractTextBatch(
    files.map((f) => f.filePath),
    onOcrProgress,
  );

  // Wait for AI result (should already be done or nearly done)
  const aiResult = await aiPromise;

  if (aiResult) {
    logger.info(
      `[${sessionId}] ★ AI Vision result: [${aiResult.pageNumbers.join(", ")}] ` +
        `(confidence: ${aiResult.confidence.toFixed(2)}, verified: ${aiResult.verified})`,
    );
    if (aiResult.perImageConfidence) {
      logger.debug(
        `[${sessionId}] Per-image confidence: [${aiResult.perImageConfidence.join(", ")}]`,
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 3 — Per-image page detection (OCR-based, as fallback / fusion input)
  // ════════════════════════════════════════════════════════════════════════
  const perImageDetections = ocrResults.map((ocr, i) => {
    const det = pageDetectionService.detectPageNumber(ocr.text);
    if (det) {
      logger.debug(
        `[${sessionId}] OCR page detect — Image ${i + 1}: page ${det.pageNumber} (${det.pattern}, conf=${det.confidence.toFixed(2)})`,
      );
    }
    return det;
  });

  // ════════════════════════════════════════════════════════════════════════
  // Step 4 — ★ ENHANCED Region OCR for headers/footers
  //   Run more aggressively: if ANY image has marginal or missing detection
  // ════════════════════════════════════════════════════════════════════════
  let regionOcrResults = files.map(() => ({ text: "", confidence: 0 }));
  const detectedCount = perImageDetections.filter(Boolean).length;
  const marginalDetections = perImageDetections.filter(
    (d) => d && d.confidence < 0.70,
  ).length;

  // Run region OCR if:
  //   1. Less than 50% images have page numbers detected, OR
  //   2. Multiple images have marginal detection confidence
  const shouldRunRegionOcr =
    detectedCount < n * 0.5 || marginalDetections > n * 0.2;

  if (shouldRunRegionOcr) {
    logger.info(`[${sessionId}] Step 4 — ★ Enhanced region OCR (headers/footers)…`);
    try {
      regionOcrResults = await ocrService.extractPageRegionTextBatch(
        files.map((f) => f.filePath),
      );
      for (let i = 0; i < n; i++) {
        if (regionOcrResults[i]?.text) {
          const regionDet = pageDetectionService.detectPageNumber(
            regionOcrResults[i].text,
          );
          // Use region detection if:
          //   - No current detection, OR
          //   - Region detection has higher confidence
          if (
            regionDet &&
            (!perImageDetections[i] ||
              regionDet.confidence > perImageDetections[i].confidence)
          ) {
            perImageDetections[i] = regionDet;
            if (regionDet.confidence >= 0.7) {
              logger.debug(
                `[${sessionId}] Region OCR found page ${regionDet.pageNumber} for image ${i + 1}`,
              );
            }
          }
        }
      }
    } catch (err) {
      logger.warn(`[${sessionId}] Region OCR failed: ${err.message}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 5 — Build analyses and sort
  //   AI result passed as top-priority signal.
  //   Sorting service handles: AI → OCR → Fusion → Cross-image → etc.
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
      "ALREADY_PROCESSING",
    );
  }
  return session;
}

function _persistResults(
  sessionId,
  sortedImages,
  sortMethod,
  sortMethodDescription,
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
  sortMethodDescription,
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
        signals: {
          pageNumber: img.pageDetection
            ? {
                value: img.pageDetection.pageNumber,
                confidence: img.pageDetection.confidence,
                matchedText: img.pageDetection.matchedText,
                pattern: img.pageDetection.pattern,
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
