/**
 * OCR Service  –  v3 (fast + cached)
 *
 * Improvements over v2:
 *
 *  1. DYNAMIC POOL SIZE
 *     Pool size is derived from os.cpus().length instead of being hardcoded
 *     at 3.  On a 4-core machine you get 3 workers; on an 8-core machine you
 *     get 7.  Bounded to [2, 10] so we never OOM on exotic hardware.
 *
 *  2. PER-FILE OCR CACHE
 *     Results are cached in an LRU Map keyed by  `<filePath>:<mtime>`.
 *     Re-sorting the same session (or a session with identical files) is
 *     instant — zero Tesseract calls.  Cache is bounded at MAX_CACHE_SIZE
 *     entries (~few MB of text at most).
 *
 *  3. FASTER IMAGE PRE-PROCESSING
 *     The old pipeline did:
 *       metadata → resize → metadata(resized) → extract×2 → composite   (6 ops)
 *     The new pipeline calculates resized dimensions mathematically and
 *     reads the original file only once per strip:
 *       metadata → parallel(resize+extract top, resize+extract bottom) → composite  (4 ops)
 *     Eliminates one full intermediate PNG buffer and one metadata round-trip.
 *
 *  4. PER-IMAGE TIMEOUT
 *     Each OCR call is wrapped with a 30-second timeout.  A blurry or
 *     corrupt image can no longer freeze the entire batch.
 */

"use strict";

const { createWorker } = require("tesseract.js");
const sharp  = require("sharp");
const fs     = require("fs");
const os     = require("os");
const path   = require("path");
const logger = require("../utils/logger");

// ── Configuration ─────────────────────────────────────────────────────────────

/** Number of Tesseract workers.  Scales with CPU cores; bounded [2, 10]. */
const POOL_SIZE     = Math.max(2, Math.min(os.cpus().length - 1, 10));

const MAX_OCR_WIDTH = 1200;   // px — resize wider images before OCR
const STRIP_RATIO   = 0.18;   // fraction of image height used for top/bottom strips
const MIN_STRIP_H   = 60;     // px — minimum strip height regardless of image size
const OCR_TIMEOUT   = 30_000; // ms — per-image OCR timeout

/** LRU cache: key → { text, confidence } */
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
    if (free) {
      free.busy = true;
      return Promise.resolve(free);
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(entry) {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next(entry);
    } else {
      entry.busy = false;
    }
  }

  async terminate() {
    await Promise.all(
      this.workers.map((e) => e.worker.terminate().catch(() => {}))
    );
    this.workers     = [];
    this.queue       = [];
    this.initialised = false;
    logger.info("OCR: worker pool shut down.");
  }
}

const pool = new WorkerPool();

async function initPool()     { await pool.init(); }
async function shutdownPool() { await pool.terminate(); }

// ── OCR Cache helpers ─────────────────────────────────────────────────────────

/**
 * Build a cache key from the file path + mtime so that
 * the same upload is never re-OCR'd within the same server session.
 * Returns null if the file cannot be stat'd.
 */
function _cacheKey(filePath) {
  try {
    const { mtimeMs } = fs.statSync(filePath);
    return `${filePath}:${mtimeMs}`;
  } catch {
    return null;
  }
}

function _cacheGet(key) {
  if (!key) return null;
  const hit = _ocrCache.get(key);
  if (!hit) return null;
  // LRU: move to end
  _ocrCache.delete(key);
  _ocrCache.set(key, hit);
  return hit;
}

function _cacheSet(key, value) {
  if (!key) return;
  if (_ocrCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry
    _ocrCache.delete(_ocrCache.keys().next().value);
  }
  _ocrCache.set(key, value);
}

// ── Image Pre-processing ──────────────────────────────────────────────────────

/**
 * Produce a small, OCR-optimised buffer from an image file.
 *
 * Algorithm (v3 — 4 sharp ops instead of 6)
 * ──────────────────────────────────────────
 *  1. Read original dimensions (1 metadata call)
 *  2. Calculate target dimensions mathematically (no second buffer needed)
 *  3. In parallel: resize+extract top strip  AND  resize+extract bottom strip
 *  4. Stack them on a white canvas with greyscale + normalise
 *
 * Falls back to the raw file path if Sharp fails.
 *
 * @param {string} imagePath
 * @returns {Promise<Buffer | string>}
 */
async function preprocessImage(imagePath) {
  try {
    // ── 1. Original dimensions (single metadata call) ───────────────────────
    const { width: origW, height: origH } = await sharp(imagePath).metadata();
    if (!origW || !origH) return imagePath;

    // ── 2. Calculate resized dimensions without an intermediate buffer ───────
    const scale   = Math.min(1, MAX_OCR_WIDTH / origW);
    const rW      = Math.round(origW * scale);
    const rH      = Math.round(origH * scale);
    const stripH  = Math.max(Math.floor(rH * STRIP_RATIO), MIN_STRIP_H);

    // ── 3. Short image — just resize + greyscale the whole thing ────────────
    if (stripH * 2 >= rH) {
      return await sharp(imagePath)
        .resize({ width: rW, withoutEnlargement: true })
        .greyscale()
        .normalise()
        .png()
        .toBuffer();
    }

    // ── 4. Extract top + bottom strips in PARALLEL from the original file ───
    //      No intermediate PNG buffer needed — sharp reads the source once per
    //      pipeline and the OS page cache makes the second read ~free.
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

    // ── 5. Composite strips onto a white canvas ──────────────────────────────
    return await sharp({
      create: {
        width:      rW,
        height:     stripH * 2 + 8,
        channels:   3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([
        { input: topBuf, top: 0,          left: 0 },
        { input: botBuf, top: stripH + 8, left: 0 },
      ])
      .greyscale()
      .normalise()
      .png()
      .toBuffer();

  } catch (err) {
    logger.warn(
      `OCR preprocess failed for ${path.basename(imagePath)}: ${err.message} — using original`
    );
    return imagePath;
  }
}

// ── OCR ───────────────────────────────────────────────────────────────────────

/**
 * Run OCR on a single image.
 *  • Checks the LRU cache first — zero Tesseract work if already seen.
 *  • Wraps the Tesseract call with a 30-second timeout to prevent hangs.
 *  • Uses the worker pool for concurrency control.
 *
 * @param {string} imagePath
 * @returns {Promise<{ text: string, confidence: number }>}
 */
async function extractText(imagePath) {
  // ── 1. Cache hit? ─────────────────────────────────────────────────────────
  const key    = _cacheKey(imagePath);
  const cached = _cacheGet(key);
  if (cached) {
    logger.debug(`OCR cache hit: ${path.basename(imagePath)}`);
    return cached;
  }

  // ── 2. Pool not ready? fall back to a one-off worker ─────────────────────
  if (!pool.initialised) {
    logger.warn("OCR: pool not initialised — using fallback single worker");
    return _extractTextDirect(imagePath);
  }

  // ── 3. Acquire a pooled worker ────────────────────────────────────────────
  const entry = await pool.acquire();
  try {
    const input = await preprocessImage(imagePath);

    // Wrap Tesseract in a timeout promise
    const ocrPromise = entry.worker.recognize(input);
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
 * Run OCR on many images concurrently.
 * Optionally accepts an `onProgress` callback fired after each image
 * completes — used by the SSE streaming endpoint.
 *
 * @param {string[]} imagePaths
 * @param {((done: number, total: number, filename: string) => void) | null} onProgress
 * @returns {Promise<Array<{ text: string, confidence: number }>>}
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

// ── Fallback (no pool) ────────────────────────────────────────────────────────

async function _extractTextDirect(imagePath) {
  let worker;
  try {
    worker = await createWorker("eng", 1, { logger: () => {} });
    const { data: { text, confidence } } = await worker.recognize(imagePath);
    return {
      text:       text ? text.trim() : "",
      confidence: typeof confidence === "number" ? confidence : 0,
    };
  } catch (err) {
    logger.warn(`OCR (direct) failed for ${path.basename(imagePath)}: ${err.message}`);
    return { text: "", confidence: 0 };
  } finally {
    if (worker) await worker.terminate().catch(() => {});
  }
}

/** Return current cache statistics (for health/debug endpoints). */
function getCacheStats() {
  return { size: _ocrCache.size, max: MAX_CACHE_SIZE };
}

module.exports = { initPool, shutdownPool, extractText, extractTextBatch, getCacheStats };
