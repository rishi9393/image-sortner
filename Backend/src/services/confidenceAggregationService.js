/**
 * Confidence Aggregation Service  –  v1 (Improvement #6)
 *
 * Aggregates confidence scores from multiple signals and determines
 * overall sort reliability. Helps identify when a sort is low-confidence
 * and should be flagged to the user.
 *
 * Signals tracked:
 *  - OCR page detection confidence
 *  - AI vision confidence + verification status
 *  - Text continuity scores
 *  - Timestamp confidence
 *  - Messaging app matching confidence
 *
 * Final scoring: min(signal) must meet LOW_CONFIDENCE_THRESHOLD to proceed.
 * Returns confidence breakdown to client for transparency.
 */

"use strict";

const logger = require("../utils/logger");

// Thresholds
const MINIMUM_SIGNAL_CONFIDENCE = 0.7; // Lowest any signal can be
const OVERALL_CONFIDENCE_THRESHOLD = 0.65; // Overall minimum before warning
const HIGH_CONFIDENCE_THRESHOLD = 0.8; // Consider sort reliable

/**
 * Aggregate multiple signal confidences into overall confidence.
 *
 * @param {{
 *   ocr?: number,               // OCR-based page detection (0–1)
 *   ai?: number,                // AI vision detection (0–1)
 *   aiVerified?: boolean,        // Did AI Pass 2 verify the result?
 *   textContinuity?: number,    // Text continuity average (0–1)
 *   timestamp?: number,         // EXIF timestamp confidence (0–1)
 *   messagingApp?: number,      // Messaging app pattern match (0–1)
 *   crossImage?: number,        // Cross-image sequence confidence (0–1)
 *   numSignalsUsed?: number,    // How many signals contributed (1–7)
 * }} signals
 *
 * @returns {{
 *   overall: number,            // Aggregated confidence (0–1)
 *   minimum: number,            // Lowest signal confidence
 *   breakdown: Object,          // Per-signal scores
 *   quality: "high" | "good" | "fair" | "low",  // Human-readable quality
 *   warning?: string,           // Warning if confidence is low
 *   shouldFlagForReview?: boolean,
 * }}
 */
function aggregateConfidence(signals) {
  const filtered = {};
  const weights = {};

  // ── Collect weights and values for available signals ──────────────────────
  if (signals.ocr !== undefined && signals.ocr > 0) {
    filtered.ocr = signals.ocr;
    weights.ocr = 1.0; // High weight — direct detection
  }

  if (signals.ai !== undefined && signals.ai > 0) {
    let score = signals.ai;
    if (signals.aiVerified === true) {
      score = Math.min(0.99, score + 0.1); // Boost if verified
    }
    filtered.ai = score;
    weights.ai = 1.2; // Higher weight — multi-pass verification
  }

  if (signals.textContinuity !== undefined && signals.textContinuity > 0) {
    filtered.textContinuity = signals.textContinuity;
    weights.textContinuity = 0.6; // Medium weight — fallback signal
  }

  if (signals.timestamp !== undefined && signals.timestamp > 0) {
    filtered.timestamp = signals.timestamp;
    weights.timestamp = 0.7; // Medium-high weight — if present, usually reliable
  }

  if (signals.messagingApp !== undefined && signals.messagingApp > 0) {
    filtered.messagingApp = signals.messagingApp;
    weights.messagingApp = 1.3; // Highest weight — nearly bulletproof (e.g., WhatsApp)
  }

  if (signals.crossImage !== undefined && signals.crossImage > 0) {
    filtered.crossImage = signals.crossImage;
    weights.crossImage = 0.8; // Good weight — collective signal
  }

  // ── Calculate weighted average ────────────────────────────────────────────
  let totalWeight = 0;
  let totalScore = 0;

  for (const [signal, value] of Object.entries(filtered)) {
    const weight = weights[signal] || 1.0;
    totalScore += value * weight;
    totalWeight += weight;
  }

  const overall = totalWeight > 0 ? totalScore / totalWeight : 0;

  // ── Find minimum signal (weakest link) ───────────────────────────────────
  const values = Object.values(filtered);
  const minimum = values.length > 0 ? Math.min(...values) : 0;

  // ── Determine quality tier ──────────────────────────────────────────────
  let quality = "low";
  let shouldFlagForReview = false;
  let warning = null;

  if (overall >= 0.85 && minimum >= 0.75) {
    quality = "high";
  } else if (overall >= 0.75 && minimum >= 0.65) {
    quality = "good";
  } else if (overall >= 0.6 && minimum >= 0.5) {
    quality = "fair";
    shouldFlagForReview = true;
    warning = "Sort confidence is fair; manual review recommended.";
  } else {
    quality = "low";
    shouldFlagForReview = true;
    warning =
      "Sort confidence is low; result may be unreliable. Manual review strongly recommended.";
  }

  // ── Additional check: if only one signal used, flag ──────────────────────
  const numSignalsUsed = Object.keys(filtered).length;
  if (numSignalsUsed === 1 && minimum < 0.8) {
    shouldFlagForReview = true;
    if (!warning) {
      warning = "Only one detection method succeeded; low confidence sort.";
    }
  }

  // ── Check minimum threshold ──────────────────────────────────────────────
  if (
    minimum < MINIMUM_SIGNAL_CONFIDENCE &&
    overall >= OVERALL_CONFIDENCE_THRESHOLD
  ) {
    // Weak individual signal, but overall strong
    shouldFlagForReview = true;
    if (!warning) {
      warning = `Weakest signal has confidence ${minimum.toFixed(2)}; consider manual verification.`;
    }
  }

  return {
    overall: Math.min(0.99, Math.max(0.0, overall)),
    minimum: Math.min(0.99, Math.max(0.0, minimum)),
    breakdown: filtered,
    quality,
    warning,
    shouldFlagForReview,
    numSignalsUsed,
  };
}

/**
 * Determine if a sort result should be used or rejected based on confidence.
 *
 * @param {{
 *   overall: number,
 *   minimum: number,
 *   quality: string,
 * }} aggregation
 *
 * @param {Object} options
 * @param {boolean} options.strictMode  // If true, require overall >= 0.70
 * @returns {{
 *   acceptable: boolean,
 *   reason: string,
 * }}
 */
function isSortAcceptable(aggregation, options = {}) {
  const { strictMode = false } = options;
  const threshold = strictMode ? 0.7 : OVERALL_CONFIDENCE_THRESHOLD;

  if (aggregation.overall >= threshold) {
    return {
      acceptable: true,
      reason: `Sort confidence (${aggregation.overall.toFixed(2)}) meets threshold.`,
    };
  }

  return {
    acceptable: false,
    reason: `Sort confidence (${aggregation.overall.toFixed(2)}) below threshold (${threshold}).`,
  };
}

/**
 * Build a human-readable confidence report for the client.
 *
 * @param {{
 *   sortMethod: string,
 *   signals: Object,
 *   aggregation: Object,
 * }} context
 * @returns {string}
 */
function buildConfidenceReport(context) {
  const { sortMethod, aggregation } = context;

  const lines = [
    `Sort Method: ${sortMethod}`,
    `Overall Confidence: ${(aggregation.overall * 100).toFixed(1)}%`,
    `Quality: ${aggregation.quality.toUpperCase()}`,
    `Signals Used: ${aggregation.numSignalsUsed}`,
  ];

  if (Object.keys(aggregation.breakdown).length > 0) {
    lines.push("Signal Breakdown:");
    for (const [signal, score] of Object.entries(aggregation.breakdown)) {
      lines.push(`  - ${signal}: ${(score * 100).toFixed(1)}%`);
    }
  }

  if (aggregation.warning) {
    lines.push(`⚠️  ${aggregation.warning}`);
  }

  return lines.join("\n");
}

module.exports = {
  aggregateConfidence,
  isSortAcceptable,
  buildConfidenceReport,
  MINIMUM_SIGNAL_CONFIDENCE,
  OVERALL_CONFIDENCE_THRESHOLD,
  HIGH_CONFIDENCE_THRESHOLD,
};
