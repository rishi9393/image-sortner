/**
 * AI Page Detection Service  –  v2 (Enhanced Prompt + Two-Pass Verification)
 *
 * Major improvements over v1:
 *
 *  1. ENHANCED PROMPT (chain-of-thought, few-shot examples)
 *     - Asks the model to REASON step-by-step before answering
 *     - Provides few-shot examples of what to look for
 *     - Asks for per-image confidence levels
 *     - Instructs content-based ordering when no page numbers visible
 *
 *  2. TWO-PASS VERIFICATION
 *     - Pass 1: Detect page numbers / infer order from all images
 *     - Pass 2: Given the proposed order, verify by checking content flow
 *       and correct any mistakes (e.g., "6" misread as "9")
 *
 *  3. PER-IMAGE CONFIDENCE
 *     - Model returns confidence per image (high/medium/low)
 *     - Used downstream for smarter signal fusion
 *
 *  4. STRUCTURED OUTPUT
 *     - Uses JSON response format for reliable parsing
 */

"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs     = require("fs");
const path   = require("path");
const logger = require("../utils/logger");

// ── Config ────────────────────────────────────────────────────────────────────

const API_KEY    = process.env.GEMINI_API_KEY || "";
const MODEL_NAME = process.env.GEMINI_MODEL   || "gemini-2.0-flash";
const TIMEOUT_MS      = 90_000; // 90s for pass 1 (more images = more time)
const VERIFY_TIMEOUT  = 60_000; // 60s for pass 2 verification

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
  const mimeMap  = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png",  ".webp": "image/webp",
    ".gif": "image/gif",  ".bmp":  "image/bmp",
  };
  const mimeType = mimeMap[ext] || "image/jpeg";
  return {
    inlineData: {
      data:     data.toString("base64"),
      mimeType,
    },
  };
}

function _getGenAI() {
  return new GoogleGenerativeAI(API_KEY);
}

// ══════════════════════════════════════════════════════════════════════════════
// PASS 1 — Enhanced page number detection with chain-of-thought
// ══════════════════════════════════════════════════════════════════════════════

const PASS1_PROMPT = `You are a world-class document analysis expert specializing in reading handwritten and printed notes.

## YOUR TASK
I am giving you {{COUNT}} images of note pages (handwritten or printed). They are currently in RANDOM/SHUFFLED order. I need you to determine the correct page number for each image so I can sort them.

## HOW TO ANALYZE EACH IMAGE — Think step by step:

### Step 1: Look for EXPLICIT page numbers
Search every corner, margin, header, and footer of each image for:
- Handwritten numbers: "1", "2", "3" (often in top-right, bottom-center, or top-left corners)
- Printed formats: "Page 3", "Pg 2", "P. 4", "#3", "-3-", "(3)", "[3]", "3/10", "3 of 10"
- Roman numerals: "i", "ii", "iii", "iv", "v" (convert to integers: i=1, ii=2, etc.)
- Circled or boxed numbers in margins
- Numbers written at an angle in corners

### Step 2: If no explicit page number, INFER from content
- Title pages, introductions, "Chapter 1", table of contents → early pages (1, 2, 3)
- Conclusions, summaries, bibliographies, "The End" → last pages
- Topic progression: basics/definitions appear before advanced/applied content
- Numbered problems/exercises: Q1-Q5 on one page suggests it comes before Q6-Q10
- Cross-references: "as discussed earlier" = later page; "we will see" = earlier page
- Continuation markers: "contd...", "contd from prev page" = comes after another page

### Step 3: Use RELATIONSHIPS between images
- If Image A ends mid-sentence and Image B starts completing that sentence → A comes before B
- If two images discuss the same sub-topic, they are likely consecutive
- Handwriting style consistency helps group pages from the same section

## FEW-SHOT EXAMPLES

Example 1 — 3 images with visible page numbers:
Image 1 shows "2" written in top-right corner, content about cell division
Image 2 shows "Page 1" printed at bottom, content about cell structure
Image 3 shows a circled "3" at bottom-center, content about cell reproduction
→ Result: [2, 1, 3] with all high confidence

Example 2 — 4 images, mixed signals:
Image 1: No number visible, discusses "Introduction to Thermodynamics"
Image 2: "3" barely visible in corner, discusses entropy
Image 3: "2" in top-right, discusses laws of thermodynamics  
Image 4: No number, has "Conclusion" and "Summary" at top
→ Result: [1, 3, 2, 4] — Image 1 is inferred as page 1 (intro), Image 4 as page 4 (conclusion)

## OUTPUT FORMAT
Return a JSON object (no markdown, no code blocks) with this exact structure:
{
  "pages": [
    {"image": 1, "page_number": 2, "confidence": "high", "reason": "Number '2' visible in top-right corner"},
    {"image": 2, "page_number": 1, "confidence": "high", "reason": "Printed 'Page 1' at bottom of page"},
    {"image": 3, "page_number": 3, "confidence": "medium", "reason": "Inferred from content: continues topic from page 2"}
  ]
}

CONFIDENCE LEVELS:
- "high" = Page number clearly visible OR very strong content evidence
- "medium" = Number partially visible, or moderate content-based inference
- "low" = Best guess based on limited evidence

RULES:
- The "pages" array must have exactly {{COUNT}} entries (one per image)
- page_number must be a positive integer (1-based) or null if truly impossible
- Every page_number should ideally be unique (no duplicates unless truly same page)
- Prefer assigning a sequential range (1 to N) when evidence supports it
- ALWAYS provide a reason — this helps me verify your work`;


// ══════════════════════════════════════════════════════════════════════════════
// PASS 2 — Verification: check content flow in proposed order
// ══════════════════════════════════════════════════════════════════════════════

const PASS2_PROMPT = `You are a document ordering verification expert.

## CONTEXT
I have {{COUNT}} images of note pages. A first-pass analysis proposed this page order:
{{PROPOSED_ORDER}}

## YOUR TASK
Look at all {{COUNT}} images again IN THE PROPOSED ORDER and verify whether the content flows logically.

Check for:
1. Does the text/content flow naturally from one page to the next?
2. Are there any sentences that start on one page and continue on the next — do they match up?
3. Do topics progress logically (introduction → details → conclusion)?
4. Could any two adjacent pages be swapped to improve the flow?
5. Were any page numbers possibly misread? (e.g., "6" vs "9", "1" vs "7", "2" vs "Z")

## OUTPUT FORMAT
Return a JSON object (no markdown, no code blocks):
{
  "verified": true,
  "corrections": [],
  "final_order": [1, 2, 3, 4],
  "confidence": "high",
  "reasoning": "Content flows logically. Page 1 introduces the topic, pages 2-3 develop it, page 4 concludes."
}

If corrections are needed:
{
  "verified": false,
  "corrections": [
    {"swap": [2, 3], "reason": "Page 2 ends with 'the result is' and page 4 starts with 'therefore 42', while page 3 starts a new topic — pages 3 and 2 should be swapped"}
  ],
  "final_order": [1, 3, 2, 4],
  "confidence": "medium",
  "reasoning": "Swapped images 2 and 3 because content flows better in new order."
}

RULES:
- "final_order" must contain exactly {{COUNT}} integers representing the page number for each image (index 1 = Image 1)
- Only suggest corrections if you are reasonably confident they improve the order
- If the proposed order looks correct, return verified: true with the same order`;


// ══════════════════════════════════════════════════════════════════════════════
// Main: Two-pass detection
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Send all images to Gemini Vision — two-pass approach:
 *   Pass 1: Detect page numbers with chain-of-thought reasoning
 *   Pass 2: Verify the proposed order by checking content flow
 *
 * @param {{ filePath: string, originalName: string }[]} files
 * @returns {Promise<{ pageNumbers: (number|null)[], confidence: number, perImageConfidence: string[], model: string, verified: boolean } | null>}
 */
async function detectPageNumbers(files) {
  if (!isAvailable()) {
    logger.debug("AI page detection: no GEMINI_API_KEY configured — skipping.");
    return null;
  }

  if (!files || files.length === 0) return null;

  const n = files.length;

  // ── Build image parts (shared between both passes) ────────────────────────
  const imageParts = [];
  for (let i = 0; i < n; i++) {
    try {
      imageParts.push({
        label: `Image ${i + 1} (${files[i].originalName})`,
        part:  _fileToGenerativePart(files[i].filePath),
      });
    } catch (err) {
      logger.warn(`AI: failed to read image ${files[i].originalName}: ${err.message}`);
      imageParts.push({ label: `Image ${i + 1} (${files[i].originalName})`, part: null });
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PASS 1 — Detect page numbers
  // ════════════════════════════════════════════════════════════════════════════
  logger.info(`AI Pass 1: sending ${n} images to ${MODEL_NAME} for page detection…`);
  const t0 = Date.now();

  let pass1Result;
  try {
    pass1Result = await _runPass1(imageParts, n);
  } catch (err) {
    logger.error(`AI Pass 1 failed: ${err.message}`);
    return null;
  }

  if (!pass1Result) {
    logger.warn("AI Pass 1: could not extract valid page numbers.");
    return null;
  }

  const { pageNumbers, perImageConfidence, reasons } = pass1Result;
  const validCount = pageNumbers.filter((p) => p !== null).length;
  const coverage   = validCount / n;

  logger.info(
    `AI Pass 1 complete in ${Date.now() - t0}ms — Pages: [${pageNumbers.join(", ")}] ` +
    `(${validCount}/${n} detected, ${(coverage * 100).toFixed(0)}% coverage)`
  );

  if (coverage < 0.3) {
    logger.warn(`AI Pass 1: too few results (${validCount}/${n}) — discarding.`);
    return null;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PASS 2 — Verify order by content flow (only if we have enough pages)
  // ════════════════════════════════════════════════════════════════════════════
  let verified = false;
  let finalPageNumbers = pageNumbers;
  let overallConfidence = _computeOverallConfidence(perImageConfidence, coverage);

  if (n >= 3 && coverage >= 0.5) {
    logger.info(`AI Pass 2: verifying proposed order…`);
    const t1 = Date.now();

    try {
      const pass2Result = await _runPass2(imageParts, n, pageNumbers);

      if (pass2Result) {
        logger.info(`AI Pass 2 complete in ${Date.now() - t1}ms — verified: ${pass2Result.verified}`);

        if (pass2Result.verified) {
          verified = true;
          // Boost confidence when verification confirms the order
          overallConfidence = Math.min(1.0, overallConfidence + 0.05);
        } else if (pass2Result.finalOrder && pass2Result.finalOrder.length === n) {
          // Apply corrections
          const correctedValid = pass2Result.finalOrder.filter((p) => p !== null).length;
          if (correctedValid >= validCount) {
            logger.info(`AI Pass 2: applying corrections → [${pass2Result.finalOrder.join(", ")}]`);
            finalPageNumbers = pass2Result.finalOrder;
            verified = true;
          } else {
            logger.warn("AI Pass 2: corrections reduced coverage — keeping Pass 1 result.");
          }
        }

        if (pass2Result.reasoning) {
          logger.info(`AI Pass 2 reasoning: ${pass2Result.reasoning}`);
        }
      }
    } catch (err) {
      logger.warn(`AI Pass 2 failed (non-fatal): ${err.message} — using Pass 1 result.`);
    }
  } else {
    logger.debug(`AI Pass 2: skipped (n=${n}, coverage=${(coverage * 100).toFixed(0)}%)`);
  }

  logger.info(
    `AI final result: [${finalPageNumbers.join(", ")}] ` +
    `confidence=${overallConfidence.toFixed(2)}, verified=${verified}`
  );

  return {
    pageNumbers:       finalPageNumbers,
    confidence:        overallConfidence,
    perImageConfidence,
    reasons,
    model:             MODEL_NAME,
    coverage:          finalPageNumbers.filter((p) => p !== null).length / n,
    verified,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Pass 1 Implementation
// ══════════════════════════════════════════════════════════════════════════════

async function _runPass1(imageParts, n) {
  const genAI = _getGenAI();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.1,  // Low temperature for factual extraction
    },
  });

  const prompt = PASS1_PROMPT.replace(/\{\{COUNT\}\}/g, String(n));

  // Build content: prompt + all images with labels
  const parts = [{ text: prompt }];
  for (let i = 0; i < n; i++) {
    parts.push({ text: `\n--- ${imageParts[i].label} ---` });
    if (imageParts[i].part) {
      parts.push(imageParts[i].part);
    } else {
      parts.push({ text: `[Image ${i + 1} could not be loaded]` });
    }
  }

  const resultPromise  = model.generateContent(parts);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Pass 1 timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
  );

  const result   = await Promise.race([resultPromise, timeoutPromise]);
  const response = result.response;
  const text     = response.text().trim();

  logger.debug(`AI Pass 1 raw response:\n${text}`);

  return _parsePass1Response(text, n);
}

function _parsePass1Response(text, expectedCount) {
  try {
    // Strip markdown code blocks
    let cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    // Try to find a JSON object first
    let parsed;
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        parsed = JSON.parse(objMatch[0]);
      } catch {
        // Try fixing common JSON issues (trailing commas, etc.)
        const fixed = objMatch[0]
          .replace(/,\s*}/g, "}")
          .replace(/,\s*]/g, "]");
        parsed = JSON.parse(fixed);
      }
    }

    if (!parsed || !parsed.pages || !Array.isArray(parsed.pages)) {
      // Fallback: try to find a plain JSON array (backward compat with v1 format)
      const arrayMatch = cleaned.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        const arr = JSON.parse(arrayMatch[0]);
        if (Array.isArray(arr)) {
          return _normalizeSimpleArray(arr, expectedCount);
        }
      }
      return null;
    }

    // Parse the structured response
    const pages = parsed.pages;
    const pageNumbers       = new Array(expectedCount).fill(null);
    const perImageConfidence = new Array(expectedCount).fill("low");
    const reasons           = new Array(expectedCount).fill("");

    for (const entry of pages) {
      const imgIdx = (parseInt(String(entry.image), 10) || 0) - 1; // 1-based → 0-based
      if (imgIdx < 0 || imgIdx >= expectedCount) continue;

      const num = entry.page_number === null || entry.page_number === undefined
        ? null
        : parseInt(String(entry.page_number), 10);

      pageNumbers[imgIdx] = (Number.isFinite(num) && num > 0 && num <= 999) ? num : null;
      perImageConfidence[imgIdx] = _normalizeConfidence(entry.confidence);
      reasons[imgIdx] = String(entry.reason || "");
    }

    return { pageNumbers, perImageConfidence, reasons };

  } catch (err) {
    logger.warn(`AI Pass 1 parse error: ${err.message}`);

    // Last resort: try to extract just a JSON array from anywhere in the text
    try {
      const arrayMatch = text.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        const arr = JSON.parse(arrayMatch[0]);
        if (Array.isArray(arr)) return _normalizeSimpleArray(arr, expectedCount);
      }
    } catch { /* ignore */ }

    return null;
  }
}

/** Backward-compat: convert a plain [3, 1, 4, 2] array to structured result */
function _normalizeSimpleArray(arr, expectedCount) {
  // Pad or truncate
  while (arr.length < expectedCount) arr.push(null);
  if (arr.length > expectedCount) arr.length = expectedCount;

  const pageNumbers = arr.map((val) => {
    if (val === null || val === undefined) return null;
    const num = parseInt(String(val), 10);
    return (Number.isFinite(num) && num > 0 && num <= 999) ? num : null;
  });

  return {
    pageNumbers,
    perImageConfidence: pageNumbers.map((p) => p !== null ? "medium" : "low"),
    reasons:           pageNumbers.map(() => ""),
  };
}

function _normalizeConfidence(conf) {
  if (!conf) return "low";
  const c = String(conf).toLowerCase().trim();
  if (c === "high" || c === "h")   return "high";
  if (c === "medium" || c === "med" || c === "m") return "medium";
  return "low";
}

// ══════════════════════════════════════════════════════════════════════════════
// Pass 2 Implementation — Verification
// ══════════════════════════════════════════════════════════════════════════════

async function _runPass2(imageParts, n, proposedPageNumbers) {
  const genAI = _getGenAI();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.1,
    },
  });

  // Build the proposed order description
  const orderLines = [];
  // Create pairs of (pageNumber, imageIndex) and sort by page number
  const sortable = proposedPageNumbers
    .map((pn, idx) => ({ pn, idx }))
    .filter((e) => e.pn !== null)
    .sort((a, b) => a.pn - b.pn);

  const nullEntries = proposedPageNumbers
    .map((pn, idx) => ({ pn, idx }))
    .filter((e) => e.pn === null);

  for (const { pn, idx } of sortable) {
    orderLines.push(`  Position ${pn}: Image ${idx + 1} (${imageParts[idx].label})`);
  }
  if (nullEntries.length > 0) {
    orderLines.push(`  Unplaced: ${nullEntries.map((e) => `Image ${e.idx + 1}`).join(", ")}`);
  }

  const proposedOrderStr = orderLines.join("\n");

  const prompt = PASS2_PROMPT
    .replace(/\{\{COUNT\}\}/g, String(n))
    .replace("{{PROPOSED_ORDER}}", proposedOrderStr);

  // Build content: prompt + all images IN THE PROPOSED ORDER
  const parts = [{ text: prompt }];

  // Send images in proposed sorted order so model sees them in sequence
  for (const { pn, idx } of sortable) {
    parts.push({ text: `\n--- Page ${pn}: ${imageParts[idx].label} ---` });
    if (imageParts[idx].part) {
      parts.push(imageParts[idx].part);
    } else {
      parts.push({ text: `[Image could not be loaded]` });
    }
  }
  // Append unplaced images at end
  for (const { idx } of nullEntries) {
    parts.push({ text: `\n--- Unplaced: ${imageParts[idx].label} ---` });
    if (imageParts[idx].part) {
      parts.push(imageParts[idx].part);
    }
  }

  const resultPromise  = model.generateContent(parts);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Pass 2 timed out after ${VERIFY_TIMEOUT / 1000}s`)), VERIFY_TIMEOUT)
  );

  const result   = await Promise.race([resultPromise, timeoutPromise]);
  const response = result.response;
  const text     = response.text().trim();

  logger.debug(`AI Pass 2 raw response:\n${text}`);

  return _parsePass2Response(text, n);
}

function _parsePass2Response(text, expectedCount) {
  try {
    let cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!objMatch) return null;

    let parsed;
    try {
      parsed = JSON.parse(objMatch[0]);
    } catch {
      const fixed = objMatch[0]
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]");
      parsed = JSON.parse(fixed);
    }

    const verified   = parsed.verified === true;
    const reasoning  = parsed.reasoning || "";
    const confidence = parsed.confidence || "medium";

    // Parse final_order: this is an array where index i = page number for Image (i+1)
    let finalOrder = null;
    if (parsed.final_order && Array.isArray(parsed.final_order)) {
      finalOrder = parsed.final_order.map((val) => {
        if (val === null || val === undefined) return null;
        const num = parseInt(String(val), 10);
        return (Number.isFinite(num) && num > 0 && num <= 999) ? num : null;
      });

      // Pad/truncate
      while (finalOrder.length < expectedCount) finalOrder.push(null);
      if (finalOrder.length > expectedCount) finalOrder.length = expectedCount;
    }

    return { verified, finalOrder, reasoning, confidence };

  } catch (err) {
    logger.warn(`AI Pass 2 parse error: ${err.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Confidence computation
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Compute overall confidence from per-image confidence levels and coverage.
 */
function _computeOverallConfidence(perImageConfidence, coverage) {
  if (!perImageConfidence || perImageConfidence.length === 0) return 0.5;

  const confMap = { high: 1.0, medium: 0.7, low: 0.4 };
  const scores  = perImageConfidence.map((c) => confMap[c] || 0.4);
  const avgConf = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Overall = weighted combination of average per-image confidence and coverage
  // coverage weight: 40%, per-image confidence weight: 60%
  const overall = (avgConf * 0.6) + (coverage * 0.4);

  // Clamp to reasonable range
  return Math.min(0.98, Math.max(0.3, overall));
}

module.exports = { detectPageNumbers, isAvailable };
