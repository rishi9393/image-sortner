/**
 * OCR Service  –  v2 (fast)
 *
 * Key optimisations vs v1:
 *
 *  1. WORKER POOL
 *     Instead of spinning up a fresh Tesseract WASM engine for every image
 *     (1-3 s overhead each), we create POOL_SIZE workers once at startup and
 *     reuse them.  Excess requests queue automatically and are served as soon
 *     as a worker becomes free.
 *
 *  2. SMART IMAGE PRE-PROCESSING  (via sharp)
 *     • Resize to ≤ MAX_OCR_WIDTH pixels wide   → far fewer pixels to scan
 *     • Extract top + bottom strips only         → page numbers live in
 *       headers / footers; the middle is usually irrelevant for page detection
 *     • Greyscale + normalise                    → better OCR accuracy on
 *       low-contrast / shadowed photos
 *
 *  3. CONCURRENT BATCH
 *     extractTextBatch() fires all images at once; the pool queues any
 *     requests beyond POOL_SIZE so memory stays bounded.
 */

"use strict";

const { createWorker } = require("tesseract.js");
const sharp = require("sharp");
const path = require("path");
const logger = require("../utils/logger");

// ── Configuration ─────────────────────────────────────────────────────────────

const POOL_SIZE     = 3;    // concurrent Tesseract workers kept alive
const MAX_OCR_WIDTH = 1200; // px — resize wider images before OCR
const STRIP_RATIO   = 0.18; // fraction of image height used for top/bottom strips
const MIN_STRIP_H   = 60;   // px — minimum strip height regardless of image size

// ── Worker Pool ───────────────────────────────────────────────────────────────

class WorkerPool {
  constructor() {
    /** @type {Array<{ worker: import('tesseract.js').Worker, busy: boolean }>} */
    this.workers     = [];
    /** @type {Array<(entry: { worker: any, busy: boolean }) => void>} */
    this.queue       = [];
    this.initialised = false;
  }

  /** Create all workers in parallel. Call once at startup. */
  async init() {
    if (this.initialised) return;
    logger.info(`OCR: initialising worker pool (${POOL_SIZE} workers)…`);

    await Promise.all(
      Array.from({ length: POOL_SIZE }, () =>
        createWorker("eng", 1, { logger: () => {} })
          .then((w) => this.workers.push({ worker: w, busy: false }))
      )
    );

    this.initialised = true;
    logger.info("OCR: worker pool ready ✓");
  }

  /**
   * Acquire a free worker.
   * If all workers are busy the caller is queued and will be unblocked
   * the moment one is released.
   * @returns {Promise<{ worker: any, busy: boolean }>}
   */
  acquire() {
    const free = this.workers.find((w) => !w.busy);
    if (free) {
      free.busy = true;
      return Promise.resolve(free);
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  /**
   * Release a worker back to the pool.
   * If callers are queued the worker is handed directly to the next one
   * (stays busy) so there is no gap between jobs.
   * @param {{ worker: any, busy: boolean }} entry
   */
  release(entry) {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next(entry); // busy flag stays true — handed straight to next waiter
    } else {
      entry.busy = false;
    }
  }

  /** Terminate all workers (call on graceful shutdown). */
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

// Singleton — shared across all requests
const pool = new WorkerPool();

/**
 * Warm up the worker pool.  Must be called once at server startup before
 * the first request arrives so that the first upload doesn't pay the
 * initialisation cost.
 */
async function initPool() {
  await pool.init();
}

/** Tear down all workers.  Call on SIGTERM / SIGINT. */
async function shutdownPool() {
  await pool.terminate();
}

// ── Image Pre-processing ──────────────────────────────────────────────────────

/**
 * Produce a small, OCR-optimised image buffer from a file path.
 *
 * Algorithm
 * ─────────
 *  1. Resize to ≤ MAX_OCR_WIDTH (proportional, no upscaling)
 *  2. Extract the top STRIP_RATIO and bottom STRIP_RATIO strips
 *  3. Stack them on a white canvas with an 8-px gap
 *  4. Apply greyscale + normalise for contrast enhancement
 *
 * The resulting image is tiny (typically < 60 KB) yet preserves every pixel
 * that could contain a page-number or header/footer.
 *
 * Falls back to the original file path if Sharp fails for any reason.
 *
 * @param {string} imagePath
 * @returns {Promise<Buffer | string>}
 */
async function preprocessImage(imagePath) {
  try {
    // ── 1. Read original dimensions ─────────────────────────────────────────
    const origMeta = await sharp(imagePath).metadata();
    if (!origMeta.width || !origMeta.height) return imagePath;

    const targetWidth = Math.min(origMeta.width, MAX_OCR_WIDTH);

    // ── 2. Resize to working size (PNG to preserve quality) ─────────────────
    const resizedBuf = await sharp(imagePath)
      .resize({ width: targetWidth, withoutEnlargement: true })
      .png()
      .toBuffer();

    const { width: rW, height: rH } = await sharp(resizedBuf).metadata();
    const stripH = Math.max(Math.floor(rH * STRIP_RATIO), MIN_STRIP_H);

    // ── 3. If image is too short for two strips, use the full resized image ──
    if (stripH * 2 >= rH) {
      return await sharp(resizedBuf)
        .greyscale()
        .normalise()
        .png()
        .toBuffer();
    }

    // ── 4. Extract top + bottom strips in parallel ───────────────────────────
    const [topBuf, botBuf] = await Promise.all([
      sharp(resizedBuf)
        .extract({ left: 0, top: 0, width: rW, height: stripH })
        .png()
        .toBuffer(),
      sharp(resizedBuf)
        .extract({ left: 0, top: rH - stripH, width: rW, height: stripH })
        .png()
        .toBuffer(),
    ]);

    // ── 5. Stack strips on a white canvas (top | 8px gap | bottom) ───────────
    const combinedBuf = await sharp({
      create: {
        width:      rW,
        height:     stripH * 2 + 8,
        channels:   3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([
        { input: topBuf, top: 0,            left: 0 },
        { input: botBuf, top: stripH + 8,   left: 0 },
      ])
      .greyscale()
      .normalise()
      .png()
      .toBuffer();

    return combinedBuf;
  } catch (err) {
    logger.warn(
      `OCR preprocess failed for ${path.basename(imagePath)}: ${err.message} — using original`
    );
    return imagePath; // graceful fallback
  }
}

// ── OCR ───────────────────────────────────────────────────────────────────────

/**
 * Run OCR on a single image using a pooled worker.
 *
 * @param {string} imagePath  Absolute path to the image file
 * @returns {Promise<{ text: string, confidence: number }>}
 */
async function extractText(imagePath) {
  // Safety net: if pool is not ready (e.g. tests) fall back to a one-off worker
  if (!pool.initialised) {
    logger.warn("OCR: pool not initialised — using fallback single worker");
    return _extractTextDirect(imagePath);
  }

  const entry = await pool.acquire();
  try {
    const input = await preprocessImage(imagePath);
    const {
      data: { text, confidence },
    } = await entry.worker.recognize(input);

    return {
      text:       text ? text.trim() : "",
      confidence: typeof confidence === "number" ? confidence : 0,
    };
  } catch (err) {
    logger.warn(
      `OCR failed for ${path.basename(imagePath)}: ${err.message}`
    );
    return { text: "", confidence: 0 };
  } finally {
    pool.release(entry);
  }
}

/**
 * Run OCR on many images concurrently.
 * All requests are fired at once; the pool queues any beyond POOL_SIZE
 * so memory stays bounded.
 *
 * @param {string[]} imagePaths
 * @returns {Promise<Array<{ text: string, confidence: number }>>}
 */
async function extractTextBatch(imagePaths) {
  return Promise.all(imagePaths.map((p) => extractText(p)));
}

// ── Fallback (no pool) ────────────────────────────────────────────────────────

/** One-off worker, used only when the pool is unavailable. */
async function _extractTextDirect(imagePath) {
  let worker;
  try {
    worker = await createWorker("eng", 1, { logger: () => {} });
    const {
      data: { text, confidence },
    } = await worker.recognize(imagePath);
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

module.exports = { initPool, shutdownPool, extractText, extractTextBatch };
