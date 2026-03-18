/**
 * AI Enhancement Service  –  v1 (Improvements #7, #8)
 *
 * Provides enhanced AI verification capabilities:
 * - Improved Pass 2 verification for uncertain results
 * - Duplicate page detection and arbitration
 * - Handwritten digit confirmation
 * - Pass 2 enhanced to run more frequently
 */

"use strict";

const logger = require("../utils/logger");

/**
 * Determine if AI Pass 2 should run based on confidence signals.
 * More aggressive than original (run on uncertain results, not just high-coverage results).
 *
 * @param {{
 *   pageNumbers: number[],
 *   confidence: number,
 *   perImageConfidence: string[],
 *   coverage: number,  // % of images with detected page numbers
 * }} aiResult
 *
 * @param {{
 *   ocrConfidence?: number,
 *   hasAmbiguities?: boolean,
 *   hasHandwritten?: boolean,
 * }} context
 *
 * @returns {boolean}  // Should run Pass 2 verification
 */
function shouldRunEnhancedVerification(aiResult, context = {}) {
  const { confidence = 0, perImageConfidence = [], coverage = 0 } = aiResult;
  const {
    ocrConfidence = 0,
    hasAmbiguities = false,
    hasHandwritten = false,
  } = context;

  // Original condition: high coverage + AI available
  const originalCondition = coverage >= 0.5;

  // NEW conditions: run even with lower coverage if signals are uncertain
  const lowConfidenceSignal = confidence >= 0.45 && confidence <= 0.7; // Marginal confidence
  const hasAmbiguousPagesInAI =
    perImageConfidence.filter((c) => c === "low").length > 0;
  const ocrLowConfidence = ocrConfidence < 0.6 && ocrConfidence > 0;
  const mixedResults = hasAmbiguities || hasHandwritten;

  return (
    originalCondition ||
    (lowConfidenceSignal && coverage >= 0.3) ||
    (hasAmbiguousPagesInAI && coverage >= 0.3) ||
    (ocrLowConfidence && mixedResults && coverage >= 0.25)
  );
}

/**
 * Enhanced Pass 2 verification prompt that specifically addresses common issues.
 *
 * @param {Array<{fileStem: string, proposedPageNumber: number, confidence: string}>} imageInfo
 * @returns {string}  // Enhanced system prompt
 */
function buildEnhancedVerificationPrompt(imageInfo) {
  return `You are a document expert performing a FINAL VERIFICATION of page ordering.

I gave you these images with proposed page numbers:
${imageInfo.map((img, i) => `  - Image ${i + 1}: page ${img.proposedPageNumber} (confidence: ${img.confidence})`).join("\n")}

Your task: Check if this order makes sense. Look for:

1. **Handwritten Digit Misreads**: Are there any suspicious digits (is "6" actually "9"? "1" actually "7")? 
   Common OCR errors: 6↔9, 1↔7, 0↔O, 3↔8. If you see a possible misread affecting logical order, flag it.

2. **Missing or Duplicate Pages**: Are pages in a clear sequence? Any obvious gaps like [1,2,3,5,6]?
   Should page 4 be present but mislabeled?

3. **Thematic Coherence**: As you move through pages, does content flow logically?
   Are there jarring topic jumps that suggest wrong order?

4. **Content Continuation**: Do partial sentences at page boundaries continue naturally?
   Or do they suggest pages are out of order?

Return JSON:
{
  "isCorrectOrder": boolean,
  "issues": ["issue1", "issue2"],
  "corrections": [
    { "currentPageNumber": 6, "suggestedPageNumber": 9, "reason": "OCR likely misread 9 as 6; content flow confirms" }
  ],
  "confidence": "high" | "medium" | "low"
}`;
}

/**
 * Detect if two images might have duplicate page numbers (both marked as "Page 3", etc).
 * Helper for improvement #8.
 *
 * @param {{
 *   pageNumber: number | null,
 *   confidence: number,
 *   originalIndex: number,
 * }[]} analyses
 *
 * @returns {{
 *   hasDuplicates: boolean,
 *   groups: Map<number, Array<{ index: number, confidence: number }>>,
 * }}
 */
function detectDuplicatePageNumbers(analyses) {
  const groups = new Map();

  for (let i = 0; i < analyses.length; i++) {
    const page = analyses[i].pageNumber;
    if (page === null || page === undefined) continue;

    if (!groups.has(page)) {
      groups.set(page, []);
    }
    groups
      .get(page)
      .push({
        index: i,
        confidence: analyses[i].pageDetection?.confidence || 0,
      });
  }

  const hasDuplicates = Array.from(groups.values()).some((g) => g.length > 1);

  return { hasDuplicates, groups };
}

/**
 * When duplicates detected, resolve using text continuity scores.
 * Keep the image that flows more naturally with neighbors.
 *
 * @param {Map<number, Array>} duplicateGroups
 * @param {number[][]} continuityMatrix  // Pre-computed text continuity scores
 * @returns {{
 *   resolvedAssignments: Map<number, number>,  // pageNumber -> image index to keep
 *   discarded: number[],  // Image indices to discard/treat as undetected
 *   confidence: number,   // How confident in the resolution
 * }}
 */
function resolveDuplicatesByTextFlow(duplicateGroups, continuityMatrix) {
  const resolvedAssignments = new Map();
  const discarded = [];
  let confidenceSum = 0;
  let count = 0;

  for (const [pageNum, candidates] of duplicateGroups) {
    if (candidates.length === 1) {
      resolvedAssignments.set(pageNum, candidates[0].index);
      continue;
    }

    // Score each candidate based on how well it flows with neighbors
    let bestIdx = -1;
    let bestScore = -1;

    for (const candidate of candidates) {
      const imgIdx = candidate.index;
      let flowScore = 0;

      // Average continuity to neighbors (prev/next in proposed order)
      const prevIdx = imgIdx - 1;
      const nextIdx = imgIdx + 1;

      if (prevIdx >= 0 && continuityMatrix[prevIdx]) {
        flowScore += continuityMatrix[prevIdx][imgIdx] || 0;
      }
      if (nextIdx < continuityMatrix.length && continuityMatrix[imgIdx]) {
        flowScore += continuityMatrix[imgIdx][nextIdx] || 0;
      }

      if (flowScore > bestScore) {
        bestScore = flowScore;
        bestIdx = imgIdx;
      }
    }

    // Keep best, discard others
    if (bestIdx >= 0) {
      resolvedAssignments.set(pageNum, bestIdx);
      confidenceSum += bestScore;
      count++;

      for (const candidate of candidates) {
        if (candidate.index !== bestIdx) {
          discarded.push(candidate.index);
        }
      }
    }
  }

  const avgConfidence = count > 0 ? confidenceSum / count : 0;

  return {
    resolvedAssignments,
    discarded,
    confidence: Math.min(0.75, avgConfidence), // Caps at 0.75 since it's a fallback resolution
  };
}

module.exports = {
  shouldRunEnhancedVerification,
  buildEnhancedVerificationPrompt,
  detectDuplicatePageNumbers,
  resolveDuplicatesByTextFlow,
};
