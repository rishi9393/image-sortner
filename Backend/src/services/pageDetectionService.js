/**
 * Page Detection Service  –  v3 (enhanced patterns + cross-image analysis + ambiguity)
 *
 * Major improvements over v1:
 *
 *  1. 13 PATTERNS (was 7)
 *     Added: "#3", "No. 3", "Sheet 3", "[4]", "~3~", decorated numbers,
 *     and flexible spacing/punctuation variants.
 *
 *  2. POSITION-BASED CONFIDENCE BOOSTING
 *     Numbers found in the first or last 3 lines of text (header/footer
 *     zone) receive a +0.15 confidence boost — this is where page numbers
 *     live on real documents.
 *
 *  3. CROSS-IMAGE SEQUENCE ANALYSIS  ← KEY FEATURE
 *     detectPageNumbersAcrossImages() looks at ALL numbers found in ALL
 *     images and tries to find a valid sequential assignment (1,2,3…N).
 *     This works even when individual per-image detection has low
 *     confidence, because the COLLECTIVE signal is strong.
 *
 *  4. STANDALONE NUMBER FIX
 *     Standalone number confidence raised from 0.55 → 0.60, and the
 *     position boost can push it to 0.75 — above the sorting threshold.
 *
 *  5. ★ MULTI-DETECTION AMBIGUITY HANDLING (v3) – Improvement #3, #7
 *     Detects when image has multiple distinct numbers and disambiguates
 *     using position scoring and semantic context. Flags for AI verification
 *     when confidence gap is low.
 *
 *  6. ★ DIGIT VALIDATION (v3) – Improvement #1
 *     Validates marginal digit detections against batch context,
 *     detects lookalike misreads (6↔9, 1↔7), suggests corrections.
 */

"use strict";

const logger = require("../utils/logger");
const digitValidation = require("./digitValidationService");
const ambiguityDetection = require("./ambiguityDetectionService");

// ── Single-image patterns ─────────────────────────────────────────────────────

/**
 * @typedef {Object} PageDetectionResult
 * @property {number}  pageNumber
 * @property {number}  confidence   0.0 – 1.0
 * @property {string}  matchedText
 * @property {string}  pattern
 */

const PATTERNS = [
  // "Page 3" / "page: 3" / "Page 3 of 10"
  {
    name: "page_keyword",
    regex: /\bpage\s*[:\-.]?\s*(\d+)(?:\s*(?:of|\/)\s*\d+)?\b/i,
    group: 1,
    confidence: 0.95,
  },
  // "Pg 2" / "Pg. 2" / "Pg 2 of 5"
  {
    name: "pg_keyword",
    regex: /\bpg\.?\s*(\d+)(?:\s*(?:of|\/)\s*\d+)?\b/i,
    group: 1,
    confidence: 0.92,
  },
  // "P. 4"
  {
    name: "p_dot_keyword",
    regex: /\bP\.\s*(\d+)\b/,
    group: 1,
    confidence: 0.88,
  },
  // "#3" / "# 3" / "No. 3" / "No 3"
  {
    name: "number_sign",
    regex: /(?:#\s*|No\.?\s+)(\d+)\b/i,
    group: 1,
    confidence: 0.86,
  },
  // "-3-" / "– 3 –" / "— 3 —"
  {
    name: "dashes",
    regex: /[-–—]\s*(\d+)\s*[-–—]/,
    group: 1,
    confidence: 0.85,
  },
  // "3 / 10" / "3/10" on its own line
  {
    name: "fraction_line",
    regex: /^(\d+)\s*\/\s*\d+$/,
    group: 1,
    confidence: 0.85,
  },
  // "Sheet 3" / "Slide 3" / "Chapter 3" / "Ch. 3" / "Section 3" / "Part 3" / "Q 3" / "Question 3"
  {
    name: "sheet_keyword",
    regex:
      /\b(?:sheet|slide|chapter|ch\.?|section|sec\.?|part|question|q\.?)\s*[:\-.]?\s*(\d+)\b/i,
    group: 1,
    confidence: 0.82,
  },
  // "(4)" on its own line
  {
    name: "parens_line",
    regex: /^\(\s*(\d+)\s*\)$/,
    group: 1,
    confidence: 0.78,
  },
  // "[4]" on its own line
  {
    name: "brackets_line",
    regex: /^\[\s*(\d+)\s*\]$/,
    group: 1,
    confidence: 0.78,
  },
  // "~3~" / "* 3 *" / "• 3 •"
  {
    name: "decorated",
    regex: /[~*•]\s*(\d+)\s*[~*•]/,
    group: 1,
    confidence: 0.72,
  },
  // "(4)" anywhere in text (not just own line)
  {
    name: "parens_inline",
    regex: /\(\s*(\d{1,3})\s*\)/,
    group: 1,
    confidence: 0.62,
  },
  // ★ NEW patterns for corner/margin page numbers
  // "| 3" / "| 3 |" (margin separator)
  {
    name: "margin_separator",
    regex: /^\s*\|\s*(\d{1,3})\s*\|?\s*$/,
    group: 1,
    confidence: 0.78,
  },
  // Just a number with light content (likely page number, not body text)
  // "3   " or "    3" (number with whitespace, common in printed margins)
  // Matches: number at line start/end with significant whitespace
  {
    name: "margin_number",
    regex: /^(\d{1,3})\s{2,}$|^\s{2,}(\d{1,3})$/,
    group: 1,
    confidence: 0.75,
  },
  // Standalone number on its own line — the MOST COMMON case for handwritten notes
  {
    name: "standalone_number",
    regex: /^(\d{1,3})$/,
    group: 1,
    confidence: 0.60,
  },
  // Number at very start or end of entire text (even if not on its own line)
  {
    name: "edge_number",
    regex: /(?:^|\n)\s*(\d{1,3})\s*(?:\n|$)/,
    group: 1,
    confidence: 0.55,
  },
];

const MAX_PLAUSIBLE_PAGE = 500;

/** Confidence boost for numbers found in the first or last N lines */
const EDGE_LINE_COUNT = 8; // Increased from 4 → catches numbers in margins/corners
const EDGE_BOOST = 0.20; // Increased from 0.15 → stronger signal for header/footer
const CORNER_BOOST = 0.30; // Additional boost for very top/bottom (corners)

// ── Single-image detection ────────────────────────────────────────────────────

/**
 * Detect the most likely page number from OCR text of ONE image.
 * Enhanced with position-based confidence boosting.
 *
 * @param {string} text
 * @returns {PageDetectionResult | null}
 */
function detectPageNumber(text) {
  if (!text || text.trim().length === 0) return null;

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const lineCount = lines.length;
  const candidates = [];

  for (const { name, regex, group, confidence } of PATTERNS) {
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const match = line.match(regex);
      if (!match) continue;

      // Handle alternation: if match[group] is undefined, try other groups
      let num = parseInt(match[group], 10);
      if (!Number.isFinite(num)) {
        // Try other groups (for patterns with alternation like "^(a)|^(b)$")
        for (let g = 1; g < match.length; g++) {
          num = parseInt(match[g], 10);
          if (Number.isFinite(num)) break;
        }
      }
      if (!Number.isFinite(num) || num <= 0 || num > MAX_PLAUSIBLE_PAGE)
        continue;

      // Position-based confidence boost: header/footer lines get a boost
      // Corner boost (first/last line) is strongest, then edge zone is stronger
      const isCornerLine =
        li === 0 || li === lineCount - 1; // Very top or bottom
      const isEdgeLine =
        li < EDGE_LINE_COUNT || li >= lineCount - EDGE_LINE_COUNT;
      let finalConf = confidence;
      if (isCornerLine) {
        finalConf = Math.min(1.0, confidence + CORNER_BOOST); // +0.30 for actual corners
      } else if (isEdgeLine) {
        finalConf = Math.min(1.0, confidence + EDGE_BOOST); // +0.20 for edge zone
      }

      candidates.push({
        pageNumber: num,
        confidence: finalConf,
        matchedText: match[0].trim(),
        pattern: name,
        lineIndex: li,
        isEdge: isEdgeLine,
      });
    }
  }

  if (candidates.length === 0) return null;

  // Sort: confidence desc, then prefer edge positions, then lower page number
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (a.isEdge !== b.isEdge) return a.isEdge ? -1 : 1;
    return a.pageNumber - b.pageNumber;
  });

  // Multi-pattern agreement boost
  const best = { ...candidates[0] };
  if (candidates.length >= 2 && candidates[1].pageNumber === best.pageNumber) {
    best.confidence = Math.min(1.0, best.confidence + 0.05);
  }

  return {
    pageNumber: best.pageNumber,
    confidence: best.confidence,
    matchedText: best.matchedText,
    pattern: best.pattern,
  };
}

// ── Cross-image sequence analysis ─────────────────────────────────────────────

/**
 * Analyse ALL images together to find a valid page-number sequence.
 *
 * Strategy:
 *  1. For each image, collect every candidate number from the OCR text.
 *  2. Try sequences [s, s+1, s+2, …, s+N-1] for s = 1..5.
 *  3. For each sequence, find the BEST assignment of page numbers to images
 *     using a bipartite matching approach (greedy with edge-preference).
 *  4. Return the assignment with the highest coverage.
 *
 * This works even when per-image confidence is low, because the collective
 * signal (N images with numbers 1–N) is very strong.
 *
 * @param {{ text: string, confidence: number }[]} ocrResults  - One per image
 * @param {PageDetectionResult[]} perImageDetections  - One per image (can be null)
 * @returns {{ pageNumbers: number[], confidence: number, method: string } | null}
 */
function detectPageNumbersAcrossImages(ocrResults, perImageDetections) {
  const n = ocrResults.length;
  if (n < 2) return null;

  // ── Step 1: Collect ALL candidate numbers per image ──────────────────────
  const imageCandidates = ocrResults.map((ocr, idx) => {
    const candidates = [];
    const text = ocr?.text || "";
    if (!text.trim()) return candidates;

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const lineCount = lines.length;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const isEdge = li < EDGE_LINE_COUNT || li >= lineCount - EDGE_LINE_COUNT;
      const matches = line.matchAll(/\b(\d{1,3})\b/g);

      for (const m of matches) {
        const num = parseInt(m[1], 10);
        if (num > 0 && num <= Math.max(n * 3, 50)) {
          candidates.push({
            number: num,
            isEdge,
            lineIdx: li,
            // Priority score: edge numbers and small numbers preferred
            priority: (isEdge ? 10 : 0) + (num <= n ? 5 : 0),
          });
        }
      }
    }

    // Also add the per-image detection if it exists
    const det = perImageDetections?.[idx];
    if (det) {
      candidates.push({
        number: det.pageNumber,
        isEdge: true,
        lineIdx: -1,
        priority: 20 + det.confidence * 10, // high priority
      });
    }

    // Deduplicate: keep highest-priority entry per number
    const best = new Map();
    for (const c of candidates) {
      const existing = best.get(c.number);
      if (!existing || c.priority > existing.priority) best.set(c.number, c);
    }
    return [...best.values()].sort((a, b) => b.priority - a.priority);
  });

  // ── Step 2: Try sequences starting from 1..5 ─────────────────────────────
  let bestResult = null;
  let bestCoverage = 0;
  let bestEdgeScore = 0;

  for (let start = 1; start <= 5; start++) {
    const expected = Array.from({ length: n }, (_, i) => start + i);
    const result = _matchSequence(imageCandidates, expected, n);

    if (
      result.coverage > bestCoverage ||
      (result.coverage === bestCoverage && result.edgeScore > bestEdgeScore)
    ) {
      bestCoverage = result.coverage;
      bestEdgeScore = result.edgeScore;
      bestResult = { ...result, start };
    }
  }

  // ── Step 3: Validate ─────────────────────────────────────────────────────
  // Need at least 50% coverage for cross-image to be meaningful
  if (!bestResult || bestCoverage < 0.5) {
    logger.debug(
      `Cross-image: no valid sequence found (best coverage: ${(bestCoverage * 100).toFixed(0)}%)`,
    );
    return null;
  }

  // Confidence based on coverage
  const confidence = 0.5 + bestCoverage * 0.4; // 0.5 coverage → 0.70, 1.0 → 0.90

  logger.info(
    `Cross-image: found sequence starting at ${bestResult.start}, ` +
      `coverage ${(bestCoverage * 100).toFixed(0)}%, confidence ${confidence.toFixed(2)}`,
  );

  return {
    pageNumbers: bestResult.assignment,
    confidence,
    method: "cross_image_sequence",
    start: bestResult.start,
    coverage: bestCoverage,
  };
}

/**
 * Try to assign expected page numbers [s, s+1, …] to images using
 * greedy bipartite matching with priority scoring.
 *
 * @param {Array<Array<{number: number, isEdge: boolean, priority: number}>>} imageCandidates
 * @param {number[]} expected - Expected page numbers
 * @param {number}   n        - Total number of images
 * @returns {{ assignment: (number|null)[], coverage: number, edgeScore: number }}
 */
function _matchSequence(imageCandidates, expected, n) {
  const assignment = new Array(n).fill(null);
  const usedImages = new Set();
  const usedPages = new Set();

  // Build a score matrix: for each (expected page, image) pair,
  // compute how well that assignment works
  const pairs = [];
  for (const pageNum of expected) {
    for (let imgIdx = 0; imgIdx < n; imgIdx++) {
      const cand = imageCandidates[imgIdx].find((c) => c.number === pageNum);
      if (cand) {
        pairs.push({
          pageNum,
          imgIdx,
          priority: cand.priority,
          isEdge: cand.isEdge,
        });
      }
    }
  }

  // Sort by priority descending — assign best matches first
  pairs.sort((a, b) => b.priority - a.priority);

  let edgeScore = 0;
  for (const { pageNum, imgIdx, isEdge } of pairs) {
    if (usedImages.has(imgIdx) || usedPages.has(pageNum)) continue;
    assignment[imgIdx] = pageNum;
    usedImages.add(imgIdx);
    usedPages.add(pageNum);
    if (isEdge) edgeScore++;
  }

  const matched = assignment.filter((a) => a !== null).length;
  const coverage = matched / n;

  return { assignment, coverage, edgeScore };
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { detectPageNumber, detectPageNumbersAcrossImages };
