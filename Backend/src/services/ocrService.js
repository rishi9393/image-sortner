/**
 * OCR Service  –  v4 (full-image OCR + enhanced preprocessing)
 *
 * Changes from v3:
 *
 *  1. FULL-IMAGE OCR
 *     v3 only scanned top 18% + bottom 18% strips, composited together.
 *     This lost 64% of the image content and confused Tesseract with the
 *     artificial gap. v4 processes the FULL image, ensuring page numbers
 *     (especially handwritten ones in margins) are never missed.
 *
 *  2. ENHANCED PREPROCESSING
 *     Added sharpening (sigma 1.5) and adaptive thresholding-friendly
 *     normalisation. Significantly improves handwritten digit recognition.
 *
 *  3. PAGE-NUMBER-FOCUSED OCR
 *     Added extractPageRegions() that does high-resolution OCR on just
 *     the header/footer areas — used as a supplementary signal for
 *     page number detection when full-image OCR misses small numbers.
 *
 *  All other features (pool, cache, batch, timeout) unchanged from v3.
 */

"use strict";

const { createWorker } = require("tesseract.js");
const sharp  = require("sharp");
const fs     = require("fs");
const os     = require("os");
const path   = require("path");
const logger = require("../utils/logger");

// ── Configuration ─────────────────────────────────────────────────────────────

const POOL_SIZE     = Math.max(2, Math.min(os.cpus().length - 1, 10));
const MAX_OCR_WIDTH = 1200;
const OCR_TIMEOUT   = 30_000;

/** LRU cache */
const MAX_CACHE_SIZE = 500;
const _ocrCache = new Map();

// ── Worker Pool ───────────────────────────────────────────────────────────────

class WorkerPool {
  constructor() {
    this.workers     = [];
    this.queue       = [];
    this.initialised = false;
  }

  async init() {
    if (this.initialised) return;
    logger.info(`OCR: initialising worker pool (${POOL_SIZE} workers, ${os.cpus().length} CPU cores)…`);
    await Promise.all(
      Array.from({ length: POOL_SIZE }, () =>
        createWorker("eng", 1, { logger: () => {} })
          .then((w) => this.workers.push({ worker: w, busy: false }))
      )
    );
    this.initialised = true;
    logger.info("OCR: worker pool ready ✓");
  }

  acquire() {
    const free = this.workers.find((w) => !w.busy);
    if (free) { free.busy = true; return Promise.resolve(free); }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(entry) {
    if (this.queue.length > 0) { this.queue.shift()(entry); }
    else { entry.busy = false; }
  }

  async terminate() {
    await Promise.all(this.workers.map((e) => e.worker.terminate().catch(() => {})));
    this.workers = []; this.queue = []; this.initialised = false;
    logger.info("OCR: worker pool shut down.");
  }
}

const pool = new WorkerPool();
async function initPool()     { await pool.init(); }
async function shutdownPool() { await pool.terminate(); }

// ── OCR Cache helpers ─────────────────────────────────────────────────────────

function _cacheKey(filePath) {
  try { return `${filePath}:${fs.statSync(filePath).mtimeMs}`; }
  catch { return null; }
}

function _cacheGet(key) {
  if (!key) return null;
  const hit = _ocrCache.get(key);
  if (!hit) return null;
  _ocrCache.delete(key); _ocrCache.set(key, hit);
  return hit;
}

function _cacheSet(key, value) {
  if (!key) return;
  if (_ocrCache.size >= MAX_CACHE_SIZE) _ocrCache.delete(_ocrCache.keys().next().value);
  _ocrCache.set(key, value);
}

// ── Image Pre-processing (v4 — FULL IMAGE) ───────────────────────────────────

/**
 * v4: Process the FULL image instead of just header/footer strips.
 *
 * Pipeline:
 *  1. Resize to max 1200px wide (keeps OCR fast)
 *  2. Greyscale + normalise + sharpen (helps handwritten text)
 *  3. Return as PNG buffer for Tesseract
 *
 * @param {string} imagePath
 * @returns {Promise<Buffer | string>}
 */
async function preprocessImage(imagePath) {
  try {
    const { width: origW, height: origH } = await sharp(imagePath).metadata();
    if (!origW || !origH) return imagePath;

    const scale = Math.min(1, MAX_OCR_WIDTH / origW);
    const rW    = Math.round(origW * scale);

    return await sharp(imagePath)
      .resize({ width: rW, withoutEnlargement: true })
      .greyscale()
      .normalise()
      .sharpen({ sigma: 1.5 })
      .png()
      .toBuffer();
  } catch (err) {
    logger.warn(`OCR preprocess failed for ${path.basename(imagePath)}: ${err.message} — using original`);
    return imagePath;
  }
}

/**
 * High-resolution OCR of just the header + footer regions of an image.
 * Used as a SUPPLEMENTARY signal for page number detection.
 * Processes at higher resolution and with stronger contrast enhancement.
 *
 * @param {string} imagePath
 * @returns {Promise<Buffer | string>}
 */
async function preprocessPageNumberRegions(imagePath) {
  try {
    const { width: origW, height: origH } = await sharp(imagePath).metadata();
    if (!origW || !origH) return imagePath;

    // Use higher resolution for number detection (up to 1600px wide)
    const maxW   = 1600;
    const scale  = Math.min(1, maxW / origW);
    const rW     = Math.round(origW * scale);
    const rH     = Math.round(origH * scale);
    const stripH = Math.max(Math.floor(rH * 0.12), 80); // top/bottom 12%

    // If image is small, just return the full thing
    if (stripH * 2 >= rH) {
      return await sharp(imagePath)
        .resize({ width: rW, withoutEnlargement: true })
        .greyscale()
        .normalise()
        .sharpen({ sigma: 2.0 })
        .png()
        .toBuffer();
    }

    // Extract top and bottom strips at higher resolution
    const [topBuf, botBuf] = await Promise.all([
      sharp(imagePath)
        .resize({ width: rW, height: rH, fit: "fill" })
        .extract({ left: 0, top: 0, width: rW, height: stripH })
        .png()
        .toBuffer(),
      sharp(imagePath)
        .resize({ width: rW, height: rH, fit: "fill" })
        .extract({ left: 0, top: rH - stripH, width: rW, height: stripH })
        .png()
        .toBuffer(),
    ]);

    return await sharp({
      create: {
        width:      rW,
        height:     stripH * 2 + 20,
        channels:   3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([
        { input: topBuf, top: 0,           left: 0 },
        { input: botBuf, top: stripH + 20, left: 0 },
      ])
      .greyscale()
      .normalise()
      .sharpen({ sigma: 2.0 })
      .png()
      .toBuffer();
  } catch (err) {
    logger.warn(`Page-region preprocess failed: ${err.message}`);
    return imagePath;
  }
}

// ── OCR ───────────────────────────────────────────────────────────────────────

/**
 * Run OCR on a single image (full image).
 */
async function extractText(imagePath) {
  const key    = _cacheKey(imagePath);
  const cached = _cacheGet(key);
  if (cached) { logger.debug(`OCR cache hit: ${path.basename(imagePath)}`); return cached; }

  if (!pool.initialised) {
    logger.warn("OCR: pool not initialised — using fallback single worker");
    return _extractTextDirect(imagePath);
  }

  const entry = await pool.acquire();
  try {
    const input = await preprocessImage(imagePath);
    const ocrPromise     = entry.worker.recognize(input);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("OCR timed out after 30 s")), OCR_TIMEOUT)
    );
    const { data: { text, confidence } } = await Promise.race([ocrPromise, timeoutPromise]);
    const result = {
      text:       text ? text.trim() : "",
      confidence: typeof confidence === "number" ? confidence : 0,
    };
    _cacheSet(key, result);
    return result;
  } catch (err) {
    logger.warn(`OCR failed for ${path.basename(imagePath)}: ${err.message}`);
    return { text: "", confidence: 0 };
  } finally {
    pool.release(entry);
  }
}

/**
 * Run supplementary OCR on header/footer regions for page number detection.
 * Returns text from just the top/bottom of the image at higher resolution.
 */
async function extractPageRegionText(imagePath) {
  const cacheKeyStr = _cacheKey(imagePath);
  const regionKey   = cacheKeyStr ? `${cacheKeyStr}:regions` : null;
  const cached      = _cacheGet(regionKey);
  if (cached) return cached;

  if (!pool.initialised) return { text: "", confidence: 0 };

  const entry = await pool.acquire();
  try {
    const input = await preprocessPageNumberRegions(imagePath);
    const ocrPromise     = entry.worker.recognize(input);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Region OCR timed out")), OCR_TIMEOUT)
    );
    const { data: { text, confidence } } = await Promise.race([ocrPromise, timeoutPromise]);
    const result = {
      text:       text ? text.trim() : "",
      confidence: typeof confidence === "number" ? confidence : 0,
    };
    _cacheSet(regionKey, result);
    return result;
  } catch (err) {
    logger.warn(`Region OCR failed for ${path.basename(imagePath)}: ${err.message}`);
    return { text: "", confidence: 0 };
  } finally {
    pool.release(entry);
  }
}

/**
 * Run OCR on many images concurrently.
 */
async function extractTextBatch(imagePaths, onProgress = null) {
  let done = 0;
  return Promise.all(
    imagePaths.map((p) =>
      extractText(p).then((result) => {
        done++;
        if (onProgress) onProgress(done, imagePaths.length, path.basename(p));
        return result;
      })
    )
  );
}

/**
 * Run supplementary page-region OCR on many images concurrently.
 */
async function extractPageRegionTextBatch(imagePaths) {
  return Promise.all(imagePaths.map((p) => extractPageRegionText(p)));
}

// ── Fallback ──────────────────────────────────────────────────────────────────

async function _extractTextDirect(imagePath) {
  let worker;
  try {
    worker = await createWorker("eng", 1, { logger: () => {} });
    const input = await preprocessImage(imagePath);
    const { data: { text, confidence } } = await worker.recognize(input);
    return { text: text ? text.trim() : "", confidence: typeof confidence === "number" ? confidence : 0 };
  } catch (err) {
    logger.warn(`OCR (direct) failed for ${path.basename(imagePath)}: ${err.message}`);
    return { text: "", confidence: 0 };
  } finally {
    if (worker) await worker.terminate().catch(() => {});
  }
}

function getCacheStats() { return { size: _ocrCache.size, max: MAX_CACHE_SIZE }; }

module.exports = {
  initPool, shutdownPool,
  extractText, extractTextBatch,
  extractPageRegionText, extractPageRegionTextBatch,
  getCacheStats,
};
