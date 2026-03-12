/**
 * Text Continuity Service  –  v3 (O(n) tokenization)
 *
 * Key improvement over v2:
 *
 *  PRE-TOKENIZATION
 *  ─────────────────
 *  The v2 buildContinuityMatrix called scoreContinuity(textA, textB) for
 *  every ordered pair (i, j) — n×(n−1) calls.  Each call tokenized BOTH
 *  texts from scratch.  For 20 images that means 380 tokenizations of 20
 *  texts = 7 600 tokenize() invocations.
 *
 *  v3 calls _preprocessText() exactly once per image (n calls total) and
 *  stores tokens, filtered word-sets, first-line, and last-char.  The inner
 *  loop uses _scoreFast() which only receives the pre-built objects — zero
 *  repeated string parsing.
 *
 *  For 20 images: 20 tokenizations instead of 7 600.  ~380× faster matrix
 *  build for large batches.
 */

"use strict";

const logger = require("../utils/logger");

// ── Constants ─────────────────────────────────────────────────────────────────

const CONTEXT_WORDS    = 30;  // words sampled from each end of a page
const MIN_WORDS_REQUIRED = 10; // don't attempt scoring below this threshold

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a continuity-score matrix for an ordered set of OCR texts.
 *
 * continuityMatrix[i][j] = float 0.0–1.0
 *   High score ⟹ "text of image i flows naturally into image j"
 *
 * @param {Array<{ ocr?: { text?: string }, originalIndex: number }>} analyses
 * @returns {number[][]}
 */
function buildContinuityMatrix(analyses) {
  const n = analyses.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

  // ── PRE-TOKENIZE each image ONCE (O(n)) ──────────────────────────────────
  const preprocessed = analyses.map((a) => _preprocessText(a.ocr?.text || ""));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      matrix[i][j] = _scoreFast(preprocessed[i], preprocessed[j]);
    }
  }

  return matrix;
}

/**
 * @deprecated  Use buildContinuityMatrix for batch work.
 * Kept for backward-compat and unit-tests.
 */
function scoreContinuity(textA, textB) {
  return _scoreFast(_preprocessText(textA), _preprocessText(textB));
}

/**
 * Sort analyses using text continuity as the primary signal.
 *
 * @param {Array} analyses
 * @returns {{ sortedImages: Array, sortMethod: string, sortMethodDescription: string }}
 */
function sortByTextContinuity(analyses) {
  logger.info("Text continuity: building continuity matrix (v3 — pre-tokenized)…");
  const matrix = buildContinuityMatrix(analyses);
  const order  = _greedySort(matrix, analyses.length);

  const sortedImages = order.map((idx) => analyses[idx]);

  let totalScore = 0;
  let pairs      = 0;
  for (let k = 0; k < order.length - 1; k++) {
    totalScore += matrix[order[k]][order[k + 1]];
    pairs++;
  }
  const avgScore = pairs > 0 ? (totalScore / pairs).toFixed(2) : 0;

  logger.info(`Text continuity sort complete. Avg pair score: ${avgScore}`);

  return {
    sortedImages,
    sortMethod:             "text_continuity",
    sortMethodDescription:  `Sorted by text flow analysis between pages (avg continuity score: ${avgScore}).`,
  };
}

// ── Pre-processing ────────────────────────────────────────────────────────────

/**
 * Pre-compute everything needed for continuity scoring for ONE page.
 * Called once per image — results are reused for all n−1 pair comparisons.
 *
 * @param {string} text
 * @returns {{
 *   wordCount: number,
 *   filteredTail: Set<string>,  // unique content words at end of page
 *   filteredHead: Set<string>,  // unique content words at start of page
 *   lastChar:    string,        // last non-whitespace character
 *   firstLine:   string,        // first non-empty line
 * }}
 */
function _preprocessText(text) {
  if (!text || text.trim().length === 0) {
    return { wordCount: 0, filteredTail: new Set(), filteredHead: new Set(), lastChar: "", firstLine: "" };
  }

  const words = _tokenize(text);

  const tailWords = words.slice(-CONTEXT_WORDS).map((w) => w.toLowerCase());
  const headWords = words.slice(0,  CONTEXT_WORDS).map((w) => w.toLowerCase());

  const filteredTail = new Set(tailWords.filter((w) => !STOP_WORDS.has(w) && w.length > 3));
  const filteredHead = new Set(headWords.filter((w) => !STOP_WORDS.has(w) && w.length > 3));

  const lastChar  = text.trimEnd().slice(-1);
  const firstLine = text.trim().split("\n")[0].trim();

  return { wordCount: words.length, filteredTail, filteredHead, lastChar, firstLine };
}

/**
 * Score how well pre-processed page A flows into pre-processed page B.
 * All O(n) tokenization work already done — this is pure Set arithmetic.
 *
 * @param {ReturnType<typeof _preprocessText>} a
 * @param {ReturnType<typeof _preprocessText>} b
 * @returns {number} 0.0–1.0
 */
function _scoreFast(a, b) {
  if (a.wordCount < MIN_WORDS_REQUIRED || b.wordCount < MIN_WORDS_REQUIRED) return 0;

  let score = 0;

  // ── Signal 1: Incomplete sentence at end of A (0–0.35) ────────────────────
  if (![".", "?", "!", ":", ";"].includes(a.lastChar)) score += 0.35;

  // ── Signal 2: Vocabulary overlap between tail-A and head-B (0–0.40) ───────
  if (a.filteredTail.size > 0 && b.filteredHead.size > 0) {
    let intersectionCount = 0;
    // Iterate the smaller set for efficiency
    const [smaller, larger] =
      a.filteredTail.size <= b.filteredHead.size
        ? [a.filteredTail, b.filteredHead]
        : [b.filteredHead, a.filteredTail];

    for (const w of smaller) {
      if (larger.has(w)) intersectionCount++;
    }

    const unionSize = a.filteredTail.size + b.filteredHead.size - intersectionCount;
    const jaccard   = intersectionCount / unionSize;
    score += jaccard * 0.40;
  }

  // ── Signal 3: Page B does NOT start with a heading/title (0–0.25) ─────────
  const looksLikeHeading =
    b.firstLine.length < 60 &&
    (b.firstLine === b.firstLine.toUpperCase() || /^[A-Z][^a-z]{5,}/.test(b.firstLine));

  if (!looksLikeHeading) score += 0.25;

  return Math.min(1.0, Math.max(0, score));
}

// ── Greedy sort ───────────────────────────────────────────────────────────────

function _greedySort(matrix, n) {
  if (n === 0) return [];
  if (n === 1) return [0];

  const visited = new Set();
  const order   = [];

  // Best starting page: lowest column-sum (nothing naturally precedes it)
  let bestStart = 0;
  let bestScore = Infinity;
  for (let j = 0; j < n; j++) {
    let colSum = 0;
    for (let i = 0; i < n; i++) {
      if (i !== j) colSum += matrix[i][j];
    }
    if (colSum < bestScore) { bestScore = colSum; bestStart = j; }
  }

  let current = bestStart;
  while (order.length < n) {
    visited.add(current);
    order.push(current);

    let nextPage  = -1;
    let nextScore = -1;
    for (let j = 0; j < n; j++) {
      if (!visited.has(j) && matrix[current][j] > nextScore) {
        nextScore = matrix[current][j];
        nextPage  = j;
      }
    }
    if (nextPage === -1) break;
    current = nextPage;
  }

  for (let i = 0; i < n; i++) {
    if (!visited.has(i)) order.push(i);
  }

  return order;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _tokenize(text) {
  return text.replace(/[^a-zA-Z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by",
  "from","is","are","was","were","be","been","being","have","has","had","do",
  "does","did","will","would","could","should","may","might","can","this","that",
  "these","those","it","its","as","if","so","not","no","also","into","than",
  "then","when","where","which","who","what","how","all","each","more","their",
  "they","them","we","you","he","she","his","her","our","your","my","about",
  "up","out","very","just","there",
]);

module.exports = { buildContinuityMatrix, scoreContinuity, sortByTextContinuity };
