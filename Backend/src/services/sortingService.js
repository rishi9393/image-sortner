/**
 * Sorting Service
 * Combines all available signals to produce a best-guess page order.
 *
 * Priority:
 *  1. Explicit page number (detectPageNumber confidence >= 0.7)  → HIGH
 *  2. EXIF / metadata timestamp                                  → MEDIUM
 *  3. Text continuity (NLP flow analysis)                        → MEDIUM-LOW
 *  4. Original upload order                                      → FALLBACK
 */

const logger = require("../utils/logger");
const { sortByTextContinuity } = require("./textContinuityService");

/**
 * @typedef {Object} ImageAnalysis
 * @property {string}  originalName
 * @property {string}  storedFilename
 * @property {string}  filePath
 * @property {string}  url
 * @property {number}  size
 * @property {Object}  metadata          - result from metadataService
 * @property {Object}  ocr               - { text, confidence }
 * @property {Object|null} pageDetection - result from pageDetectionService
 * @property {number}  originalIndex     - 0-based position in the upload batch
 */

/**
 * @typedef {Object} SortResult
 * @property {ImageAnalysis[]} sortedImages
 * @property {'page_number'|'timestamp'|'original_order'} sortMethod
 * @property {string} sortMethodDescription
 */

// Minimum page-detection confidence to treat a number as reliable
const PAGE_NUMBER_CONFIDENCE_THRESHOLD = 0.7;

// Minimum fraction of images that must have a signal for that signal to "win"
const QUORUM_FRACTION = 0.5;

/**
 * Sort an array of analysed images into the most likely correct page order.
 *
 * @param {ImageAnalysis[]} analyses
 * @returns {SortResult}
 */
function sortImages(analyses) {
  if (!analyses || analyses.length === 0) {
    return {
      sortedImages: [],
      sortMethod: "original_order",
      sortMethodDescription: "No images to sort.",
    };
  }

  if (analyses.length === 1) {
    return {
      sortedImages: analyses,
      sortMethod: "original_order",
      sortMethodDescription: "Only one image — nothing to sort.",
    };
  }

  // ── Signal 1: Page numbers ────────────────────────────────────────────────
  const withPageNumbers = analyses.filter(
    (img) =>
      img.pageDetection &&
      img.pageDetection.confidence >= PAGE_NUMBER_CONFIDENCE_THRESHOLD
  );

  if (withPageNumbers.length / analyses.length >= QUORUM_FRACTION) {
    logger.info(
      `Sort method: page_number (${withPageNumbers.length}/${analyses.length} images have page numbers)`
    );
    return sortByPageNumber(analyses, withPageNumbers);
  }

  // ── Signal 2: Timestamps ──────────────────────────────────────────────────
  const withTimestamps = analyses.filter(
    (img) => img.metadata && img.metadata.earliestDate instanceof Date
  );

  // Only use timestamps if they are not all identical
  const uniqueTimestamps = new Set(
    withTimestamps.map((img) => img.metadata.earliestDate.getTime())
  );

  if (
    withTimestamps.length / analyses.length >= QUORUM_FRACTION &&
    uniqueTimestamps.size > 1
  ) {
    logger.info(
      `Sort method: timestamp (${withTimestamps.length}/${analyses.length} images have timestamps)`
    );
    return sortByTimestamp(analyses);
  }

  // ── Signal 3: Text continuity ─────────────────────────────────────────────
  // Only attempt if images actually have OCR text to work with
  const withText = analyses.filter(
    (img) => img.ocr && img.ocr.text && img.ocr.text.trim().length > 20
  );

  if (withText.length / analyses.length >= QUORUM_FRACTION) {
    logger.info(
      `Sort method: text_continuity (${withText.length}/${analyses.length} images have usable text)`
    );
    return sortByTextContinuity(analyses);
  }

  // ── Fallback: original upload order ──────────────────────────────────────
  logger.info("Sort method: original_order (no reliable signals found)");
  return {
    sortedImages: [...analyses].sort((a, b) => a.originalIndex - b.originalIndex),
    sortMethod: "original_order",
    sortMethodDescription:
      "No reliable page numbers, timestamps, or text content were found. Images are shown in upload order.",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Sort primarily by detected page number.
 * Images that don't have a recognised page number are appended at the end,
 * ordered by timestamp (if available) or original upload order.
 */
function sortByPageNumber(analyses, withPageNumbers) {
  const withoutPageNumbers = analyses.filter(
    (img) =>
      !img.pageDetection ||
      img.pageDetection.confidence < PAGE_NUMBER_CONFIDENCE_THRESHOLD
  );

  // Sort images that have page numbers
  const sorted = [...withPageNumbers].sort((a, b) => {
    const diff = a.pageDetection.pageNumber - b.pageDetection.pageNumber;
    if (diff !== 0) return diff;
    // tie-break: timestamp
    return timestampOf(a) - timestampOf(b);
  });

  // Sort the remainder by timestamp / original order and append
  const remainder = [...withoutPageNumbers].sort((a, b) => {
    const tDiff = timestampOf(a) - timestampOf(b);
    if (tDiff !== 0) return tDiff;
    return a.originalIndex - b.originalIndex;
  });

  const sortedImages = [...sorted, ...remainder];

  const pagesDetected = withPageNumbers
    .map((img) => img.pageDetection.pageNumber)
    .sort((a, b) => a - b)
    .join(", ");

  return {
    sortedImages,
    sortMethod: "page_number",
    sortMethodDescription: `Sorted by detected page numbers (${withPageNumbers.length} found: ${pagesDetected}).${
      withoutPageNumbers.length > 0
        ? ` ${withoutPageNumbers.length} image(s) without a page number were appended at the end.`
        : ""
    }`,
  };
}

/**
 * Sort all images by their EXIF/metadata timestamp.
 * Images without timestamps retain their relative upload order and are
 * placed after the timestamped ones.
 */
function sortByTimestamp(analyses) {
  const withTs = analyses
    .filter((img) => img.metadata && img.metadata.earliestDate instanceof Date)
    .sort((a, b) => {
      const diff =
        a.metadata.earliestDate.getTime() - b.metadata.earliestDate.getTime();
      return diff !== 0 ? diff : a.originalIndex - b.originalIndex;
    });

  const withoutTs = analyses
    .filter((img) => !img.metadata || !(img.metadata.earliestDate instanceof Date))
    .sort((a, b) => a.originalIndex - b.originalIndex);

  return {
    sortedImages: [...withTs, ...withoutTs],
    sortMethod: "timestamp",
    sortMethodDescription: `Sorted by image capture timestamp (${withTs.length} images had EXIF timestamps).${
      withoutTs.length > 0
        ? ` ${withoutTs.length} image(s) without timestamps were appended at the end.`
        : ""
    }`,
  };
}

/**
 * Return a comparable timestamp value for an image (or Infinity if none).
 */
function timestampOf(img) {
  return img.metadata && img.metadata.earliestDate instanceof Date
    ? img.metadata.earliestDate.getTime()
    : Infinity;
}

module.exports = { sortImages };
