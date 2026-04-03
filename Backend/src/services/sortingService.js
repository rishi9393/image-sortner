/**
 * Sorting Service  –  v7 (Document AI Layout Parser + Strict Page Number Sorting)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SORTING RULES (STRICT):
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  1. Sort pages STRICTLY by detected page numbers in ASCENDING order
 *  2. Do NOT attempt to fill missing page numbers
 *     Example: If pages are 1,2,3,8,9 → keep this order as-is
 *  3. Missing pages (like 4,5,6,7) should be IGNORED, not inferred
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * FALLBACK HANDLING:
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  4. ONLY if a page has NO detectable page number:
 *     - Use content-based analysis (headings, paragraph flow) to place it approximately
 *     - Insert it logically between numbered pages
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRIORITY ORDER:
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  1. Page number (highest priority)
 *  2. Content-based ordering (only if page number missing)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * OUTPUT:
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  - Return sorted pages
 *  - Include detected page number (or null if missing)
 *  - Maintain stable and logical ordering
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * FALLBACK METHODS (when Document AI unavailable):
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  0a. Filename sequential numbers (instant, zero I/O)
 *  0b. Messaging app filename patterns (WhatsApp, Telegram)
 *  1.  EXIF / metadata timestamps
 *  2.  Text continuity (NLP flow analysis)
 *  3.  Original upload order
 */

"use strict";

const logger = require("../utils/logger");
const {
  sortByTextContinuity,
  scoreContinuity,
} = require("./textContinuityService");
const { detectPageNumbersAcrossImages } = require("./pageDetectionService");
const { detectMessagingAppOrder } = require("./messagingFilenameService");
const documentAIService = require("./documentAIService");

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_NUMBER_CONFIDENCE_THRESHOLD = 0.45;
const QUORUM_FRACTION = 0.3;
const CROSS_IMAGE_MIN_CONFIDENCE = 0.65;

// ══════════════════════════════════════════════════════════════════════════════
// Main Sorting API
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Sort images using the priority-based approach.
 *
 * When Document AI / Gemini is available, uses page number detection as primary signal.
 * Falls back to filename, timestamp, or upload order when needed.
 *
 * @param {any[]} analyses - Array of image analysis objects
 * @param {Object|null} aiResult - AI detection result (legacy format for compatibility)
 * @returns {{ sortedImages: any[], sortMethod: string, sortMethodDescription: string }}
 */
function sortImages(analyses, aiResult = null) {
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

  // ══════════════════════════════════════════════════════════════════════════
  // PRIORITY 1: Page Numbers (AI or OCR detected)
  // ══════════════════════════════════════════════════════════════════════════

  // Try AI-detected page numbers first (Document AI or Gemini)
  if (aiResult && aiResult.pageNumbers) {
    const aiSortResult = _sortByAiPageNumbers(analyses, aiResult);
    if (aiSortResult) {
      logger.info(`Sort method: ai_page_number (strict ascending order)`);
      return aiSortResult;
    }
  }

  // Try per-image OCR page numbers
  const withPageNumbers = analyses.filter(
    (img) =>
      img.pageDetection &&
      img.pageDetection.confidence >= PAGE_NUMBER_CONFIDENCE_THRESHOLD,
  );

  if (withPageNumbers.length / analyses.length >= QUORUM_FRACTION) {
    logger.info(
      `Sort method: page_number (${withPageNumbers.length}/${analyses.length})`,
    );
    return _sortByPageNumber(analyses, withPageNumbers);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FALLBACK METHODS (when no page numbers detected)
  // ══════════════════════════════════════════════════════════════════════════

  // Fallback 0a: Filename sequential numbers
  const fnResult = _detectFilenameOrder(analyses);
  if (fnResult) {
    logger.info(`Sort method: filename_order`);
    return fnResult;
  }

  // Fallback 0b: Messaging app filename patterns
  const msgResult = detectMessagingAppOrder(analyses);
  if (msgResult) {
    logger.info(`Sort method: messaging_app_filename`);
    return msgResult;
  }

  // Fallback 1: Cross-image page sequence analysis
  const crossImageResult = _tryCrossImageSort(analyses);
  if (crossImageResult) {
    logger.info(`Sort method: cross_image_page_number`);
    return crossImageResult;
  }

  // Fallback 2: Timestamps
  const withTimestamps = analyses.filter(
    (img) => img.metadata && img.metadata.earliestDate instanceof Date,
  );
  const uniqueTimestamps = new Set(
    withTimestamps.map((img) => img.metadata.earliestDate.getTime()),
  );

  if (
    withTimestamps.length / analyses.length >= 0.5 &&
    uniqueTimestamps.size > 1
  ) {
    logger.info(
      `Sort method: timestamp (${withTimestamps.length}/${analyses.length})`,
    );
    return _sortByTimestamp(analyses);
  }

  // Fallback 3: Text continuity
  const withText = analyses.filter(
    (img) => img.ocr && img.ocr.text && img.ocr.text.trim().length > 20,
  );

  if (withText.length / analyses.length >= 0.5) {
    logger.info(
      `Sort method: text_continuity (${withText.length}/${analyses.length})`,
    );
    return sortByTextContinuity(analyses);
  }

  // Final fallback: Original upload order
  logger.info("Sort method: original_order (no reliable signals found)");
  return {
    sortedImages: [...analyses].sort(
      (a, b) => a.originalIndex - b.originalIndex,
    ),
    sortMethod: "original_order",
    sortMethodDescription:
      "No reliable signals found. Images are shown in upload order.",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// AI Page Number Sorting (Document AI / Gemini)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Sort by AI-detected page numbers with STRICT rules:
 *  - Sort by page numbers in ascending order
 *  - Do NOT fill missing page numbers (e.g., 1,2,3,8,9 stays as-is)
 *  - Insert pages without numbers at logical positions
 *
 * @param {any[]} analyses
 * @param {Object} aiResult
 * @returns {Object|null}
 */
function _sortByAiPageNumbers(analyses, aiResult) {
  const { pageNumbers, confidence, perImageConfidence, verified } = aiResult;
  const n = analyses.length;

  if (!pageNumbers || pageNumbers.length !== n) return null;

  const validCount = pageNumbers.filter((p) => p !== null).length;
  if (validCount < n * 0.3) return null; // Need at least 30% coverage

  // Separate pages with and without detected numbers
  const withPages = [];
  const withoutPages = [];

  for (let i = 0; i < n; i++) {
    const img = analyses[i];
    const pageNum = pageNumbers[i];

    // Attach detected page number to the image
    const enrichedImg = {
      ...img,
      detectedPageNumber: pageNum,
      pageNumberConfidence: perImageConfidence ? perImageConfidence[i] : "medium",
    };

    if (pageNum !== null) {
      withPages.push({
        img: enrichedImg,
        pageNumber: pageNum,
        confidence: perImageConfidence ? perImageConfidence[i] : "medium",
      });
    } else {
      withoutPages.push(enrichedImg);
    }
  }

  // Handle duplicates: keep the one with higher confidence, then lower originalIndex
  const pageMap = new Map();
  const extras = [];
  const confRank = { high: 3, medium: 2, low: 1 };

  for (const entry of withPages) {
    const existing = pageMap.get(entry.pageNumber);
    if (!existing) {
      pageMap.set(entry.pageNumber, entry);
    } else {
      const existRank = confRank[existing.confidence] || 1;
      const newRank = confRank[entry.confidence] || 1;

      if (
        newRank > existRank ||
        (newRank === existRank && entry.img.originalIndex < existing.img.originalIndex)
      ) {
        extras.push(existing.img);
        pageMap.set(entry.pageNumber, entry);
      } else {
        extras.push(entry.img);
      }
    }
  }

  // STRICT SORTING: Sort by page number in ascending order
  // DO NOT fill gaps or infer missing pages
  const sorted = [...pageMap.values()].sort(
    (a, b) => a.pageNumber - b.pageNumber
  );

  // Build the page numbers list for description
  const pagesDetected = sorted.map((e) => e.pageNumber).join(", ");

  // Combine pages without numbers with extras
  const remainder = [...withoutPages, ...extras].sort(
    (a, b) => a.originalIndex - b.originalIndex
  );

  // Insert pages without numbers at logical positions
  const sortedImgs = sorted.map((e) => e.img);
  const sortedPageNums = sorted.map((e) => e.pageNumber);

  const merged = _insertRemainderLogically(sortedImgs, remainder, sortedPageNums);

  const verifiedStr = verified ? " ✓ verified" : "";

  return {
    sortedImages: merged,
    sortMethod: "ai_page_number",
    sortMethodDescription:
      `Sorted by detected page numbers (${pageMap.size} found: ${pagesDetected})${verifiedStr}. ` +
      `Strict ascending order — missing pages NOT inferred.` +
      (remainder.length > 0
        ? ` ${remainder.length} page(s) without numbers placed by content analysis.`
        : ""),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// OCR Page Number Sorting
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Sort by OCR-detected page numbers with STRICT rules
 */
function _sortByPageNumber(analyses, withPageNumbers) {
  const withoutPageNumbers = analyses.filter(
    (img) =>
      !img.pageDetection ||
      img.pageDetection.confidence < PAGE_NUMBER_CONFIDENCE_THRESHOLD,
  );

  // Handle duplicates: keep the one with higher confidence
  const pageMap = new Map();
  const extras = [];

  for (const img of withPageNumbers) {
    const pn = img.pageDetection.pageNumber;
    const existing = pageMap.get(pn);

    if (!existing) {
      pageMap.set(pn, img);
    } else if (img.pageDetection.confidence > existing.pageDetection.confidence) {
      extras.push(existing);
      pageMap.set(pn, img);
    } else {
      extras.push(img);
    }
  }

  // STRICT SORTING: Sort by page number in ascending order
  const sorted = [...pageMap.values()].sort(
    (a, b) => a.pageDetection.pageNumber - b.pageDetection.pageNumber
  );

  // Enrich sorted images with detectedPageNumber field
  const enrichedSorted = sorted.map((img) => ({
    ...img,
    detectedPageNumber: img.pageDetection.pageNumber,
  }));

  // Combine remainder
  const remainder = [...withoutPageNumbers, ...extras].sort((a, b) => {
    const tDiff = _timestampOf(a) - _timestampOf(b);
    return tDiff !== 0 ? tDiff : a.originalIndex - b.originalIndex;
  });

  // Enrich remainder with null page numbers
  const enrichedRemainder = remainder.map((img) => ({
    ...img,
    detectedPageNumber: null,
  }));

  const pagesDetected = [...pageMap.keys()].sort((a, b) => a - b).join(", ");
  const sortedPageNums = sorted.map((img) => img.pageDetection.pageNumber);

  // Insert pages without numbers at logical positions
  const merged = _insertRemainderLogically(
    enrichedSorted,
    enrichedRemainder,
    sortedPageNums
  );

  return {
    sortedImages: merged,
    sortMethod: "page_number",
    sortMethodDescription:
      `Sorted by detected page numbers (${pageMap.size} found: ${pagesDetected}). ` +
      `Strict ascending order — missing pages NOT inferred.` +
      (enrichedRemainder.length > 0
        ? ` ${enrichedRemainder.length} page(s) without numbers placed by content analysis.`
        : ""),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Filename Order Detection
// ══════════════════════════════════════════════════════════════════════════════

function _detectFilenameOrder(analyses) {
  const numbered = analyses.map((img) => {
    const stem = (img.originalName || "").replace(/\.[^.]+$/, "");
    const nums = stem.match(/\d+/g);
    if (!nums) return null;
    return { img, num: parseInt(nums[nums.length - 1], 10) };
  });

  if (numbered.some((n) => n === null)) return null;

  const sorted = [...numbered].sort((a, b) => a.num - b.num);
  const nums = sorted.map((n) => n.num);
  const uniqueSet = new Set(nums);

  if (uniqueSet.size !== nums.length) return null;
  const min = nums[0];
  const max = nums[nums.length - 1];
  if (min > 5) return null;
  if (max - min + 1 !== nums.length) return null;

  // Enrich with detected page numbers from filename
  const enrichedSorted = sorted.map((n) => ({
    ...n.img,
    detectedPageNumber: n.num,
  }));

  return {
    sortedImages: enrichedSorted,
    sortMethod: "filename_order",
    sortMethodDescription: `Sorted by sequential numbers in filenames (${min}–${max}).`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Cross-Image Sequence Analysis
// ══════════════════════════════════════════════════════════════════════════════

function _tryCrossImageSort(analyses) {
  const ocrResults = analyses.map(
    (img) => img.ocr || { text: "", confidence: 0 },
  );
  const perImageDetections = analyses.map((img) => img.pageDetection || null);

  const mergedOcr = analyses.map((img) => {
    const main = img.ocr?.text || "";
    const region = img.regionOcr?.text || "";
    return {
      text: region ? `${main}\n${region}` : main,
      confidence: img.ocr?.confidence || 0,
    };
  });

  const result = detectPageNumbersAcrossImages(mergedOcr, perImageDetections);
  if (!result || result.confidence < CROSS_IMAGE_MIN_CONFIDENCE) return null;

  const { pageNumbers, confidence, coverage } = result;
  const withPages = [];
  const withoutPages = [];

  for (let i = 0; i < analyses.length; i++) {
    if (pageNumbers[i] !== null) {
      withPages.push({
        img: { ...analyses[i], detectedPageNumber: pageNumbers[i] },
        pageNumber: pageNumbers[i],
      });
    } else {
      withoutPages.push({ ...analyses[i], detectedPageNumber: null });
    }
  }

  // STRICT SORTING: Sort by page number in ascending order
  withPages.sort((a, b) => a.pageNumber - b.pageNumber);
  withoutPages.sort((a, b) => a.originalIndex - b.originalIndex);

  const sortedImgs = withPages.map((p) => p.img);
  const sortedPageNums = withPages.map((p) => p.pageNumber);

  const merged = _insertRemainderLogically(sortedImgs, withoutPages, sortedPageNums);

  const pagesDetected = sortedPageNums.join(", ");

  return {
    sortedImages: merged,
    sortMethod: "cross_image_page_number",
    sortMethodDescription:
      `Sorted by cross-image sequence analysis (pages: ${pagesDetected}). ` +
      `${(coverage * 100).toFixed(0)}% coverage, confidence ${confidence.toFixed(2)}.` +
      (withoutPages.length > 0
        ? ` ${withoutPages.length} page(s) without numbers placed by content analysis.`
        : ""),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Timestamp Sorting
// ══════════════════════════════════════════════════════════════════════════════

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
      (img) => !img.metadata || !(img.metadata.earliestDate instanceof Date),
    )
    .sort((a, b) => a.originalIndex - b.originalIndex);

  // All pages get null detectedPageNumber (since we're using timestamp sorting)
  const enriched = [...withTs, ...withoutTs].map((img) => ({
    ...img,
    detectedPageNumber: null,
  }));

  return {
    sortedImages: enriched,
    sortMethod: "timestamp",
    sortMethodDescription:
      `Sorted by image timestamp (${withTs.length} with EXIF timestamps).` +
      (withoutTs.length > 0 ? ` ${withoutTs.length} appended.` : ""),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Logical Remainder Insertion
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Insert pages without numbers at logical positions.
 *
 * This is the ONLY place where content analysis is used for ordering.
 * Pages WITH detected numbers are NEVER reordered by content.
 *
 * Strategy:
 *  - Use text continuity to find the best insertion point
 *  - Pages are inserted in gaps between numbered pages
 *  - If no good insertion point, append at end
 *
 * @param {any[]} sortedByNumber - Pages sorted by their detected page numbers
 * @param {any[]} remainder - Pages without detected page numbers
 * @param {number[]} pageNumbers - The page numbers of sortedByNumber array
 * @returns {any[]} - Merged array
 */
function _insertRemainderLogically(sortedByNumber, remainder, pageNumbers) {
  if (remainder.length === 0) return sortedByNumber;
  if (sortedByNumber.length === 0) {
    return [...remainder].sort((a, b) => a.originalIndex - b.originalIndex);
  }

  // For small remainder, try to find best insertion points using text flow
  const result = [...sortedByNumber];
  const toInsert = [...remainder];

  // Find gaps in the page number sequence
  const gaps = _findPageGaps(pageNumbers);

  // Assign remainder pages to gaps based on text continuity
  const assignments = _assignToGaps(result, toInsert, gaps);

  // Build final result with insertions
  const finalResult = [];
  let insertedSet = new Set();

  for (let i = 0; i < result.length; i++) {
    // Insert any pages assigned before this position
    const beforeInserts = assignments.get(i) || [];
    for (const img of beforeInserts) {
      finalResult.push(img);
      insertedSet.add(img.originalIndex);
    }

    finalResult.push(result[i]);
  }

  // Insert pages assigned after the last position
  const afterInserts = assignments.get(result.length) || [];
  for (const img of afterInserts) {
    finalResult.push(img);
    insertedSet.add(img.originalIndex);
  }

  // Append any remaining pages that weren't assigned to gaps
  for (const img of toInsert) {
    if (!insertedSet.has(img.originalIndex)) {
      finalResult.push(img);
    }
  }

  return finalResult;
}

/**
 * Find gaps in the page number sequence.
 *
 * Example: [1, 2, 3, 8, 9] has a gap between 3 and 8 (missing 4,5,6,7)
 *
 * @param {number[]} pageNumbers
 * @returns {Array<{insertIdx: number, gapSize: number}>}
 */
function _findPageGaps(pageNumbers) {
  const gaps = [];

  for (let i = 0; i < pageNumbers.length - 1; i++) {
    const curr = pageNumbers[i];
    const next = pageNumbers[i + 1];

    if (curr !== null && next !== null && next > curr + 1) {
      gaps.push({
        insertIdx: i + 1, // Insert after position i
        gapSize: next - curr - 1, // Number of missing pages
        afterPage: curr,
        beforePage: next,
      });
    }
  }

  return gaps;
}

/**
 * Assign remainder pages to gaps using text continuity scoring.
 *
 * @param {any[]} sorted - Sorted pages with numbers
 * @param {any[]} remainder - Pages without numbers
 * @param {Array} gaps - Detected gaps in page sequence
 * @returns {Map<number, any[]>} - Map of insertIdx -> pages to insert
 */
function _assignToGaps(sorted, remainder, gaps) {
  const assignments = new Map();

  // Initialize empty arrays for each gap
  for (const gap of gaps) {
    assignments.set(gap.insertIdx, []);
  }
  // Also allow insertion at the end
  assignments.set(sorted.length, []);

  if (remainder.length === 0 || gaps.length === 0) {
    // No gaps - put all remainder at the end
    assignments.set(sorted.length, [...remainder]);
    return assignments;
  }

  // Score each remainder page for each gap position
  const unassigned = [...remainder];
  const gapFillCount = new Map();

  for (const gap of gaps) {
    gapFillCount.set(gap.insertIdx, 0);
  }

  // Greedy assignment: for each page, find best gap
  for (const page of unassigned) {
    let bestGap = null;
    let bestScore = -Infinity;

    const pageText = (page.ocr?.text || "").trim();

    for (const gap of gaps) {
      // Check if gap still has capacity
      const filled = gapFillCount.get(gap.insertIdx);
      if (filled >= gap.gapSize) continue;

      // Score based on text continuity
      const prevImg = sorted[gap.insertIdx - 1];
      const nextImg = sorted[gap.insertIdx];

      const prevText = (prevImg?.ocr?.text || "").trim();
      const nextText = (nextImg?.ocr?.text || "").trim();

      let score = 0;

      if (pageText.length >= 20) {
        if (prevText.length >= 20) {
          score += scoreContinuity(prevText, pageText) * 2;
        }
        if (nextText.length >= 20) {
          score += scoreContinuity(pageText, nextText);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestGap = gap;
      }
    }

    if (bestGap && bestScore > 0) {
      assignments.get(bestGap.insertIdx).push(page);
      gapFillCount.set(
        bestGap.insertIdx,
        gapFillCount.get(bestGap.insertIdx) + 1
      );
    } else {
      // No good gap found - append at end
      assignments.get(sorted.length).push(page);
    }
  }

  return assignments;
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

function _timestampOf(img) {
  return img.metadata && img.metadata.earliestDate instanceof Date
    ? img.metadata.earliestDate.getTime()
    : Infinity;
}

// ══════════════════════════════════════════════════════════════════════════════
// Exports
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  sortImages,
};
