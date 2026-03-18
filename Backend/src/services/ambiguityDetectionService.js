/**
 * Ambiguity Detection Service  –  v1 (Improvement #3)
 *
 * Detects when multiple different numbers appear on the same image,
 * which could indicate:
 *  1. One is the page number, others are figure/section numbers
 *  2. Page number is ambiguous (needs AI arbitration)
 *  3. False positives in OCR
 *
 * Methods:
 *  - Detect multi-number scenarios
 *  - Score each candidate (location, pattern, context)
 *  - Require AI verification when ambiguous
 */

"use strict";

const logger = require("../utils/logger");

/**
 * Analyze detections on a single image to identify multiple distinct numbers.
 *
 * @param {Array<{
 *   pageNumber: number,
 *   confidence: number,
 *   pattern: string,
 *   matchedText: string,
 *   lineIndex?: number,
 * }>} detections  // All OCR pattern matches on one image
 *
 * @param {string} ocrText  // Full OCR text for context
 *
 * @returns {{
 *   hasMultipleNumbers: boolean,
 *   primaryCandidate: { pageNumber: number, confidence: number, reason: string },
 *   alternativeCandidates: Array,
 *   ambiguity: "none" | "low" | "high",
 *   requiresAIArbitration: boolean,
 *   explanation: string,
 * }}
 */
function detectAmbiguities(detections, ocrText = "") {
  if (!detections || detections.length === 0) {
    return {
      hasMultipleNumbers: false,
      primaryCandidate: null,
      alternativeCandidates: [],
      ambiguity: "none",
      requiresAIArbitration: false,
      explanation: "No page numbers detected.",
    };
  }

  if (detections.length === 1) {
    return {
      hasMultipleNumbers: false,
      primaryCandidate: {
        pageNumber: detections[0].pageNumber,
        confidence: detections[0].confidence,
        reason: "Single detection — high confidence.",
      },
      alternativeCandidates: [],
      ambiguity: "none",
      requiresAIArbitration: false,
      explanation: "Unambiguous single page number.",
    };
  }

  // ── Multiple numbers detected — analyze ──────────────────────────────────
  const grouped = _groupByNumber(detections);
  const distinctNumbers = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  // ── Heuristic 1: Page numbers are typically in headers/footers ──────────
  // Rank by position preference
  const rankedDetections = detections
    .map((d) => ({
      ...d,
      positionScore: _scoreDetectionPosition(d, ocrText),
    }))
    .sort((a, b) => b.positionScore - a.positionScore);

  const best = rankedDetections[0];
  const rest = rankedDetections.slice(1);

  // ── Heuristic 2: Check confidence gap between top and second ────────────
  const confidenceGap = best.confidence - (rest[0]?.confidence || 0);
  const isConfidentGap = confidenceGap >= 0.2;

  // ── Heuristic 3: Check if numbers are in semantic context ──────────────
  // Examples: "Figure 3", "Section 5", "Page 7"
  const numbersInContext = _identifyNumberContext(detections, ocrText);

  // ── Determine ambiguity level ────────────────────────────────────────────
  let ambiguity = "none";
  let requiresAIArbitration = false;

  if (distinctNumbers.length > 3) {
    // Many numbers: likely OCR false positives
    ambiguity = "high";
    requiresAIArbitration = true;
  } else if (distinctNumbers.length === 2 && !isConfidentGap) {
    // Two close numbers, unclear which is the page
    ambiguity = "high";
    requiresAIArbitration = true;
  } else if (distinctNumbers.length === 2 && isConfidentGap) {
    // Two numbers, but one is clearly preferred
    ambiguity = "low";
    // Still flag for AI if both are high-confidence
    if (best.confidence >= 0.75 && rest[0]?.confidence >= 0.7) {
      requiresAIArbitration = true;
    }
  }

  // ── Build explanation ───────────────────────────────────────────────────
  let explanation = `Detected ${distinctNumbers.length} distinct numbers: ${distinctNumbers.join(", ")}.`;

  if (numbersInContext.length > 0) {
    const contexts = numbersInContext
      .map((x) => `"${x.pattern}" (${x.context})`)
      .join(", ");
    explanation += ` Contexts: ${contexts}.`;
  }

  if (ambiguity !== "none") {
    explanation += ` ⚠️  Ambiguous — recommend AI verification.`;
  }

  return {
    hasMultipleNumbers: distinctNumbers.length > 1,
    primaryCandidate: {
      pageNumber: best.pageNumber,
      confidence: best.confidence,
      reason: `Top-ranked by position (${best.pattern})${isConfidentGap ? ` with ${(confidenceGap * 100).toFixed(0)}% confidence gap to alternatives` : ""}`,
    },
    alternativeCandidates: rest.slice(0, 2).map((d) => ({
      pageNumber: d.pageNumber,
      confidence: d.confidence,
      pattern: d.pattern,
    })),
    ambiguity,
    requiresAIArbitration,
    explanation,
    detectionDetails: {
      distinctCount: distinctNumbers.length,
      topConfidence: best.confidence,
      secondConfidence: rest[0]?.confidence || 0,
      confidenceGap: confidenceGap,
    },
  };
}

/**
 * Score how likely a detection is the actual page number based on position.
 *
 * @param {Object} detection
 * @param {string} ocrText
 * @returns {number}  // 0.0–1.0
 */
function _scoreDetectionPosition(detection, ocrText) {
  let score = 0.5; // Baseline

  const { pattern, lineIndex = -1 } = detection;
  const lines = ocrText.split("\n");

  // ── Boost: Header zone (first 4 lines) ────────────────────────────────
  if (lineIndex >= 0 && lineIndex <= 3) {
    score += 0.25; // Strong signal — page numbers live in headers
  }

  // ── Boost: Footer zone (last 4 lines) ────────────────────────────────
  if (lineIndex >= 0 && lineIndex >= lines.length - 4) {
    score += 0.25; // Strong signal
  }

  // ── Boost: Specific patterns favored for page numbers ────────────────
  const pageNumberPatterns = [
    "page_keyword",
    "pg_keyword",
    "number_sign",
    "sheet_keyword",
  ];
  if (pageNumberPatterns.includes(pattern)) {
    score += 0.15;
  }

  // ── Penalize: Decorative/inline patterns (likely figure numbers) ───────
  const figurePatterns = ["decorated", "parens_inline", "brackets_line"];
  if (figurePatterns.includes(pattern)) {
    score -= 0.2;
  }

  return Math.min(1.0, Math.max(0.0, score));
}

/**
 * Identify the semantic context of each detected number.
 * Examples: "Figure 3" → { number: 3, context: "figure" }
 *
 * @param {Array} detections
 * @param {string} ocrText
 * @returns {Array<{ number: number, pattern: string, context: string }>}
 */
function _identifyNumberContext(detections, ocrText) {
  const results = [];
  const lines = ocrText.split("\n");

  for (const detection of detections) {
    const { pageNumber, pattern, matchedText, lineIndex } = detection;

    if (lineIndex < 0 || lineIndex >= lines.length) continue;

    const line = lines[lineIndex] || "";

    // Simple heuristic: look for keywords before/after the matched text
    const beforeText = line
      .substring(0, line.indexOf(matchedText))
      .toLowerCase();
    const afterText = line
      .substring(line.indexOf(matchedText) + matchedText.length)
      .toLowerCase();

    let context = null;

    if (
      beforeText.includes("figure") ||
      beforeText.includes("fig") ||
      afterText.includes("figure") ||
      afterText.includes("fig")
    ) {
      context = "figure";
    } else if (
      beforeText.includes("section") ||
      beforeText.includes("chapter") ||
      beforeText.includes("sec") ||
      beforeText.includes("ch")
    ) {
      context = "section/chapter";
    } else if (
      beforeText.includes("question") ||
      beforeText.includes("q ") ||
      afterText.match(/q\s*$/i)
    ) {
      context = "question";
    }

    if (context) {
      results.push({ number: pageNumber, pattern, context });
    }
  }

  return results;
}

/**
 * Group detections by matched page number.
 *
 * @param {Array} detections
 * @returns {Object}  // pageNumber -> [detections...]
 */
function _groupByNumber(detections) {
  const grouped = {};

  for (const detection of detections) {
    const num = detection.pageNumber;
    if (!grouped[num]) grouped[num] = [];
    grouped[num].push(detection);
  }

  return grouped;
}

module.exports = {
  detectAmbiguities,
};
