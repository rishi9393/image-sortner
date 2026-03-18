/**
 * Sequence Repair Service  –  v1 (Improvement #5)
 *
 * Detects gaps in detected page sequences and attempts intelligent repair:
 *
 * Example Input:  [1, 2, 5, 6, 8] detected (5 images, 3 gaps)
 * Issues:
 *   - Pages 3, 4, 7 are missing
 *   - Sequence is impossible if batch = 5 images (max 1–5)
 *   - Suggests either: pages mislabeled OR some expected pages not present
 *
 * Repair Strategy:
 *   1. Identify gaps
 *   2. Try to fill gaps using undetected images + text continuity
 *   3. Validate repaired sequence makes sense
 *   4. Flag for AI verification if suspicious
 */

"use strict";

const logger = require("../utils/logger");

/**
 * Analyze detected page numbers for gaps and anomalies.
 *
 * @param {number[]} detectedPages  // Sorted unique page numbers detected
 * @param {number} batchSize        // Total number of images in batch
 *
 * @returns {{
 *   hasGaps: boolean,
 *   gaps: Array<{ start: number, end: number, count: number }>,
 *   outOfRange: number[],         // Pages > batchSize
 *   coverage: number,             // 0.0–1.0 (how many of expected pages are detected)
 *   anomalyLevel: "normal" | "concerning" | "suspicious",
 *   recommendation: string,
 *   requiresAIVerification: boolean,
 * }}
 */
function analyzeSequenceGaps(detectedPages, batchSize) {
  if (!detectedPages || detectedPages.length === 0) {
    return {
      hasGaps: true,
      gaps: [],
      outOfRange: [],
      coverage: 0,
      anomalyLevel: "concerning",
      recommendation: "No page numbers detected.",
      requiresAIVerification: true,
    };
  }

  const sorted = [...detectedPages].sort((a, b) => a - b);
  const gaps = [];
  const outOfRange = [];

  // ── Identify gaps in sequence ────────────────────────────────────────────
  for (let i = sorted[0]; i <= sorted[sorted.length - 1]; i++) {
    if (!sorted.includes(i)) {
      // Check if this is the start of a new gap
      if (gaps.length === 0 || gaps[gaps.length - 1].end !== i - 1) {
        gaps.push({ start: i, end: i, count: 1 });
      } else {
        gaps[gaps.length - 1].end = i;
        gaps[gaps.length - 1].count++;
      }
    }
  }

  // ── Identify out-of-range pages ──────────────────────────────────────────
  for (const page of sorted) {
    if (page > batchSize) {
      outOfRange.push(page);
    }
  }

  // ── Calculate coverage ───────────────────────────────────────────────────
  const expectedMin = 1;
  const expectedMax = batchSize;
  const expectedRange = expectedMax - expectedMin + 1;
  const coverage = sorted.length / Math.max(1, expectedRange);

  // ── Determine anomaly level ──────────────────────────────────────────────
  let anomalyLevel = "normal";
  let requiresAIVerification = false;
  let recommendation = "Sequence looks normal.";

  if (outOfRange.length > 0) {
    anomalyLevel = "suspicious";
    requiresAIVerification = true;
    recommendation = `Pages detected outside plausible range (${outOfRange.join(", ")}). May indicate mislabeling.`;
  } else if (gaps.length > 2) {
    anomalyLevel = "concerning";
    requiresAIVerification = true;
    recommendation = `Multiple gaps detected (${gaps.length}). May indicate labeling errors or mixed documents.`;
  } else if (gaps.length === 1 && gaps[0].count > batchSize * 0.3) {
    // Large single gap
    anomalyLevel = "concerning";
    requiresAIVerification = true;
    recommendation = `Large gap (${gaps[0].count} consecutive missing pages). Verify pages aren't mislabeled.`;
  } else if (coverage < 0.5) {
    anomalyLevel = "concerning";
    recommendation = `Low coverage (${(coverage * 100).toFixed(0)}%). Many pages undetected.`;
  }

  return {
    hasGaps: gaps.length > 0,
    gaps,
    outOfRange,
    coverage: Math.min(1.0, coverage),
    anomalyLevel,
    recommendation,
    requiresAIVerification,
  };
}

/**
 * Attempt to repair a sequence by assigning undetected images to gaps.
 *
 * Uses text continuity scores to determine best placement for undetected images.
 *
 * @param {{
 *   pageNumber: number | null,
 *   confidence: number,
 *   originalIndex: number,
 *   textContinuityScores?: number[],  // Continuity score to each other image
 * }[]} analyses
 *
 * @param {number[]} gapPages  // Which page numbers are in gaps
 * @param {number[]} continuityMatrix  // Pre-built continuity scores
 *
 * @returns {{
 *   repaired: Object[],        // Images with potentially corrected page numbers
 *   changes: Array<{
 *     originalIndex: number,
 *     originalPageNumber: number | null,
 *     newPageNumber: number,
 *     confidence: number,  // How confident in the repair
 *     reason: string,
 *   }>,
 *   experimentalRepair: boolean,
 * }}
 */
function attemptSequenceRepair(analyses, gapPages, continuityMatrix = null) {
  if (!gapPages || gapPages.length === 0) {
    return {
      repaired: analyses,
      changes: [],
      experimentalRepair: false,
      explanation: "No gaps to repair.",
    };
  }

  const repaired = analyses.map((a) => ({ ...a }));
  const changes = [];

  // ── Identify undetected images ───────────────────────────────────────────
  const undetectedIndices = repaired
    .map((a, i) =>
      a.pageNumber === null || a.pageNumber === undefined ? i : -1,
    )
    .filter((i) => i >= 0);

  if (undetectedIndices.length === 0) {
    return {
      repaired,
      changes,
      experimentalRepair: false,
      explanation: "No undetected images available.",
    };
  }

  // ── For each gap, try to fill with undetected images based on continuity ─
  for (const gapPage of gapPages) {
    if (undetectedIndices.length === 0) break;

    let bestIndex = -1;
    let bestScore = -1;

    // Find which undetected image fits best in this gap position
    for (const undetIdx of undetectedIndices) {
      let score = 0;

      // Look for neighbors in repaired sequence
      const neighbors = repaired
        .map((a, i) =>
          a.pageNumber === gapPage - 1 || a.pageNumber === gapPage + 1 ? i : -1,
        )
        .filter((i) => i >= 0);

      if (continuityMatrix && neighbors.length > 0) {
        // Average continuity score to neighbors
        let sumScore = 0;
        for (const neighborIdx of neighbors) {
          sumScore += continuityMatrix[undetIdx]?.[neighborIdx] || 0;
        }
        score = sumScore / Math.max(1, neighbors.length);
      } else {
        // Fallback: position proximity
        score = 1.0 / (Math.abs(undetIdx - (gapPage - 1)) + 1);
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = undetIdx;
      }
    }

    // ── Assign best match to gap ─────────────────────────────────────────
    if (bestIndex >= 0 && bestScore > 0.3) {
      const oldPageNumber = repaired[bestIndex].pageNumber;
      repaired[bestIndex].pageNumber = gapPage;
      undetectedIndices.splice(undetectedIndices.indexOf(bestIndex), 1);

      changes.push({
        originalIndex: bestIndex,
        originalPageNumber: oldPageNumber,
        newPageNumber: gapPage,
        confidence: Math.min(0.65, bestScore), // Experimental repair = lower confidence
        reason: `Auto-repair: filled gap for page ${gapPage} using text continuity (score: ${bestScore.toFixed(2)})`,
      });
    }
  }

  const hasChanges = changes.length > 0;

  return {
    repaired,
    changes,
    experimentalRepair: hasChanges,
    explanation: hasChanges
      ? `Repaired ${changes.length} gap(s) using text continuity. Results are experimental.`
      : "Could not auto-repair gaps.",
  };
}

/**
 * Validate repaired sequence for consistency.
 *
 * @param {Object[]} repairedAnalyses
 * @returns {{
 *   valid: boolean,
 *   issuesFound: string[],
 * }}
 */
function validateRepairedSequence(repairedAnalyses) {
  const issues = [];
  const pageNumbers = repairedAnalyses
    .map((a) => a.pageNumber)
    .filter((p) => p !== null && p !== undefined)
    .sort((a, b) => a - b);

  // Check for duplicates
  const seen = new Set();
  for (const p of pageNumbers) {
    if (seen.has(p)) {
      issues.push(`Duplicate page number: ${p}`);
    }
    seen.add(p);
  }

  // Check for plausible range
  if (pageNumbers.length > 0) {
    const min = Math.min(...pageNumbers);
    const max = Math.max(...pageNumbers);
    const expectedMin = 1;
    const expectedMax = repairedAnalyses.length;

    if (min < expectedMin) {
      issues.push(`Page number ${min} below expected minimum (${expectedMin})`);
    }
    if (max > expectedMax) {
      issues.push(`Page number ${max} exceeds batch size (${expectedMax})`);
    }
  }

  return {
    valid: issues.length === 0,
    issuesFound: issues,
  };
}

module.exports = {
  analyzeSequenceGaps,
  attemptSequenceRepair,
  validateRepairedSequence,
};
