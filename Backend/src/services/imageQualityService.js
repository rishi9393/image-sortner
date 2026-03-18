/**
 * Image Quality Service  –  v1 (Improvement #9)
 *
 * Analyzes image quality before processing to warn users about
 * potentially problematic batches:
 *  - Too many blurry/low-contrast images
 *  - Large batch size (>50 images)
 *  - Mixed-quality batches
 *
 * Returns: warnings and recommendations
 */

"use strict";

const sharp = require("sharp");
const logger = require("../utils/logger");

/**
 * Quickly analyze image quality without full processing.
 * Checks for blur, contrast, and saturation.
 *
 * @param {string} filePath
 * @returns {Promise<{
 *   blur: "low" | "medium" | "high",
 *   contrast: "low" | "medium" | "high",
 *   brightness: number,  // 0–255
 *   estimatedQuality: "good" | "fair" | "poor",  // Quick assessment
 * }>}
 */
async function analyzeImageQuality(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    const { width, height, hasAlpha } = metadata;

    // Quick sharp analysis: get stats on full image
    const stats = await sharp(filePath).stats();

    // Simple heuristic: low variance = blurry; low contrast = poor lighting
    let blur = "low";
    let contrast = "low";

    // High variance in luminance suggests sharp image
    const luminanceVariance = stats.channels[0]?.mean || 127;
    if (stats.channels.length > 0) {
      const variance = stats.channels[0]?.std || 0;
      blur = variance > 30 ? "low" : variance > 15 ? "medium" : "high";
    }

    // Low dynamic range suggests poor contrast
    const channelRanges = stats.channels.map((c) => c.max - c.min || 0);
    const avgRange =
      channelRanges.reduce((a, b) => a + b, 0) / channelRanges.length;
    contrast = avgRange > 100 ? "high" : avgRange > 50 ? "medium" : "low";

    const brightness = stats.channels[0]?.mean || 127;

    // Quick quality score
    let estimatedQuality = "fair";
    if (
      blur === "low" &&
      contrast === "high" &&
      brightness > 50 &&
      brightness < 200
    ) {
      estimatedQuality = "good";
    } else if (
      blur === "high" ||
      contrast === "low" ||
      brightness < 30 ||
      brightness > 220
    ) {
      estimatedQuality = "poor";
    }

    return {
      blur,
      contrast,
      brightness: Math.round(brightness),
      estimatedQuality,
    };
  } catch (err) {
    logger.warn(`Quality analysis failed for ${filePath}: ${err.message}`);
    return {
      blur: "medium",
      contrast: "medium",
      brightness: 127,
      estimatedQuality: "fair",
    };
  }
}

/**
 * Analyze a batch of images and return quality warnings.
 *
 * @param {{
 *   originalFilepath?: string,
 *   relativePath?: string,
 * }[]} files
 *
 * @returns {Promise<{
 *   batchQuality: "excellent" | "good" | "fair" | "poor",
 *   poorQualityCount: number,
 *   warnings: string[],
 *   recommendations: string[],
 *   stats: {
 *     totalImages: number,
 *     blurryImages: number,
 *     lowContrastImages: number,
 *     poorBrightnessImages: number,
 *   }
 * }>}
 */
async function analyzeBatch(files) {
  const warnings = [];
  const recommendations = [];
  const stats = {
    totalImages: files.length,
    blurryImages: 0,
    lowContrastImages: 0,
    poorBrightnessImages: 0,
  };

  // ── Check 1: Batch size warning ──────────────────────────────────────────
  if (files.length > 100) {
    warnings.push(
      `Large batch (${files.length} images) may cause processing delays.`,
    );
    recommendations.push(
      `Consider splitting into batches of 50 images or fewer.`,
    );
  } else if (files.length > 50) {
    warnings.push(
      `Batch size (${files.length}) is at upper limit for optimal performance.`,
    );
  }

  // ── Check 2: Sample quality (analyze first 5 + random sample) ────────────
  const sampleSize = Math.min(10, Math.max(5, Math.floor(files.length * 0.1)));
  const indices = new Set();

  // First 5
  for (let i = 0; i < Math.min(5, files.length); i++) {
    indices.add(i);
  }

  // Random additional samples
  while (indices.size < sampleSize) {
    indices.add(Math.floor(Math.random() * files.length));
  }

  let totalQualityScore = 0;
  let analyzedCount = 0;

  for (const idx of indices) {
    const file = files[idx];
    const filepath = file.originalFilepath || file.relativePath || "";

    if (!filepath) continue;

    try {
      const quality = await analyzeImageQuality(filepath);
      analyzedCount++;

      if (quality.blur === "high") stats.blurryImages++;
      if (quality.contrast === "low") stats.lowContrastImages++;
      if (quality.brightness < 30 || quality.brightness > 220)
        stats.poorBrightnessImages++;

      // Score: 3=good, 2=fair, 1=poor
      const score =
        quality.estimatedQuality === "good"
          ? 3
          : quality.estimatedQuality === "fair"
            ? 2
            : 1;
      totalQualityScore += score;
    } catch (err) {
      logger.debug(`Failed to analyze quality for ${filepath}: ${err.message}`);
    }
  }

  // ── Infer batch quality from sample ──────────────────────────────────────
  const avgQualityScore =
    analyzedCount > 0 ? totalQualityScore / analyzedCount : 2;
  let batchQuality = "fair";

  if (avgQualityScore >= 2.8) {
    batchQuality = "excellent";
  } else if (avgQualityScore >= 2.3) {
    batchQuality = "good";
  } else if (avgQualityScore >= 1.8) {
    batchQuality = "fair";
  } else {
    batchQuality = "poor";
  }

  // ── Generate warnings ────────────────────────────────────────────────────
  const blurryPercent = (stats.blurryImages / Math.max(1, analyzedCount)) * 100;
  const lowContrastPercent =
    (stats.lowContrastImages / Math.max(1, analyzedCount)) * 100;
  const poorBrightnessPercent =
    (stats.poorBrightnessImages / Math.max(1, analyzedCount)) * 100;

  if (blurryPercent > 20) {
    warnings.push(`~${Math.round(blurryPercent)}% of images are blurry.`);
    recommendations.push(
      `OCR accuracy will be reduced on blurry images. Page detection may fail.`,
    );
  }

  if (lowContrastPercent > 20) {
    warnings.push(
      `~${Math.round(lowContrastPercent)}% of images have low contrast.`,
    );
    recommendations.push(
      `Ensure images have sufficient contrast for text readability.`,
    );
  }

  if (poorBrightnessPercent > 20) {
    warnings.push(
      `~${Math.round(poorBrightnessPercent)}% of images have poor brightness.`,
    );
    recommendations.push(`Images should not be too dark or too bright.`);
  }

  if (batchQuality === "poor" && warnings.length === 0) {
    warnings.push(`Overall batch quality is poor.`);
    recommendations.push(
      `Consider re-scanning or retaking photos with better lighting/focus.`,
    );
  }

  return {
    batchQuality,
    poorQualityCount:
      stats.blurryImages + stats.lowContrastImages + stats.poorBrightnessImages,
    warnings,
    recommendations,
    stats,
  };
}

/**
 * Determine if processing should proceed or warn user.
 *
 * @param {Object} qualityAnalysis
 * @returns {{ shouldProceed: boolean, severityLevel: "info" | "warning" | "error" }}
 */
function assessProceedability(qualityAnalysis) {
  const { batchQuality, warnings } = qualityAnalysis;

  if (batchQuality === "poor" && warnings.length > 2) {
    return { shouldProceed: true, severityLevel: "error" }; // Proceed but high risk
  } else if (batchQuality === "fair" && warnings.length > 0) {
    return { shouldProceed: true, severityLevel: "warning" };
  } else {
    return { shouldProceed: true, severityLevel: "info" };
  }
}

module.exports = {
  analyzeImageQuality,
  analyzeBatch,
  assessProceedability,
};
