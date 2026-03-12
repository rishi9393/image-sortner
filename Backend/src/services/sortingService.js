/**
 * Sorting Service  –  v2
 *
 * Sort priority (highest → lowest):
 *
 *  0. Filename sequential numbers  NEW  → instant, zero I/O
 *  1. Explicit page number  (OCR, confidence ≥ 0.7)
 *  2. EXIF / metadata timestamp
 *  3. Text continuity  (NLP flow analysis)
 *  4. Original upload order  (fallback)
 */

"use strict";

const logger = require("../utils/logger");
const { sortByTextContinuity } = require("./textContinuityService");

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_NUMBER_CONFIDENCE_THRESHOLD = 0.7;
const QUORUM_FRACTION                  = 0.5;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Sort an array of analysed images into the most likely correct page order.
 *
 * @param {import('./ocrService').ImageAnalysis[]} analyses
 * @returns {{ sortedImages: any[], sortMethod: string, sortMethodDescription: string }}
 */
function sortImages(analyses) {
  if (!analyses || analyses.length === 0) {
    return {
      sortedImages:           [],
      sortMethod:             "original_order",
      sortMethodDescription:  "No images to sort.",
    };
  }

  if (analyses.length === 1) {
    return {
      sortedImages:           analyses,
      sortMethod:             "original_order",
      sortMethodDescription:  "Only one image — nothing to sort.",
    };
  }

  // ── Signal 0: Filename sequential numbers ─────────────────────────────────
  // Check this first — it requires zero I/O and is highly reliable when present.
  const fnResult = _detectFilenameOrder(analyses);
  if (fnResult) {
    logger.info(`Sort method: filename_order`);
    return fnResult;
  }

  // ── Signal 1: Page numbers ────────────────────────────────────────────────
  const withPageNumbers = analyses.filter(
    (img) =>
      img.pageDetection &&
      img.pageDetection.confidence >= PAGE_NUMBER_CONFIDENCE_THRESHOLD
  );

  if (withPageNumbers.length / analyses.length >= QUORUM_FRACTION) {
    logger.info(
      `Sort method: page_number (${withPageNumbers.length}/${analyses.length} images)`
    );
    return _sortByPageNumber(analyses, withPageNumbers);
  }

  // ── Signal 2: Timestamps ──────────────────────────────────────────────────
  const withTimestamps = analyses.filter(
    (img) => img.metadata && img.metadata.earliestDate instanceof Date
  );
  const uniqueTimestamps = new Set(
    withTimestamps.map((img) => img.metadata.earliestDate.getTime())
  );

  if (
    withTimestamps.length / analyses.length >= QUORUM_FRACTION &&
    uniqueTimestamps.size > 1
  ) {
    logger.info(
      `Sort method: timestamp (${withTimestamps.length}/${analyses.length} images)`
    );
    return _sortByTimestamp(analyses);
  }

  // ── Signal 3: Text continuity ─────────────────────────────────────────────
  const withText = analyses.filter(
    (img) => img.ocr && img.ocr.text && img.ocr.text.trim().length > 20
  );

  if (withText.length / analyses.length >= QUORUM_FRACTION) {
    logger.info(
      `Sort method: text_continuity (${withText.length}/${analyses.length} images)`
    );
    return sortByTextContinuity(analyses);
  }

  // ── Fallback: original upload order ──────────────────────────────────────
  logger.info("Sort method: original_order (no reliable signals found)");
  return {
    sortedImages: [...analyses].sort((a, b) => a.originalIndex - b.originalIndex),
    sortMethod:   "original_order",
    sortMethodDescription:
      "No reliable page numbers, timestamps, or text content were found. Images are shown in upload order.",
  };
}

// ── Signal 0: Filename order ──────────────────────────────────────────────────

/**
 * Detect whether filenames encode a reliable sequential page order.
 *
 * Rules
 * ─────
 *  • Every filename must contain at least one number.
 *  • The last number found in each filename stem is used as the page index.
 *  • Those numbers must form a gapless ascending sequence starting from 0 or 1
 *    (e.g. 1,2,3,4 or 001,002,003 — NOT 1,3,5 or 10,20,30).
 *  • All numbers must be unique (no duplicates).
 *  • Sequence must start at ≤ 5 to guard against e.g. year numbers in filenames.
 *
 * Examples that match:
 *   page1.jpg, page2.jpg, page3.jpg
 *   img_001.png, img_003.png, img_002.png  →  sorted 001,002,003
 *   scan-3.jpg, scan-1.jpg, scan-2.jpg     →  sorted 1,2,3
 *
 * @param {any[]} analyses
 * @returns {{ sortedImages: any[], sortMethod: string, sortMethodDescription: string } | null}
 */
function _detectFilenameOrder(analyses) {
  const numbered = analyses.map((img) => {
    // Strip extension, then find ALL digit groups in the stem
    const stem = (img.originalName || "").replace(/\.[^.]+$/, "");
    const nums  = stem.match(/\d+/g);
    if (!nums) return null;
    // Use the LAST number in the name (most likely to be the page index)
    return { img, num: parseInt(nums[nums.length - 1], 10) };
  });

  // Every file must have a number
  if (numbered.some((n) => n === null)) return null;

  const sorted    = [...numbered].sort((a, b) => a.num - b.num);
  const nums      = sorted.map((n) => n.num);
  const uniqueSet = new Set(nums);

  // Reject duplicates
  if (uniqueSet.size !== nums.length) return null;

  const min = nums[0];
  const max = nums[nums.length - 1];

  // Reject sequences that start far from 0/1 (e.g. years like 2024)
  if (min > 5) return null;

  // Reject sequences with gaps (1,2,4,5 — gap at 3)
  if (max - min + 1 !== nums.length) return null;

  return {
    sortedImages:          sorted.map((n) => n.img),
    sortMethod:            "filename_order",
    sortMethodDescription: `Sorted by sequential numbers found in filenames (${min}–${max}).`,
  };
}

// ── Signal 1: Page-number sort ────────────────────────────────────────────────

function _sortByPageNumber(analyses, withPageNumbers) {
  const withoutPageNumbers = analyses.filter(
    (img) =>
      !img.pageDetection ||
      img.pageDetection.confidence < PAGE_NUMBER_CONFIDENCE_THRESHOLD
  );

  const sorted = [...withPageNumbers].sort((a, b) => {
    const diff = a.pageDetection.pageNumber - b.pageDetection.pageNumber;
    return diff !== 0 ? diff : _timestampOf(a) - _timestampOf(b);
  });

  const remainder = [...withoutPageNumbers].sort((a, b) => {
    const tDiff = _timestampOf(a) - _timestampOf(b);
    return tDiff !== 0 ? tDiff : a.originalIndex - b.originalIndex;
  });

  const pagesDetected = withPageNumbers
    .map((img) => img.pageDetection.pageNumber)
    .sort((a, b) => a - b)
    .join(", ");

  return {
    sortedImages: [...sorted, ...remainder],
    sortMethod:   "page_number",
    sortMethodDescription:
      `Sorted by detected page numbers (${withPageNumbers.length} found: ${pagesDetected}).` +
      (withoutPageNumbers.length > 0
        ? ` ${withoutPageNumbers.length} image(s) without a page number were appended at the end.`
        : ""),
  };
}

// ── Signal 2: Timestamp sort ──────────────────────────────────────────────────

function _sortByTimestamp(analyses) {
  const withTs = analyses
    .filter((img) => img.metadata && img.metadata.earliestDate instanceof Date)
    .sort((a, b) => {
      const diff =
        a.metadata.earliestDate.getTime() - b.metadata.earliestDate.getTime();
      return diff !== 0 ? diff : a.originalIndex - b.originalIndex;
    });

  const withoutTs = analyses
    .filter(
      (img) => !img.metadata || !(img.metadata.earliestDate instanceof Date)
    )
    .sort((a, b) => a.originalIndex - b.originalIndex);

  return {
    sortedImages: [...withTs, ...withoutTs],
    sortMethod:   "timestamp",
    sortMethodDescription:
      `Sorted by image capture timestamp (${withTs.length} images had EXIF timestamps).` +
      (withoutTs.length > 0
        ? ` ${withoutTs.length} image(s) without timestamps were appended at the end.`
        : ""),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _timestampOf(img) {
  return img.metadata && img.metadata.earliestDate instanceof Date
    ? img.metadata.earliestDate.getTime()
    : Infinity;
}

module.exports = { sortImages };
