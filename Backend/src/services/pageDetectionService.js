/**
 * Page Detection Service
 * Analyses OCR'd text to find explicit page number indicators such as
 * "Page 3", "Pg 2 of 10", "3/10", "-4-", roman numerals, etc.
 */

/**
 * @typedef {Object} PageDetectionResult
 * @property {number}  pageNumber   - The detected (1-based) page number
 * @property {number}  confidence   - 0.0 – 1.0
 * @property {string}  matchedText  - The exact substring that triggered the match
 * @property {string}  pattern      - Friendly name of the pattern that matched
 */

/**
 * Ordered list of patterns from highest → lowest confidence.
 * Each entry: { name, regex, group, confidence }
 *   - regex  : pattern to test
 *   - group  : capture group index that contains the page number digit(s)
 *   - confidence : float 0–1
 */
const PATTERNS = [
  // "Page 3"  /  "Page 3 of 10"  /  "Page 3/10"
  {
    name: "page_keyword",
    regex: /\bpage\s+(\d+)(?:\s+(?:of|\/)\s*\d+)?\b/i,
    group: 1,
    confidence: 0.95,
  },
  // "Pg 2"  /  "Pg. 2"  /  "Pg 2 of 5"
  {
    name: "pg_keyword",
    regex: /\bpg\.?\s*(\d+)(?:\s+(?:of|\/)\s*\d+)?\b/i,
    group: 1,
    confidence: 0.92,
  },
  // "P. 4"  (but NOT "P" on its own — require the dot)
  {
    name: "p_dot_keyword",
    regex: /\bP\.\s*(\d+)\b/,
    group: 1,
    confidence: 0.88,
  },
  // "-3-"  or  "– 3 –"  (page number surrounded by dashes)
  {
    name: "dashes",
    regex: /[-–—]\s*(\d+)\s*[-–—]/,
    group: 1,
    confidence: 0.85,
  },
  // "3 / 10"  or  "3/10"  on its OWN line (fraction-style)
  {
    name: "fraction_line",
    regex: /^(\d+)\s*\/\s*\d+$/,
    group: 1,
    confidence: 0.85,
  },
  // "(4)"  –  number in parentheses alone on a line
  {
    name: "parens_line",
    regex: /^\(\s*(\d+)\s*\)$/,
    group: 1,
    confidence: 0.75,
  },
  // Lone integer on its own line (page footer/header)
  {
    name: "standalone_number",
    regex: /^(\d+)$/,
    group: 1,
    confidence: 0.55,
  },
];

/** Maximum page number we'll consider plausible (guards against OCR gibberish). */
const MAX_PLAUSIBLE_PAGE = 999;

/**
 * Detect the most likely page number from OCR'd text.
 *
 * Strategy:
 *  1. Try each pattern on every line of text.
 *  2. Return the first (highest-confidence) match found.
 *  3. If multiple patterns match the same number, boost confidence slightly.
 *
 * @param {string} text  Full OCR text from one image
 * @returns {PageDetectionResult|null}
 */
function detectPageNumber(text) {
  if (!text || text.trim().length === 0) return null;

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const candidates = [];

  for (const { name, regex, group, confidence } of PATTERNS) {
    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        const num = parseInt(match[group], 10);
        if (Number.isFinite(num) && num > 0 && num <= MAX_PLAUSIBLE_PAGE) {
          candidates.push({
            pageNumber: num,
            confidence,
            matchedText: match[0].trim(),
            pattern: name,
          });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Sort by confidence desc, then by page number asc (lower numbers more typical)
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.pageNumber - b.pageNumber;
  });

  // If the top-2 candidates agree on the same number, boost confidence
  const best = { ...candidates[0] };
  if (candidates.length >= 2 && candidates[1].pageNumber === best.pageNumber) {
    best.confidence = Math.min(1.0, best.confidence + 0.03);
  }

  return best;
}

module.exports = { detectPageNumber };
