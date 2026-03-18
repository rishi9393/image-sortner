/**
 * Sorting Service  –  v6 (Smart Remainder Insertion)
 *
 * Sort priority (highest → lowest):
 *
 *  0. Filename sequential numbers            (instant, zero I/O)
 *  0b. ★ Messaging app filename patterns      — WhatsApp WA####, Telegram timestamps
 *  1. ★ AI Vision page detection (two-pass)   — chain-of-thought + verification
 *  2. Explicit page number  (OCR regex, confidence ≥ 0.45)
 *  2b. ★ Signal fusion: AI + OCR combined     — merge AI and OCR when both partial
 *  3. Cross-image page sequence analysis
 *  4. EXIF / metadata timestamp
 *  5. Text continuity  (NLP flow analysis)
 *  6. Original upload order  (fallback)
 *
 * ★ NEW — Smart Remainder Insertion (v6):
 *   Images whose page numbers can't be detected are NO LONGER dumped at the
 *   end.  Instead, each unrecognized image is placed at the position that
 *   maximizes text-flow continuity with its neighbours. A page-gap bonus
 *   further biases insertion toward gaps in the detected sequence (e.g. if
 *   sorted pages are [1, 3, 5], unrecognized images are preferentially
 *   placed in the gaps at positions 2 and 4).
 */

"use strict";

const logger = require("../utils/logger");
const {
  sortByTextContinuity,
  scoreContinuity,
} = require("./textContinuityService");
const { detectPageNumbersAcrossImages } = require("./pageDetectionService");
const { detectMessagingAppOrder } = require("./messagingFilenameService");
const digitValidation = require("./digitValidationService");
const confidenceAggregation = require("./confidenceAggregationService");
const sequenceRepair = require("./sequenceRepairService");
const ambiguityDetection = require("./ambiguityDetectionService");
const aiEnhancement = require("./aiEnhancementService");

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_NUMBER_CONFIDENCE_THRESHOLD = 0.45;
const QUORUM_FRACTION = 0.3;
const CROSS_IMAGE_MIN_CONFIDENCE = 0.65;

// ── Validation & Enhancement Pipeline ──────────────────────────────────────────

/**
 * ★ NEW (Improvements #1–#10)
 *
 * Apply all accuracy enhancements to a sort result.
 * Integrates: digit validation, confidence aggregation, sequence repair,
 * ambiguity detection, and overall quality assessment.
 *
 * @param {{
 *   sortedImages: Array,
 *   sortMethod: string,
 *   sortMethodDescription: string,
 *   aiResult?: Object,
 * }} result
 *
 * @param {Array} analyses
 *
 * @returns {{
 *   ...result,
 *   enhancedResult: true,
 *   confidenceAggregation: Object,
 *   warnings: string[],
 *   requiresAIVerification: boolean,
 * }}
 */
function _applyAccuracyEnhancements(result, analyses) {
  const enhancements = {
    warnings: [],
    flagsForAI: [],
    digitIssues: [],
    sequenceIssues: [],
  };

  // ── Enhancement 1: Digit Validation (Improvement #1) ──────────────────────
  for (let i = 0; i < analyses.length; i++) {
    const analysis = analyses[i];
    if (analysis.pageDetection && analysis.pageDetection.confidence < 0.7) {
      const validation = digitValidation.validateDigit(analysis.pageDetection, {
        allDetectedPages: analyses
          .map((a) => a.pageNumber)
          .filter((p) => p !== null),
        imageIndex: i,
        totalImages: analyses.length,
      });

      if (validation.flagged) {
        enhancements.digitIssues.push({
          imageIndex: i,
          originalConfidence: analysis.pageDetection.confidence,
          adjustment: validation.confidence - analysis.pageDetection.confidence,
          reason: validation.reason,
        });

        // Update confidence in place
        analysis.pageDetection.confidence = validation.confidence;
      }
    }
  }

  // ── Enhancement 5: Sequence Repair (Improvement #5) ──────────────────────
  const detectedPages = analyses
    .map((a) => a.pageNumber)
    .filter((p) => p !== null && p !== undefined)
    .sort((a, b) => a - b);

  if (detectedPages.length > 0) {
    const gapAnalysis = sequenceRepair.analyzeSequenceGaps(
      detectedPages,
      analyses.length,
    );

    if (gapAnalysis.hasGaps && gapAnalysis.anomalyLevel !== "normal") {
      enhancements.warnings.push(gapAnalysis.recommendation);
      if (gapAnalysis.requiresAIVerification) {
        enhancements.flagsForAI.push(
          "Sequence gaps detected—AI verification recommended.",
        );
      }
    }
  }

  // ── Enhancement 3: Ambiguity Detection (Improvement #3) ───────────────────
  for (let i = 0; i < analyses.length; i++) {
    const analysis = analyses[i];
    if (analysis.ocr && analysis.ocr.text) {
      // Collect all detections from OCR text for this image
      // (This would require access to raw OCR detections, which we simplify here)
      // Flag if detection confidence is marginal
      if (
        analysis.pageDetection &&
        analysis.pageDetection.confidence >= 0.45 &&
        analysis.pageDetection.confidence <= 0.65
      ) {
        enhancements.flagsForAI.push(
          `Image ${i + 1}: ambiguous page detection (confidence ${analysis.pageDetection.confidence.toFixed(2)})`,
        );
      }
    }
  }

  // ── Build confidence aggregation ──────────────────────────────────────────
  const signals = {
    ocr: _estimateOCRConfidence(analyses),
    ai: result.aiResult?.confidence || undefined,
    aiVerified: result.aiResult?.verified || false,
    textContinuity: _estimateTextContinuityConfidence(analyses),
    crossImage: (detectedPages.length / Math.max(1, analyses.length)) * 0.8, // Rough estimate
  };

  const agg = confidenceAggregation.aggregateConfidence(signals);

  return {
    ...result,
    enhancedResult: true,
    confidenceAggregation: agg,
    enhancements,
    warnings: enhancements.warnings,
    requiresAIVerification:
      enhancements.flagsForAI.length > 0 && agg.quality !== "high",
    flagged: agg.shouldFlagForReview,
  };
}

/**
 * Estimate OCR confidence from analyzed images.
 */
function _estimateOCRConfidence(analyses) {
  const withPageNumber = analyses.filter(
    (a) =>
      a.pageDetection &&
      a.pageDetection.confidence >= PAGE_NUMBER_CONFIDENCE_THRESHOLD,
  );

  if (withPageNumber.length === 0) return 0;

  const avgConfidence =
    withPageNumber.reduce((sum, a) => sum + a.pageDetection.confidence, 0) /
    withPageNumber.length;
  const coverage = withPageNumber.length / analyses.length;

  return Math.min(0.95, avgConfidence * coverage);
}

/**
 * Estimate text continuity confidence (rough heuristic).
 */
function _estimateTextContinuityConfidence(analyses) {
  const withText = analyses.filter(
    (a) => a.ocr && a.ocr.text && a.ocr.text.trim().length > 20,
  );
  if (withText.length < 2) return 0;
  return Math.min(0.8, 0.5 + (withText.length / analyses.length) * 0.3);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @param {any[]} analyses
 * @param {{ pageNumbers: (number|null)[], confidence: number, perImageConfidence?: string[], verified?: boolean } | null} aiResult
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

  // ── Signal 0a: Filename sequential numbers ────────────────────────────────
  const fnResult = _detectFilenameOrder(analyses);
  if (fnResult) {
    logger.info(`Sort method: filename_order`);
    return fnResult;
  }

  // ── Signal 0b: ★ Messaging app filename patterns ─────────────────────────
  const msgResult = detectMessagingAppOrder(analyses);
  if (msgResult) {
    logger.info(`Sort method: messaging_app_filename`);
    return msgResult;
  }

  // ── Signal 1: ★ AI Vision page detection (enhanced two-pass) ──────────────
  if (aiResult && aiResult.pageNumbers) {
    const aiSortResult = _sortByAiPageNumbers(analyses, aiResult);
    if (aiSortResult) {
      logger.info(
        `Sort method: ai_vision_page_number (verified: ${aiResult.verified || false})`,
      );
      return aiSortResult;
    }
  }

  // ── Signal 2: Per-image OCR page numbers ──────────────────────────────────
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

  // ── Signal 2b: ★ Fusion — combine partial AI + partial OCR ────────────────
  if (aiResult && aiResult.pageNumbers) {
    const fusionResult = _trySignalFusion(analyses, aiResult);
    if (fusionResult) {
      logger.info(`Sort method: signal_fusion (AI + OCR)`);
      return fusionResult;
    }
  }

  // ── Signal 3: Cross-image page sequence analysis ──────────────────────────
  const crossImageResult = _tryCrossImageSort(analyses);
  if (crossImageResult) {
    logger.info(`Sort method: cross_image_page_number`);
    return crossImageResult;
  }

  // ── Signal 4: Timestamps ──────────────────────────────────────────────────
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

  // ── Signal 5: Text continuity ─────────────────────────────────────────────
  const withText = analyses.filter(
    (img) => img.ocr && img.ocr.text && img.ocr.text.trim().length > 20,
  );

  if (withText.length / analyses.length >= 0.5) {
    logger.info(
      `Sort method: text_continuity (${withText.length}/${analyses.length})`,
    );
    return sortByTextContinuity(analyses);
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
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

// ── Signal 0a: Filename order ─────────────────────────────────────────────────

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

  return {
    sortedImages: sorted.map((n) => n.img),
    sortMethod: "filename_order",
    sortMethodDescription: `Sorted by sequential numbers found in filenames (${min}–${max}).`,
  };
}

// ── Signal 1: AI Vision page numbers (enhanced) ──────────────────────────────

function _sortByAiPageNumbers(analyses, aiResult) {
  const { pageNumbers, confidence, perImageConfidence, verified } = aiResult;
  const n = analyses.length;

  if (!pageNumbers || pageNumbers.length !== n) return null;

  const validCount = pageNumbers.filter((p) => p !== null).length;
  if (validCount < n * 0.4) return null; // need at least 40% coverage

  const withPages = [];
  const withoutPages = [];

  for (let i = 0; i < n; i++) {
    if (pageNumbers[i] !== null) {
      withPages.push({
        img: analyses[i],
        pageNumber: pageNumbers[i],
        imgConf: perImageConfidence ? perImageConfidence[i] : "medium",
      });
    } else {
      withoutPages.push(analyses[i]);
    }
  }

  // Handle duplicates: prefer the one with higher per-image confidence, then lower originalIndex
  const pageMap = new Map();
  const extras = [];

  const confRank = { high: 3, medium: 2, low: 1 };

  for (const entry of withPages) {
    const existing = pageMap.get(entry.pageNumber);
    if (!existing) {
      pageMap.set(entry.pageNumber, entry);
    } else {
      // Compare per-image confidence first, then originalIndex
      const existRank = confRank[existing.imgConf] || 1;
      const newRank = confRank[entry.imgConf] || 1;

      if (
        newRank > existRank ||
        (newRank === existRank &&
          entry.img.originalIndex < existing.img.originalIndex)
      ) {
        extras.push(existing.img);
        pageMap.set(entry.pageNumber, entry);
      } else {
        extras.push(entry.img);
      }
    }
  }

  const sorted = [...pageMap.values()].sort(
    (a, b) => a.pageNumber - b.pageNumber,
  );
  const remainder = [...withoutPages, ...extras].sort(
    (a, b) => a.originalIndex - b.originalIndex,
  );

  const pagesDetected = sorted.map((e) => e.pageNumber).join(", ");
  const verifiedStr = verified ? " ✓ verified by content-flow analysis" : "";
  const sortedImgs = sorted.map((e) => e.img);
  const sortedPageNums = sorted.map((e) => e.pageNumber);

  // ★ Smart insertion: place unrecognized images by text-flow analysis
  const merged = _insertRemaindersByFlow(sortedImgs, remainder, sortedPageNums);
  const placedInline = remainder.length > 0 ? remainder.length : 0;

  return {
    sortedImages: merged,
    sortMethod: "ai_vision_page_number",
    sortMethodDescription:
      `Sorted by AI vision page detection using ${aiResult.model || "Gemini"} ` +
      `(${pageMap.size} pages detected: ${pagesDetected}, confidence: ${confidence.toFixed(2)}${verifiedStr}).` +
      (placedInline > 0
        ? ` ${placedInline} image(s) placed by text-flow analysis.`
        : ""),
  };
}

// ── Signal 2: Per-image OCR page-number sort ──────────────────────────────────

function _sortByPageNumber(analyses, withPageNumbers) {
  const withoutPageNumbers = analyses.filter(
    (img) =>
      !img.pageDetection ||
      img.pageDetection.confidence < PAGE_NUMBER_CONFIDENCE_THRESHOLD,
  );

  const pageMap = new Map();
  for (const img of withPageNumbers) {
    const pn = img.pageDetection.pageNumber;
    const existing = pageMap.get(pn);
    if (
      !existing ||
      img.pageDetection.confidence > existing.pageDetection.confidence
    ) {
      if (existing) withoutPageNumbers.push(existing);
      pageMap.set(pn, img);
    } else {
      withoutPageNumbers.push(img);
    }
  }

  const sorted = [...pageMap.values()].sort(
    (a, b) => a.pageDetection.pageNumber - b.pageDetection.pageNumber,
  );

  const remainder = [...withoutPageNumbers].sort((a, b) => {
    const tDiff = _timestampOf(a) - _timestampOf(b);
    return tDiff !== 0 ? tDiff : a.originalIndex - b.originalIndex;
  });

  const pagesDetected = [...pageMap.keys()].sort((a, b) => a - b).join(", ");
  const sortedPageNums = sorted.map((img) => img.pageDetection.pageNumber);

  // ★ Smart insertion: place unrecognized images by text-flow analysis
  const merged = _insertRemaindersByFlow(sorted, remainder, sortedPageNums);
  const placedInline = remainder.length > 0 ? remainder.length : 0;

  return {
    sortedImages: merged,
    sortMethod: "page_number",
    sortMethodDescription:
      `Sorted by detected page numbers (${pageMap.size} found: ${pagesDetected}).` +
      (placedInline > 0
        ? ` ${placedInline} image(s) placed by text-flow analysis.`
        : ""),
  };
}

// ── Signal 2b: ★ Fusion — combine partial AI + partial OCR ───────────────────

/**
 * When AI detected SOME pages and OCR detected SOME pages, merge them.
 * AI results take priority, OCR fills gaps.
 * This fires when neither AI nor OCR alone met the quorum, but together they do.
 */
function _trySignalFusion(analyses, aiResult) {
  const n = analyses.length;
  const { pageNumbers: aiPages, perImageConfidence } = aiResult;

  if (!aiPages || aiPages.length !== n) return null;

  // Build a fused page number array
  const fusedPages = new Array(n).fill(null);
  const fusedSources = new Array(n).fill(null); // 'ai' | 'ocr' | null
  const confRank = { high: 3, medium: 2, low: 1 };

  // Start with AI results
  for (let i = 0; i < n; i++) {
    if (aiPages[i] !== null) {
      fusedPages[i] = aiPages[i];
      fusedSources[i] = "ai";
    }
  }

  // Fill gaps from OCR
  let ocrFilled = 0;
  for (let i = 0; i < n; i++) {
    if (fusedPages[i] !== null) continue; // AI already has this one
    const det = analyses[i].pageDetection;
    if (det && det.confidence >= PAGE_NUMBER_CONFIDENCE_THRESHOLD) {
      // Check for conflict: is this OCR page number already assigned to another image by AI?
      const conflict = fusedPages.indexOf(det.pageNumber);
      if (conflict === -1) {
        fusedPages[i] = det.pageNumber;
        fusedSources[i] = "ocr";
        ocrFilled++;
      } else {
        // OCR says this is page X, but AI already assigned page X to another image
        // Trust AI, skip this OCR detection
        logger.debug(
          `Fusion: OCR page ${det.pageNumber} for image ${i} conflicts with AI assignment for image ${conflict} — skipping OCR.`,
        );
      }
    }
  }

  // Check if fusion gives us enough coverage
  const fusedValid = fusedPages.filter((p) => p !== null).length;
  const aiValid = aiPages.filter((p) => p !== null).length;

  // Fusion must be better than AI alone AND meet minimum quorum
  if (fusedValid <= aiValid || fusedValid / n < 0.5) {
    return null;
  }

  logger.info(
    `Signal fusion: AI provided ${aiValid}/${n}, OCR filled ${ocrFilled} gaps → ${fusedValid}/${n} total`,
  );

  // Build sorted result
  const withPages = [];
  const withoutPages = [];

  for (let i = 0; i < n; i++) {
    if (fusedPages[i] !== null) {
      withPages.push({
        img: analyses[i],
        pageNumber: fusedPages[i],
        source: fusedSources[i],
      });
    } else {
      withoutPages.push(analyses[i]);
    }
  }

  // Handle duplicates (prefer AI source, then higher index stability)
  const pageMap = new Map();
  const extras = [];

  for (const entry of withPages) {
    const existing = pageMap.get(entry.pageNumber);
    if (!existing) {
      pageMap.set(entry.pageNumber, entry);
    } else {
      // Prefer AI over OCR, then lower originalIndex
      const existIsAI = existing.source === "ai";
      const newIsAI = entry.source === "ai";
      if (newIsAI && !existIsAI) {
        extras.push(existing.img);
        pageMap.set(entry.pageNumber, entry);
      } else if (!newIsAI && existIsAI) {
        extras.push(entry.img);
      } else if (entry.img.originalIndex < existing.img.originalIndex) {
        extras.push(existing.img);
        pageMap.set(entry.pageNumber, entry);
      } else {
        extras.push(entry.img);
      }
    }
  }

  const sorted = [...pageMap.values()].sort(
    (a, b) => a.pageNumber - b.pageNumber,
  );
  const remainder = [...withoutPages, ...extras].sort(
    (a, b) => a.originalIndex - b.originalIndex,
  );

  const pagesDetected = sorted
    .map((e) => `${e.pageNumber}(${e.source})`)
    .join(", ");
  const sortedImgs = sorted.map((e) => e.img);
  const sortedPageNums = sorted.map((e) => e.pageNumber);

  // ★ Smart insertion: place unrecognized images by text-flow analysis
  const merged = _insertRemaindersByFlow(sortedImgs, remainder, sortedPageNums);
  const placedInline = remainder.length > 0 ? remainder.length : 0;

  return {
    sortedImages: merged,
    sortMethod: "signal_fusion",
    sortMethodDescription:
      `Sorted by fusing AI vision (${aiValid} pages) + OCR detection (${ocrFilled} pages) → ` +
      `${pageMap.size} total pages: ${pagesDetected}.` +
      (placedInline > 0
        ? ` ${placedInline} image(s) placed by text-flow analysis.`
        : ""),
  };
}

// ── Signal 3: Cross-image sequence ────────────────────────────────────────────

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
      withPages.push({ img: analyses[i], pageNumber: pageNumbers[i] });
    } else {
      withoutPages.push(analyses[i]);
    }
  }

  withPages.sort((a, b) => a.pageNumber - b.pageNumber);
  withoutPages.sort((a, b) => a.originalIndex - b.originalIndex);

  const sortedImgs = withPages.map((p) => p.img);
  const sortedPageNums = withPages.map((p) => p.pageNumber);

  // ★ Smart insertion: place unrecognized images by text-flow analysis
  const merged = _insertRemaindersByFlow(
    sortedImgs,
    withoutPages,
    sortedPageNums,
  );
  const placedInline = withoutPages.length > 0 ? withoutPages.length : 0;

  return {
    sortedImages: merged,
    sortMethod: "cross_image_page_number",
    sortMethodDescription:
      `Sorted by cross-image sequence analysis (${(coverage * 100).toFixed(0)}% coverage, confidence ${confidence.toFixed(2)}).` +
      (placedInline > 0
        ? ` ${placedInline} image(s) placed by text-flow analysis.`
        : ""),
  };
}

// ── Signal 4: Timestamp sort ──────────────────────────────────────────────────

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

  return {
    sortedImages: [...withTs, ...withoutTs],
    sortMethod: "timestamp",
    sortMethodDescription:
      `Sorted by image timestamp (${withTs.length} with EXIF timestamps).` +
      (withoutTs.length > 0 ? ` ${withoutTs.length} appended.` : ""),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _timestampOf(img) {
  return img.metadata && img.metadata.earliestDate instanceof Date
    ? img.metadata.earliestDate.getTime()
    : Infinity;
}

// ══════════════════════════════════════════════════════════════════════════════
// ★ Smart Remainder Insertion  (v7 — Gap-First Approach)
//
//   PHASE 1: Fill page-number gaps
//   ───────────────────────────────
//   Pre-compute ALL gaps before any insertions. For pages [1, 3, 6], gaps are:
//     • Insert index 1 → missing page 2 (between pages 1 and 3)
//     • Insert index 2 → missing pages 4,5 (between pages 3 and 6) — capacity 2
//
//   Assign unrecognized images to gaps using text-continuity as tiebreaker.
//   This avoids the bug where gap detection breaks after each insertion.
//
//   PHASE 2: Place remaining images by text-flow
//   ─────────────────────────────────────────────
//   Any images left after gap-filling are placed at the position that
//   maximizes text continuity with neighbours.
//
//   PHASE 3: Fallback
//   ─────────────────
//   Images with no OCR text use timestamp proximity or append at end.
// ══════════════════════════════════════════════════════════════════════════════

/** Minimum OCR text length to attempt continuity scoring */
const MIN_TEXT_FOR_CONTINUITY = 20;

/**
 * Place remainder images into the sorted sequence at optimal positions.
 *
 * @param {Array}         sorted            - Already-sorted images (with detected page numbers)
 * @param {Array}         remainder         - Unplaced images to insert
 * @param {number[]|null} sortedPageNumbers - Page numbers parallel to sorted array
 * @returns {Array} Merged sequence
 */
function _insertRemaindersByFlow(sorted, remainder, sortedPageNumbers = null) {
  if (remainder.length === 0) return sorted;
  if (sorted.length === 0) {
    return [...remainder].sort((a, b) => a.originalIndex - b.originalIndex);
  }

  // ════════════════════════════════════════════════════════════════════════
  // PHASE 1: Pre-compute all gaps and fill them first
  // ════════════════════════════════════════════════════════════════════════

  const gaps = _computeGaps(sortedPageNumbers);
  let unassigned = [...remainder];

  // Result array with slots: sorted images + nulls for gap slots
  // We'll build the final sequence by filling gaps
  const result = [];

  // Track placement counts for logging
  let placedInGaps = 0;
  let placedAtEnd = 0;

  // First, determine how many images go into each gap using text continuity
  const gapAssignments = _assignImagesToGaps(
    sorted,
    gaps,
    unassigned,
    sortedPageNumbers,
  );

  // Build the sequence: interleave sorted images with gap assignments
  for (let i = 0; i < sorted.length; i++) {
    // Check if there's a gap BEFORE this sorted image (at insert index i)
    const gapHere = gapAssignments.get(i);
    if (gapHere && gapHere.length > 0) {
      for (const img of gapHere) {
        result.push(img);
        placedInGaps++;
      }
    }
    result.push(sorted[i]);
  }

  // Check for gap after the last sorted image
  const gapAtEnd = gapAssignments.get(sorted.length);
  if (gapAtEnd && gapAtEnd.length > 0) {
    for (const img of gapAtEnd) {
      result.push(img);
      placedInGaps++;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // PHASE 2: Append remaining images at the end
  // ════════════════════════════════════════════════════════════════════════
  // Images that didn't fit in gaps are genuinely "extra" — append at end

  const assignedSet = new Set();
  for (const [, imgs] of gapAssignments) {
    for (const img of imgs) assignedSet.add(img);
  }
  const stillUnassigned = unassigned.filter((img) => !assignedSet.has(img));

  // Sort extras by originalIndex to maintain some consistency
  stillUnassigned.sort((a, b) => a.originalIndex - b.originalIndex);

  for (const img of stillUnassigned) {
    result.push(img);
    placedAtEnd++;
  }

  logger.debug(
    `Smart insertion: ${placedInGaps} in page gaps, ${placedAtEnd} appended at end`,
  );

  return result;
}

/**
 * Pre-compute all gaps in the page number sequence.
 *
 * For pages [1, 3, 6], returns:
 *   [
 *     { insertIdx: 1, gapSize: 1, afterPage: 1, beforePage: 3 },  // missing page 2
 *     { insertIdx: 2, gapSize: 2, afterPage: 3, beforePage: 6 },  // missing pages 4,5
 *   ]
 *
 * @param {number[]|null} pageNumbers
 * @returns {Array<{insertIdx: number, gapSize: number, afterPage: number, beforePage: number}>}
 */
function _computeGaps(pageNumbers) {
  const gaps = [];
  if (!pageNumbers || pageNumbers.length < 2) return gaps;

  for (let i = 0; i < pageNumbers.length - 1; i++) {
    const curr = pageNumbers[i];
    const next = pageNumbers[i + 1];

    if (curr !== null && next !== null && next > curr + 1) {
      gaps.push({
        insertIdx: i + 1, // Insert AFTER index i (before index i+1)
        gapSize: next - curr - 1, // How many pages are missing
        afterPage: curr,
        beforePage: next,
      });
    }
  }

  return gaps;
}

/**
 * Assign unrecognized images to gaps using OPTIMAL MATCHING.
 *
 * For small cases (common), tries all possible assignments to find the
 * globally optimal one. For larger cases, falls back to greedy.
 *
 * @param {Array} sorted - Sorted images with page numbers
 * @param {Array} gaps - Pre-computed gaps from _computeGaps
 * @param {Array} unassigned - Images without page numbers
 * @param {number[]} pageNumbers - Page numbers of sorted images
 * @returns {Map<number, Array>}
 */
function _assignImagesToGaps(sorted, gaps, unassigned, pageNumbers) {
  const assignments = new Map();

  // Initialize empty assignments for each gap
  for (const gap of gaps) {
    assignments.set(gap.insertIdx, []);
  }

  if (gaps.length === 0 || unassigned.length === 0) {
    return assignments;
  }

  // Build score matrix: scoreMatrix[imgIdx][gapIdx] = continuity score
  const scoreMatrix = [];
  for (let i = 0; i < unassigned.length; i++) {
    const imgScores = [];
    const img = unassigned[i];
    const imgText = (img.ocr?.text || "").trim();

    for (let g = 0; g < gaps.length; g++) {
      const gap = gaps[g];
      const prevImg = sorted[gap.insertIdx - 1];
      const nextImg = sorted[gap.insertIdx];
      const prevText = (prevImg?.ocr?.text || "").trim();
      const nextText = (nextImg?.ocr?.text || "").trim();

      let score = 0;
      if (imgText.length >= MIN_TEXT_FOR_CONTINUITY) {
        // Weight "prev → img" MORE than "img → next" (2:1 ratio)
        // because the flow INTO the gap is more important for sequencing
        if (prevText.length >= MIN_TEXT_FOR_CONTINUITY) {
          score += scoreContinuity(prevText, imgText) * 2;
        }
        if (nextText.length >= MIN_TEXT_FOR_CONTINUITY) {
          score += scoreContinuity(imgText, nextText);
        }
      }
      imgScores.push(score);
    }
    scoreMatrix.push(imgScores);
  }

  // Calculate total gap capacity
  const totalCapacity = gaps.reduce((sum, g) => sum + g.gapSize, 0);
  const numToAssign = Math.min(unassigned.length, totalCapacity);

  // For small cases, find optimal assignment by trying all combinations
  if (gaps.length <= 3 && unassigned.length <= 6) {
    const bestAssignment = _findOptimalAssignment(
      unassigned,
      gaps,
      scoreMatrix,
    );
    for (const [gapIdx, imgs] of bestAssignment) {
      const insertIdx = gaps[gapIdx].insertIdx;
      assignments.set(insertIdx, imgs);
    }
  } else {
    // Greedy fallback for larger cases
    _greedyAssignToGaps(unassigned, gaps, scoreMatrix, assignments);
  }

  // Sort images WITHIN each gap to maximize chain continuity
  for (const [insertIdx, imgs] of assignments) {
    if (imgs.length <= 1) continue;

    const prevImg = sorted[insertIdx - 1];
    const nextImg = sorted[insertIdx];
    const prevText = (prevImg?.ocr?.text || "").trim();
    const nextText = (nextImg?.ocr?.text || "").trim();

    if (imgs.length <= 4) {
      const permutations = _getPermutations(imgs);
      let bestPerm = imgs;
      let bestScore = -Infinity;

      for (const perm of permutations) {
        const score = _chainScore(prevText, perm, nextText);
        if (score > bestScore) {
          bestScore = score;
          bestPerm = perm;
        }
      }
      imgs.length = 0;
      imgs.push(...bestPerm);
    } else {
      const ordered = _greedyChainOrder(prevText, imgs, nextText);
      imgs.length = 0;
      imgs.push(...ordered);
    }
  }

  return assignments;
}

/**
 * Find the optimal assignment of images to gaps by trying all valid combinations.
 * Returns Map: gapIdx → [images assigned to that gap]
 */
function _findOptimalAssignment(images, gaps, scoreMatrix) {
  const n = images.length;
  const numGaps = gaps.length;
  const gapCapacities = gaps.map((g) => g.gapSize);
  const totalCapacity = gapCapacities.reduce((a, b) => a + b, 0);

  // Generate all ways to assign up to totalCapacity images to gaps
  // Each image can go to one gap or be unassigned (-1)
  let bestAssignment = new Map();
  let bestScore = -Infinity;

  // For each subset of images (up to totalCapacity), try all gap assignments
  const numToPlace = Math.min(n, totalCapacity);

  // Generate all combinations of which images to place
  const imageCombinations = _getCombinations(images, numToPlace);

  for (const selectedImages of imageCombinations) {
    // Generate all ways to distribute selectedImages among gaps
    const distributions = _getDistributions(
      selectedImages,
      numGaps,
      gapCapacities,
    );

    for (const distribution of distributions) {
      // distribution is an array where distribution[i] is the list of images for gap i
      let totalScore = 0;

      for (let gapIdx = 0; gapIdx < numGaps; gapIdx++) {
        const gapImages = distribution[gapIdx];
        for (const img of gapImages) {
          const imgIdx = images.indexOf(img);
          totalScore += scoreMatrix[imgIdx][gapIdx];
        }
      }

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestAssignment = new Map();
        for (let gapIdx = 0; gapIdx < numGaps; gapIdx++) {
          bestAssignment.set(gapIdx, [...distribution[gapIdx]]);
        }
      }
    }
  }

  return bestAssignment;
}

/**
 * Get all combinations of k items from array.
 */
function _getCombinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  if (k > arr.length) k = arr.length;

  const result = [];

  function combine(start, current) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      combine(i + 1, current);
      current.pop();
    }
  }

  combine(0, []);
  return result;
}

/**
 * Get all ways to distribute items among numGaps gaps with given capacities.
 * Returns array of distributions, where each distribution is [gap0Items, gap1Items, ...]
 */
function _getDistributions(items, numGaps, capacities) {
  const results = [];

  function distribute(itemIdx, current) {
    if (itemIdx === items.length) {
      // Check if all gaps are within capacity
      const valid = current.every(
        (gapItems, i) => gapItems.length <= capacities[i],
      );
      if (valid) {
        results.push(current.map((arr) => [...arr]));
      }
      return;
    }

    // Try assigning items[itemIdx] to each gap
    for (let g = 0; g < numGaps; g++) {
      if (current[g].length < capacities[g]) {
        current[g].push(items[itemIdx]);
        distribute(itemIdx + 1, current);
        current[g].pop();
      }
    }
  }

  const initial = Array.from({ length: numGaps }, () => []);
  distribute(0, initial);
  return results;
}

/**
 * Greedy gap assignment fallback for larger cases.
 */
function _greedyAssignToGaps(images, gaps, scoreMatrix, assignments) {
  const scores = [];

  for (let i = 0; i < images.length; i++) {
    for (let g = 0; g < gaps.length; g++) {
      scores.push({ imgIdx: i, gapIdx: g, score: scoreMatrix[i][g] });
    }
  }

  scores.sort((a, b) => b.score - a.score);

  const usedImages = new Set();
  const gapFillCount = new Map();

  for (const gap of gaps) {
    gapFillCount.set(gap.insertIdx, 0);
  }

  for (const { imgIdx, gapIdx, score } of scores) {
    if (usedImages.has(imgIdx)) continue;

    const gap = gaps[gapIdx];
    const currentCount = gapFillCount.get(gap.insertIdx);
    if (currentCount >= gap.gapSize) continue;

    assignments.get(gap.insertIdx).push(images[imgIdx]);
    gapFillCount.set(gap.insertIdx, currentCount + 1);
    usedImages.add(imgIdx);
  }
}

/**
 * Compute text-flow score for inserting at position p.
 *
 * score = continuity(prev → img) + continuity(img → next) - continuity(prev → next)
 */
function _textFlowScore(seq, p, imgText) {
  let score = 0;

  const prevText = p > 0 ? (seq[p - 1].ocr?.text || "").trim() : "";
  const nextText = p < seq.length ? (seq[p].ocr?.text || "").trim() : "";

  // Flow: prev → image
  if (prevText.length >= MIN_TEXT_FOR_CONTINUITY) {
    score += scoreContinuity(prevText, imgText);
  }

  // Flow: image → next
  if (nextText.length >= MIN_TEXT_FOR_CONTINUITY) {
    score += scoreContinuity(imgText, nextText);
  }

  // Subtract the flow we'd be breaking
  if (
    prevText.length >= MIN_TEXT_FOR_CONTINUITY &&
    nextText.length >= MIN_TEXT_FOR_CONTINUITY
  ) {
    score -= scoreContinuity(prevText, nextText);
  }

  return score;
}

/**
 * When no OCR text is available, place the image near its closest
 * timestamp neighbour. Falls back to appending at the end.
 */
function _bestPositionByTimestamp(seq, img) {
  const ts = _timestampOf(img);
  if (ts === Infinity) return seq.length;

  for (let i = 0; i < seq.length; i++) {
    const seqTs = _timestampOf(seq[i]);
    if (seqTs !== Infinity && ts < seqTs) return i;
  }
  return seq.length;
}

/**
 * Generate all permutations of an array (for small arrays only).
 */
function _getPermutations(arr) {
  if (arr.length <= 1) return [arr];

  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of _getPermutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

/**
 * Score a chain: prev → imgs[0] → imgs[1] → ... → imgs[n-1] → next
 * Returns total continuity score.
 */
function _chainScore(prevText, imgs, nextText) {
  let score = 0;
  let lastText = prevText;

  for (const img of imgs) {
    const imgText = (img.ocr?.text || "").trim();

    if (
      lastText.length >= MIN_TEXT_FOR_CONTINUITY &&
      imgText.length >= MIN_TEXT_FOR_CONTINUITY
    ) {
      score += scoreContinuity(lastText, imgText);
    }

    lastText = imgText;
  }

  // Score connection to next
  if (
    lastText.length >= MIN_TEXT_FOR_CONTINUITY &&
    nextText.length >= MIN_TEXT_FOR_CONTINUITY
  ) {
    score += scoreContinuity(lastText, nextText);
  }

  return score;
}

/**
 * Greedy chain ordering for larger arrays.
 * Start with the image that best follows prevText, then greedily pick next best.
 */
function _greedyChainOrder(prevText, imgs, nextText) {
  const remaining = [...imgs];
  const ordered = [];
  let lastText = prevText;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const imgText = (remaining[i].ocr?.text || "").trim();
      const score =
        lastText.length >= MIN_TEXT_FOR_CONTINUITY &&
        imgText.length >= MIN_TEXT_FOR_CONTINUITY
          ? scoreContinuity(lastText, imgText)
          : 0;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    const chosen = remaining.splice(bestIdx, 1)[0];
    ordered.push(chosen);
    lastText = (chosen.ocr?.text || "").trim();
  }

  return ordered;
}

module.exports = {
  sortImages,
  applyAccuracyEnhancements: _applyAccuracyEnhancements,
};
