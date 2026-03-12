/**
 * OCR Service
 * Extracts visible text from an image using Tesseract.js.
 * Creates one worker per call so we don't keep long-lived threads.
 */

const { createWorker } = require("tesseract.js");
const logger = require("../utils/logger");

/**
 * Run OCR on a single image file.
 *
 * @param {string} imagePath  Absolute path to the image
 * @returns {Promise<{ text: string, confidence: number }>}
 */
async function extractText(imagePath) {
  let worker = null;
  try {
    // createWorker(lang, oem, options)
    // Pass logger: null to suppress verbose internal logs
    worker = await createWorker("eng", 1, {
      logger: () => {}, // suppress per-progress logs
    });

    const {
      data: { text, confidence },
    } = await worker.recognize(imagePath);

    return {
      text: text ? text.trim() : "",
      confidence: typeof confidence === "number" ? confidence : 0,
    };
  } catch (err) {
    logger.warn(`OCR failed for ${imagePath}: ${err.message}`);
    return { text: "", confidence: 0 };
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (_) {
        // ignore termination errors
      }
    }
  }
}

/**
 * Run OCR on multiple images sequentially.
 * (Sequential keeps memory usage low; parallel risks RAM exhaustion for large batches.)
 *
 * @param {string[]} imagePaths
 * @returns {Promise<Array<{ text: string, confidence: number }>>}
 */
async function extractTextBatch(imagePaths) {
  const results = [];
  for (const imgPath of imagePaths) {
    // eslint-disable-next-line no-await-in-loop
    const result = await extractText(imgPath);
    results.push(result);
  }
  return results;
}

module.exports = { extractText, extractTextBatch };
