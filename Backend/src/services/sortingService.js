/**
 * Sorting Service  –  v4 (AI-first page detection)
 *
 * Sort priority (highest → lowest):
 *
 *  0. Filename sequential numbers       (instant, zero I/O)
 *  1. ★ AI Vision page detection         ← NEW — Gemini reads handwritten numbers
 *  2. Explicit page number  (OCR regex, confidence ≥ 0.45)
 *  3. Cross-image page sequence analysis
 *  4. EXIF / metadata timestamp
 *  5. Text continuity  (NLP flow analysis)
 *  6. Original upload order  (fallback)
 */

"use strict";

const logger = require("../utils/logger");
const { sortByTextContinuity } = require("./textContinuityService");
const { detectPageNumbersAcrossImages } = require("./pageDetectionService");

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_NUMBER_CONFIDENCE_THRESHOLD = 0.45;
const QUORUM_FRACTION                  = 0.30;
const CROSS_IMAGE_MIN_CONFIDENCE       = 0.65;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @param {any[]} analyses
 * @param {{ pageNumbers: (number|null)[], confidence: number } | null} aiResult
 */
function sortImages(analyses, aiResult = null) {
  if (!analyses || analyses.length === 0) {
    return { sortedImages: [], sortMethod: "original_order", sortMethodDescription: "No images to sort." };
  }
  if (analyses.length === 1) {
    return { sortedImages: analyses, sortMethod: "original_order", sortMethodDescription: "Only one image — nothing to sort." };
  }

  // ── Signal 0: Filename sequential numbers ─────────────────────────────────
  const fnResult = _detectFilenameOrder(analyses);
  if (fnResult) {
    logger.info(`Sort method: filename_order`);
    return fnResult;
  }

  // ── Signal 1: ★ AI Vision page detection ──────────────────────────────────
  if (aiResult && aiResult.pageNumbers) {
    const aiSortResult = _sortByAiPageNumbers(analyses, aiResult);
    if (aiSortResult) {
      logger.info(`Sort method: ai_vision_page_number`);
      return aiSortResult;
    }
  }

  // ── Signal 2: Per-image OCR page numbers ──────────────────────────────────
  const withPageNumbers = analyses.filter(
    (img) => img.pageDetection && img.pageDetection.confidence >= PAGE_NUMBER_CONFIDENCE_THRESHOLD
  );

  if (withPageNumbers.length / analyses.length >= QUORUM_FRACTION) {
    logger.info(`Sort method: page_number (${withPageNumbers.length}/${analyses.length})`);
    return _sortByPageNumber(analyses, withPageNumbers);
  }

  // ── Signal 3: Cross-image page sequence analysis ──────────────────────────
  const crossImageResult = _tryCrossImageSort(analyses);
  if (crossImageResult) {
    logger.info(`Sort method: cross_image_page_number`);
    return crossImageResult;
  }

  // ── Signal 4: Timestamps ──────────────────────────────────────────────────
  const withTimestamps = analyses.filter(
    (img) => img.metadata && img.metadata.earliestDate instanceof Date
  );
  const uniqueTimestamps = new Set(withTimestamps.map((img) => img.metadata.earliestDate.getTime()));

  if (withTimestamps.length / analyses.length >= 0.5 && uniqueTimestamps.size > 1) {
    logger.info(`Sort method: timestamp (${withTimestamps.length}/${analyses.length})`);
    return _sortByTimestamp(analyses);
  }

  // ── Signal 5: Text continuity ─────────────────────────────────────────────
  const withText = analyses.filter(
    (img) => img.ocr && img.ocr.text && img.ocr.text.trim().length > 20
  );

  if (withText.length / analyses.length >= 0.5) {
    logger.info(`Sort method: text_continuity (${withText.length}/${analyses.length})`);
    return sortByTextContinuity(analyses);
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  logger.info("Sort method: original_order (no reliable signals found)");
  return {
    sortedImages: [...analyses].sort((a, b) => a.originalIndex - b.originalIndex),
    sortMethod:   "original_order",
    sortMethodDescription: "No reliable signals found. Images are shown in upload order.",
  };
}

// ── Signal 0: Filename order ──────────────────────────────────────────────────

function _detectFilenameOrder(analyses) {
  const numbered = analyses.map((img) => {
    const stem = (img.originalName || "").replace(/\.[^.]+$/, "");
    const nums = stem.match(/\d+/g);
    if (!nums) return null;
    return { img, num: parseInt(nums[nums.length - 1], 10) };
  });

  if (numbered.some((n) => n === null)) return null;

  const sorted    = [...numbered].sort((a, b) => a.num - b.num);
  const nums      = sorted.map((n) => n.num);
  const uniqueSet = new Set(nums);

  if (uniqueSet.size !== nums.length) return null;
  const min = nums[0];
  const max = nums[nums.length - 1];
  if (min > 5) return null;
  if (max - min + 1 !== nums.length) return null;

  return {
    sortedImages:          sorted.map((n) => n.img),
    sortMethod:            "filename_order",
    sortMethodDescription: `Sorted by sequential numbers found in filenames (${min}–${max}).`,
  };
}

// ── Signal 1: AI Vision page numbers ──────────────────────────────────────────

function _sortByAiPageNumbers(analyses, aiResult) {
  const { pageNumbers, confidence } = aiResult;
  const n = analyses.length;

  if (!pageNumbers || pageNumbers.length !== n) return null;

  const validCount = pageNumbers.filter((p) => p !== null).length;
  if (validCount < n * 0.4) return null; // need at least 40% coverage

  const withPages    = [];
  const withoutPages = [];

  for (let i = 0; i < n; i++) {
    if (pageNumbers[i] !== null) {
      withPages.push({ img: analyses[i], pageNumber: pageNumbers[i] });
    } else {
      withoutPages.push(analyses[i]);
    }
  }

  // Handle duplicates: keep the one with lower originalIndex (first uploaded)
  const pageMap = new Map();
  const extras  = [];
  for (const entry of withPages) {
    const existing = pageMap.get(entry.pageNumber);
    if (!existing) {
      pageMap.set(entry.pageNumber, entry);
    } else {
      // Keep lower originalIndex
      if (entry.img.originalIndex < existing.img.originalIndex) {
        extras.push(existing.img);
        pageMap.set(entry.pageNumber, entry);
      } else {
        extras.push(entry.img);
      }
    }
  }

  const sorted = [...pageMap.values()].sort((a, b) => a.pageNumber - b.pageNumber);
  const remainder = [...withoutPages, ...extras].sort((a, b) => a.originalIndex - b.originalIndex);

  const pagesDetected = sorted.map((e) => e.pageNumber).join(", ");

  return {
    sortedImages: [...sorted.map((e) => e.img), ...remainder],
    sortMethod:   "ai_vision_page_number",
    sortMethodDescription:
      `Sorted by AI vision page detection using ${aiResult.model || "Gemini"} ` +
      `(${pageMap.size} pages detected: ${pagesDetected}, confidence: ${confidence.toFixed(2)}).` +
      (remainder.length > 0 ? ` ${remainder.length} image(s) appended at the end.` : ""),
  };
}

// ── Signal 2: Per-image OCR page-number sort ──────────────────────────────────

function _sortByPageNumber(analyses, withPageNumbers) {
  const withoutPageNumbers = analyses.filter(
    (img) => !img.pageDetection || img.pageDetection.confidence < PAGE_NUMBER_CONFIDENCE_THRESHOLD
  );

  const pageMap = new Map();
  for (const img of withPageNumbers) {
    const pn = img.pageDetection.pageNumber;
    const existing = pageMap.get(pn);
    if (!existing || img.pageDetection.confidence > existing.pageDetection.confidence) {
      if (existing) withoutPageNumbers.push(existing);
      pageMap.set(pn, img);
    } else {
      withoutPageNumbers.push(img);
    }
  }

  const sorted = [...pageMap.values()].sort((a, b) =>
    a.pageDetection.pageNumber - b.pageDetection.pageNumber
  );

  const remainder = [...withoutPageNumbers].sort((a, b) => {
    const tDiff = _timestampOf(a) - _timestampOf(b);
    return tDiff !== 0 ? tDiff : a.originalIndex - b.originalIndex;
  });

  const pagesDetected = [...pageMap.keys()].sort((a, b) => a - b).join(", ");

  return {
    sortedImages: [...sorted, ...remainder],
    sortMethod:   "page_number",
    sortMethodDescription:
      `Sorted by detected page numbers (${pageMap.size} found: ${pagesDetected}).` +
      (remainder.length > 0 ? ` ${remainder.length} image(s) appended at the end.` : ""),
  };
}

// ── Signal 3: Cross-image sequence ────────────────────────────────────────────

function _tryCrossImageSort(analyses) {
  const ocrResults         = analyses.map((img) => img.ocr || { text: "", confidence: 0 });
  const perImageDetections = analyses.map((img) => img.pageDetection || null);

  const mergedOcr = analyses.map((img) => {
    const main   = img.ocr?.text || "";
    const region = img.regionOcr?.text || "";
    return { text: region ? `${main}\n${region}` : main, confidence: img.ocr?.confidence || 0 };
  });

  const result = detectPageNumbersAcrossImages(mergedOcr, perImageDetections);
  if (!result || result.confidence < CROSS_IMAGE_MIN_CONFIDENCE) return null;

  const { pageNumbers, confidence, coverage } = result;
  const withPages    = [];
  const withoutPages = [];

  for (let i = 0; i < analyses.length; i++) {
    if (pageNumbers[i] !== null) {
      withPages.push({ img: analyses[i], pageNumber: pageNumbers[i] });
    } else {
      withoutPages.push(analyses[i]);
    }
  }

  withPages.sort((a, b) => a.pageNumber - b.pageNumber);
  withoutPages.sort((a, b) => a.originalIndex - b.originalIndex);

  return {
    sortedImages: [...withPages.map((p) => p.img), ...withoutPages],
    sortMethod:   "cross_image_page_number",
    sortMethodDescription:
      `Sorted by cross-image sequence analysis (${(coverage * 100).toFixed(0)}% coverage, confidence ${confidence.toFixed(2)}).` +
      (withoutPages.length > 0 ? ` ${withoutPages.length} image(s) appended at the end.` : ""),
  };
}

// ── Signal 4: Timestamp sort ──────────────────────────────────────────────────

function _sortByTimestamp(analyses) {
  const withTs = analyses
    .filter((img) => img.metadata && img.metadata.earliestDate instanceof Date)
    .sort((a, b) => {
      const diff = a.metadata.earliestDate.getTime() - b.metadata.earliestDate.getTime();
      return diff !== 0 ? diff : a.originalIndex - b.originalIndex;
    });

  const withoutTs = analyses
    .filter((img) => !img.metadata || !(img.metadata.earliestDate instanceof Date))
    .sort((a, b) => a.originalIndex - b.originalIndex);

  return {
    sortedImages: [...withTs, ...withoutTs],
    sortMethod:   "timestamp",
    sortMethodDescription:
      `Sorted by image timestamp (${withTs.length} with EXIF timestamps).` +
      (withoutTs.length > 0 ? ` ${withoutTs.length} appended.` : ""),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _timestampOf(img) {
  return img.metadata && img.metadata.earliestDate instanceof Date
    ? img.metadata.earliestDate.getTime() : Infinity;
}

module.exports = { sortImages };
