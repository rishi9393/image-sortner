/**
 * AI Page Detection Service
 *
 * Uses Google Gemini Vision to read page numbers from images.
 * Sends ALL images in a SINGLE request so the AI has full context
 * (it can see all pages together and infer the correct order even
 * when some page numbers are hard to read).
 *
 * Falls back gracefully when no API key is configured.
 */

"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs     = require("fs");
const path   = require("path");
const logger = require("../utils/logger");

// ── Config ────────────────────────────────────────────────────────────────────

const API_KEY    = process.env.GEMINI_API_KEY || "";
const MODEL_NAME = process.env.GEMINI_MODEL   || "gemini-2.0-flash";
const TIMEOUT_MS = 60_000; // 60s for batch request

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAvailable() {
  return API_KEY.length > 0;
}

/**
 * Convert an image file to a Gemini-compatible inline data part.
 */
function _fileToGenerativePart(filePath) {
  const data     = fs.readFileSync(filePath);
  const ext      = path.extname(filePath).toLowerCase();
  const mimeMap  = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
  const mimeType = mimeMap[ext] || "image/jpeg";
  return {
    inlineData: {
      data:     data.toString("base64"),
      mimeType,
    },
  };
}

// ── Main: Batch detection ─────────────────────────────────────────────────────

const PROMPT = `You are an expert at reading handwritten and printed documents.

I am giving you {{COUNT}} images of note pages (could be handwritten or printed).
They are currently in RANDOM order and I need to sort them by page number.

For EACH image (Image 1 through Image {{COUNT}}), determine the page number written on that page.

Look carefully for:
- Numbers written anywhere: top, bottom, corners, margins, header, footer
- Handwritten page numbers (1, 2, 3, etc.)
- Printed page numbers in any format: "Page 3", "Pg 2", "#3", "-3-", "(3)", "3/10", etc.
- Roman numerals (i, ii, iii, iv, etc.)
- If there's no explicit page number, try to infer the order from content (introduction = page 1, conclusion = last page, etc.)

IMPORTANT RULES:
- Return ONLY a valid JSON array of numbers, nothing else
- The array must have exactly {{COUNT}} elements (one per image)
- Use the detected/inferred page number as an integer (1-based)
- Use null ONLY if you truly have zero clue about the page order
- Do NOT wrap in markdown code blocks, just raw JSON

Example response for 4 images: [3, 1, 4, 2]`;

/**
 * Send all images to Gemini Vision and get page numbers back.
 *
 * @param {{ filePath: string, originalName: string }[]} files
 * @returns {Promise<{ pageNumbers: (number|null)[], confidence: number, model: string } | null>}
 */
async function detectPageNumbers(files) {
  if (!isAvailable()) {
    logger.debug("AI page detection: no GEMINI_API_KEY configured — skipping.");
    return null;
  }

  if (!files || files.length === 0) return null;

  const n = files.length;
  logger.info(`AI page detection: sending ${n} images to ${MODEL_NAME}…`);
  const t0 = Date.now();

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // Build the prompt
    const prompt = PROMPT.replace(/\{\{COUNT\}\}/g, String(n));

    // Build content parts: prompt + all images
    const parts = [{ text: prompt }];

    for (let i = 0; i < n; i++) {
      parts.push({ text: `\n--- Image ${i + 1} (${files[i].originalName}) ---` });
      try {
        parts.push(_fileToGenerativePart(files[i].filePath));
      } catch (err) {
        logger.warn(`AI: failed to read image ${files[i].originalName}: ${err.message}`);
        parts.push({ text: `[Image ${i + 1} could not be loaded]` });
      }
    }

    // Call Gemini with timeout
    const resultPromise = model.generateContent(parts);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini request timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
    );

    const result   = await Promise.race([resultPromise, timeoutPromise]);
    const response = result.response;
    const text     = response.text().trim();

    logger.info(`AI page detection: response received in ${Date.now() - t0}ms`);
    logger.debug(`AI raw response: ${text}`);

    // Parse the JSON array
    const pageNumbers = _parseResponse(text, n);

    if (!pageNumbers) {
      logger.warn("AI page detection: could not parse response as valid page numbers.");
      return null;
    }

    // Validate: check that we got reasonable results
    const validCount = pageNumbers.filter((p) => p !== null).length;
    const coverage   = validCount / n;

    if (coverage < 0.3) {
      logger.warn(`AI page detection: too few results (${validCount}/${n}) — discarding.`);
      return null;
    }

    logger.info(
      `AI page detection: success! Pages: [${pageNumbers.join(", ")}] ` +
      `(${validCount}/${n} detected, ${(coverage * 100).toFixed(0)}% coverage)`
    );

    return {
      pageNumbers,
      confidence: 0.92,  // AI vision is highly reliable
      model:      MODEL_NAME,
      coverage,
    };

  } catch (err) {
    logger.error(`AI page detection failed: ${err.message}`);
    return null;
  }
}

/**
 * Parse the AI response text into an array of page numbers.
 * Handles various response formats the AI might return.
 */
function _parseResponse(text, expectedCount) {
  try {
    // Strip markdown code blocks if present
    let cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    // Find the JSON array in the response
    const arrayMatch = cleaned.match(/\[[\s\S]*?\]/);
    if (!arrayMatch) return null;

    const parsed = JSON.parse(arrayMatch[0]);

    if (!Array.isArray(parsed)) return null;
    if (parsed.length !== expectedCount) {
      logger.warn(`AI: expected ${expectedCount} elements, got ${parsed.length}`);
      // If close enough, pad or truncate
      if (parsed.length < expectedCount) {
        while (parsed.length < expectedCount) parsed.push(null);
      } else {
        parsed.length = expectedCount;
      }
    }

    // Normalize: convert to integers or null
    return parsed.map((val) => {
      if (val === null || val === undefined || val === "null" || val === "none") return null;
      const num = parseInt(String(val), 10);
      if (Number.isFinite(num) && num > 0 && num <= 999) return num;
      return null;
    });

  } catch (err) {
    logger.warn(`AI response parse error: ${err.message}`);
    return null;
  }
}

module.exports = { detectPageNumbers, isAvailable };
