/**
 * Text Continuity Service
 *
 * Analyses whether the text content of one image "flows into" the next,
 * which is a strong signal that two pages are adjacent in the correct order.
 *
 * How it works:
 *  - Extracts the last N words from page A and the first N words from page B
 *  - Scores the "flow" based on:
 *      1. Sentence boundary detection (does page A end mid-sentence?)
 *      2. Common vocabulary / topic overlap between pages
 *      3. Absence of repeated headings (headings repeat → new section, not adjacent)
 *
 * The output is a continuity matrix: score[i][j] = how well page i flows into page j.
 * The sorting service uses this matrix as a tie-breaker or primary signal when
 * page numbers and timestamps are both unavailable.
 */

const logger = require("../utils/logger");

// Number of words to sample from the end/start of each page
const CONTEXT_WORDS = 30;

// Minimum words needed to attempt a continuity score
const MIN_WORDS_REQUIRED = 10;

/**
 * Build a continuity score matrix for an ordered set of OCR texts.
 *
 * continuityMatrix[i][j] = float 0.0–1.0
 *   High score means "text of image i flows naturally into image j"
 *
 * @param {Array<{ text: string, originalIndex: number }>} analyses
 * @returns {number[][]} n×n matrix of continuity scores
 */
function buildContinuityMatrix(analyses) {
  const n = analyses.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      matrix[i][j] = scoreContinuity(
        analyses[i].ocr?.text || "",
        analyses[j].ocr?.text || ""
      );
    }
  }

  return matrix;
}

/**
 * Score how naturally textA flows into textB.
 * Returns a float 0.0 (no relation) – 1.0 (very strong flow).
 *
 * @param {string} textA  Full OCR text of the "previous" page
 * @param {string} textB  Full OCR text of the "next" page
 * @returns {number}
 */
function scoreContinuity(textA, textB) {
  if (!textA || !textB) return 0;

  const wordsA = tokenize(textA);
  const wordsB = tokenize(textB);

  if (wordsA.length < MIN_WORDS_REQUIRED || wordsB.length < MIN_WORDS_REQUIRED) {
    return 0;
  }

  const tailA = wordsA.slice(-CONTEXT_WORDS);
  const headB = wordsB.slice(0, CONTEXT_WORDS);

  let score = 0;

  // ── Signal 1: Incomplete sentence at end of A (0–0.35) ────────────────────
  // If page A ends without a sentence-ending punctuation mark, it probably
  // continues on the next page.
  const lastCharA = textA.trimEnd().slice(-1);
  const incompleteSentence = ![".", "?", "!", ":", ";"].includes(lastCharA);
  if (incompleteSentence) score += 0.35;

  // ── Signal 2: Vocabulary overlap between tail of A and head of B (0–0.40) ─
  const setA = new Set(tailA.map((w) => w.toLowerCase()));
  const setB = new Set(headB.map((w) => w.toLowerCase()));

  // Remove stop words before overlap calculation
  const filteredA = [...setA].filter((w) => !STOP_WORDS.has(w) && w.length > 3);
  const filteredB = [...setB].filter((w) => !STOP_WORDS.has(w) && w.length > 3);

  if (filteredA.length > 0 && filteredB.length > 0) {
    const intersection = filteredA.filter((w) => filteredB.includes(w));
    const union = new Set([...filteredA, ...filteredB]);
    const jaccardSimilarity = intersection.length / union.size;
    score += jaccardSimilarity * 0.40;
  }

  // ── Signal 3: Page B does NOT start with a heading/title (0–0.25) ─────────
  // Headings are usually short ALL-CAPS or Title Case lines.
  // If page B starts with a heading, it's likely a new section, not a continuation.
  const firstLineB = textB.trim().split("\n")[0].trim();
  const looksLikeHeading =
    firstLineB.length < 60 &&
    (firstLineB === firstLineB.toUpperCase() || /^[A-Z][^a-z]{5,}/.test(firstLineB));

  if (!looksLikeHeading) score += 0.25;

  return Math.min(1.0, Math.max(0, score));
}

/**
 * Given a continuity matrix, find the best ordering of pages using a
 * greedy nearest-neighbour approach.
 *
 * Starts from the page with the lowest average "is-preceded-by" score
 * (i.e., the one least likely to follow anything = the first page),
 * then repeatedly picks the next page with the highest continuity score.
 *
 * @param {number[][]} matrix   n×n continuity matrix
 * @param {number}     n        number of pages
 * @returns {number[]}          ordered array of 0-based indices
 */
function greedySort(matrix, n) {
  if (n === 0) return [];
  if (n === 1) return [0];

  const visited = new Set();
  const order = [];

  // Find the best starting page: lowest sum of scores in its column
  // (column j = how well OTHER pages flow INTO j → low means "nothing precedes it")
  let bestStart = 0;
  let bestStartScore = Infinity;
  for (let j = 0; j < n; j++) {
    let colSum = 0;
    for (let i = 0; i < n; i++) {
      if (i !== j) colSum += matrix[i][j];
    }
    if (colSum < bestStartScore) {
      bestStartScore = colSum;
      bestStart = j;
    }
  }

  let current = bestStart;
  while (order.length < n) {
    visited.add(current);
    order.push(current);

    // Pick the unvisited page j with the highest matrix[current][j]
    let nextPage = -1;
    let nextScore = -1;
    for (let j = 0; j < n; j++) {
      if (!visited.has(j) && matrix[current][j] > nextScore) {
        nextScore = matrix[current][j];
        nextPage = j;
      }
    }

    if (nextPage === -1) break; // all visited
    current = nextPage;
  }

  // Add any unvisited pages at the end (shouldn't happen but safety net)
  for (let i = 0; i < n; i++) {
    if (!visited.has(i)) order.push(i);
  }

  return order;
}

/**
 * Sort analyses using text continuity as the primary signal.
 *
 * @param {Array} analyses  Array of image analysis objects (with .ocr.text)
 * @returns {{ sortedImages: Array, sortMethod: string, sortMethodDescription: string }}
 */
function sortByTextContinuity(analyses) {
  logger.info("Text continuity: building continuity matrix…");
  const matrix = buildContinuityMatrix(analyses);
  const order = greedySort(matrix, analyses.length);

  const sortedImages = order.map((idx) => analyses[idx]);

  // Calculate average confidence of the sort
  let totalScore = 0;
  let pairs = 0;
  for (let k = 0; k < order.length - 1; k++) {
    totalScore += matrix[order[k]][order[k + 1]];
    pairs++;
  }
  const avgScore = pairs > 0 ? (totalScore / pairs).toFixed(2) : 0;

  logger.info(`Text continuity sort complete. Avg pair score: ${avgScore}`);

  return {
    sortedImages,
    sortMethod: "text_continuity",
    sortMethodDescription: `Sorted by text flow analysis between pages (avg continuity score: ${avgScore}).`,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Split text into word tokens, removing punctuation. */
function tokenize(text) {
  return text
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Common English stop words to ignore during overlap scoring. */
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "can", "this", "that", "these", "those",
  "it", "its", "as", "if", "so", "not", "no", "also", "into", "than",
  "then", "when", "where", "which", "who", "what", "how", "all", "each",
  "more", "their", "they", "them", "we", "you", "he", "she", "his", "her",
  "our", "your", "my", "about", "up", "out", "very", "just", "there",
]);

module.exports = { buildContinuityMatrix, scoreContinuity, sortByTextContinuity };
