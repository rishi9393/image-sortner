/**
 * Digit Validation Service  –  v1 (Improvement #1)
 *
 * Handles OCR digit misread detection and correction.
 * When a digit detection has marginal confidence, this service checks:
 *
 *  1. Does the detected digit appear in the context of neighbor page numbers?
 *  2. Are there similar-looking digit misreads (6↔9, 1↔7, 0↔O)?
 *  3. Is the digit plausible given surrounding sequence?
 *
 * Returns:
 *  - flagged (boolean): whether digit should be treated as ambiguous
 *  - suggestion (number | null): recommended correction if high confidence
 *  - confidence adjustment (number): delta to apply to original confidence
 */

"use strict";

const logger = require("../utils/logger");

// Digit lookalikes under OCR misreading
const LOOKALIKE_PAIRS = {
  6: [9, 0],
  9: [6, 8, 3],
  1: [7, 1, "I"], // 1, 7, I (uppercase)
  0: [8, "O", 6], // 0, 8, O, 6
  7: [1, 9],
  3: [8, 9],
};

/**
 * Validate a single digit detection against context.
 *
 * @param {{
 *   pageNumber: number,
 *   confidence: number,
 *   matchedText: string,
 *   pattern: string,
 *   lineIndex?: number,
 *   totalLines?: number,
 * }} detection
 *
 * @param {{
 *   allDetectedPages: number[],      // All page numbers detected in batch
 *   imageIndex: number,               // Which image in batch (0–n)
 *   totalImages: number,              // Total images in batch
 *   contextText?: string,             // OCR text of this image (for re-analysis)
 * }} context
 *
 * @returns {{
 *   pageNumber: number,               // Original or corrected page number
 *   confidence: number,               // Adjusted confidence
 *   flagged: boolean,                 // True if digit is ambiguous
 *   suggestion?: number,              // Recommended correction (if high confidence)
 *   reason?: string,                  // Human-readable explanation
 * }}
 */
function validateDigit(detection, context = {}) {
  const { pageNumber, confidence, matchedText, pattern } = detection;
  const { allDetectedPages = [], imageIndex = -1, totalImages = 0 } = context;

  let result = {
    pageNumber,
    confidence,
    flagged: false,
    reason: "digit_valid",
  };

  // ── Check 1: Confidence is marginal (ambiguous zone) ────────────────────────
  if (confidence >= 0.45 && confidence <= 0.7) {
    result.flagged = true;
    result.reason = "marginal_confidence";

    // ── Check 2: Is detected digit a plausible lookalike? ────────────────────
    const lookalikeList = LOOKALIKE_PAIRS[pageNumber] || [];
    if (lookalikeList.length > 0) {
      // Check if any lookalike exists in detected pages nearby
      const nearby = allDetectedPages.filter(
        (p) => Math.abs(p - pageNumber) <= 2 && lookalikeList.includes(p),
      );
      if (nearby.length > 0) {
        // Penalize confidence: high chance of misread
        result.confidence = Math.max(0.3, confidence - 0.15);
        result.reason = `lookalike_adjacent (nearby: ${nearby.join(",")})`;
      }
    }

    // ── Check 3: Is this digit missing from sequence? ─────────────────────────
    // Example: If pages [1,2,5,6] detected in 5-image batch, page 3 is missing
    // If OCR saw "3", it's probably correct (fills gap); confidence up
    const expectedSequence = new Set();
    for (let i = 1; i <= totalImages; i++) expectedSequence.add(i);
    const detectedSet = new Set(allDetectedPages);
    const missingFromSequence = Array.from(expectedSequence).filter(
      (p) => !detectedSet.has(p),
    );

    if (missingFromSequence.includes(pageNumber)) {
      // This digit fills a gap — likely correct
      result.confidence = Math.min(0.95, confidence + 0.15);
      result.reason = "fills_sequence_gap";
    }
  }

  // ── Check 4: Very low confidence + handwritten pattern —————────────────────
  // standalone_number pattern (0.60 base) on handwritten page is suspicious
  if (pattern === "standalone_number" && confidence < 0.65) {
    // Flag for AI verification, but keep confidence as-is (manual verification)
    result.flagged = true;
    result.reason = "handwritten_uncertain";
  }

  // ── Check 5: Pattern with decorative format (⚠ low signal) ─────────────────
  if (pattern === "decorated" && confidence < 0.75) {
    result.confidence = Math.max(0.4, confidence - 0.1);
    result.flagged = true;
    result.reason = "decorated_format_uncertain";
  }

  return result;
}

/**
 * Given multiple digit detections on the SAME IMAGE, determine which is the
 * actual page number and which are false positives (e.g., figure numbers).
 *
 * @param {PageDetectionResult[]} detections  // All page detections from one image
 * @param {string} imageText                  // OCR text of the image
 * @returns {{
 *   pageDetection: PageDetectionResult,      // Best candidate
 *   alternatives: PageDetectionResult[],     // Other candidates (likely false positives)
 *   ambiguous: boolean,                      // Needs manual review
 * }}
 */
function resolveMultipleDetections(detections, imageText = "") {
  if (!detections || detections.length === 0) {
    return { pageDetection: null, alternatives: [], ambiguous: false };
  }

  if (detections.length === 1) {
    return { pageDetection: detections[0], alternatives: [], ambiguous: false };
  }

  // Sort by confidence descending
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);

  const best = sorted[0];
  const alternatives = sorted.slice(1);

  // Check if top candidate is significantly better than others
  const confidenceGap = best.confidence - (alternatives[0]?.confidence || 0);

  const ambiguous = confidenceGap < 0.15 || best.confidence < 0.6;

  if (ambiguous && alternatives.length > 0) {
    logger.warn(
      `Multi-detection ambiguity: best=${best.pageNumber} (${best.confidence.toFixed(2)}) ` +
        `vs alternatives=${alternatives.map((a) => `${a.pageNumber}(${a.confidence.toFixed(2)})`).join(", ")} ` +
        `(gap=${confidenceGap.toFixed(2)})`,
    );
  }

  return {
    pageDetection: best,
    alternatives,
    ambiguous,
  };
}

/**
 * Score whether a digit detection is trustworthy given the full batch context.
 * Used for determining whether a single image's detection is enough to act on.
 *
 * @param {{
 *   pageNumber: number,
 *   confidence: number,
 * }} detection
 *
 * @param {{
 *   allDetectedPages: number[],
 *   allConfidences: number[],
 *   batchSize: number,
 * }} batchContext
 *
 * @returns {number}  // 0.0–1.0 final score
 */
function scoreTrustworthiness(detection, batchContext) {
  const { pageNumber, confidence } = detection;
  const {
    allDetectedPages = [],
    allConfidences = [],
    batchSize = 1,
  } = batchContext;

  let score = confidence; // Start with detection confidence

  // Boost: If this page appears in multiple images (quorum vote)
  const count = allDetectedPages.filter((p) => p === pageNumber).length;
  if (count >= 2) {
    score = Math.min(0.95, score + 0.15); // Strong signal: multiple images agree
  } else if (count === 1) {
    // Single detection: reduce score slightly
    score = Math.max(0.3, score - 0.05);
  }

  // Penalize: If batch has very uneven coverage (some images have detections, others don't)
  const coverageRatio = allDetectedPages.length / batchSize;
  if (coverageRatio < 0.3) {
    // Low coverage = individual detections are unreliable
    score = Math.max(0.2, score - 0.2);
  }

  // Boost: If detection is in the "natural" range [1, batchSize]
  if (pageNumber >= 1 && pageNumber <= batchSize) {
    score = Math.min(0.99, score + 0.05);
  } else {
    // Out of plausible range
    score = Math.max(0.1, score - 0.3);
  }

  return Math.min(0.99, Math.max(0.0, score));
}

module.exports = {
  validateDigit,
  resolveMultipleDetections,
  scoreTrustworthiness,
};
