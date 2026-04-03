/**
 * Document AI Service  –  Google Document AI with Layout Parser
 *
 * Uses Google Document AI Layout Parser for:
 *  1. Extracting page numbers from document images with high accuracy
 *  2. Understanding document structure (headers, footers, margins)
 *  3. Detecting page number locations in corners and edges
 *
 * Sorting Rules (strict):
 *  1. Sort pages by detected page numbers in ascending order
 *  2. Do NOT fill missing page numbers (e.g., 1,2,3,8,9 stays as-is)
 *  3. Missing pages (like 4,5,6,7) are ignored, not inferred
 *  4. Only use content-based analysis when NO page number is detected
 *  5. Insert pages without numbers logically between numbered pages
 *
 * Priority Order:
 *  1. Page number (highest priority)
 *  2. Content-based ordering (only if page number missing)
 */

"use strict";

const { DocumentProcessorServiceClient } = require("@google-cloud/documentai").v1;
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

// ── Config ────────────────────────────────────────────────────────────────────

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || "";
const LOCATION = process.env.DOCUMENT_AI_LOCATION || "us"; // or "eu"
const PROCESSOR_ID = process.env.DOCUMENT_AI_PROCESSOR_ID || "";

// Fallback to Gemini if Document AI not configured
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Check if Document AI is properly configured
 */
function isDocumentAIAvailable() {
  return PROJECT_ID.length > 0 && PROCESSOR_ID.length > 0;
}

/**
 * Check if Gemini fallback is available
 */
function isGeminiFallbackAvailable() {
  return GEMINI_API_KEY.length > 0;
}

/**
 * Check if any AI service is available
 */
function isAvailable() {
  return isDocumentAIAvailable() || isGeminiFallbackAvailable();
}

/**
 * Get MIME type from file extension
 */
function _getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".pdf": "application/pdf",
  };
  return mimeMap[ext] || "image/jpeg";
}

// ══════════════════════════════════════════════════════════════════════════════
// Document AI Layout Parser
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize Document AI client
 */
function _getDocumentAIClient() {
  return new DocumentProcessorServiceClient();
}

/**
 * Process a single document/image with Document AI Layout Parser
 *
 * @param {string} filePath - Path to the image file
 * @returns {Promise<Object>} - Extracted document structure
 */
async function _processWithDocumentAI(filePath) {
  const client = _getDocumentAIClient();

  const processorName = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;

  const imageContent = fs.readFileSync(filePath);
  const mimeType = _getMimeType(filePath);

  const request = {
    name: processorName,
    rawDocument: {
      content: imageContent.toString("base64"),
      mimeType: mimeType,
    },
  };

  const [result] = await client.processDocument(request);
  return result.document;
}

/**
 * Extract page number from Document AI layout analysis
 *
 * Looks for page numbers in:
 *  - Headers and footers
 *  - Corners of the page (top-left, top-right, bottom-left, bottom-right)
 *  - Margin regions
 *  - Standalone numbers in edge regions
 *
 * @param {Object} document - Document AI response
 * @returns {Object|null} - { pageNumber, confidence, location, matchedText }
 */
function _extractPageNumberFromLayout(document) {
  if (!document || !document.pages || document.pages.length === 0) {
    return null;
  }

  const page = document.pages[0];
  const candidates = [];

  // 1. Check header/footer blocks (highest confidence)
  if (page.blocks) {
    for (const block of page.blocks) {
      const pageNum = _extractPageNumberFromBlock(block, page);
      if (pageNum) {
        candidates.push({
          ...pageNum,
          source: "block",
          confidence: Math.min(pageNum.confidence + 0.1, 1.0), // Boost for structured block
        });
      }
    }
  }

  // 2. Check paragraphs in header/footer regions
  if (page.paragraphs) {
    for (const paragraph of page.paragraphs) {
      const pageNum = _extractPageNumberFromParagraph(paragraph, page);
      if (pageNum) {
        candidates.push({
          ...pageNum,
          source: "paragraph",
        });
      }
    }
  }

  // 3. Check tokens (for isolated numbers)
  if (page.tokens) {
    for (const token of page.tokens) {
      const pageNum = _extractPageNumberFromToken(token, page);
      if (pageNum) {
        candidates.push({
          ...pageNum,
          source: "token",
        });
      }
    }
  }

  // 4. Check detected form fields (sometimes page numbers appear in forms)
  if (page.formFields) {
    for (const field of page.formFields) {
      const pageNum = _extractPageNumberFromFormField(field);
      if (pageNum) {
        candidates.push({
          ...pageNum,
          source: "formField",
        });
      }
    }
  }

  // 5. Fallback: scan full text for page number patterns
  if (document.text) {
    const textPageNum = _extractPageNumberFromText(document.text, page);
    if (textPageNum) {
      candidates.push({
        ...textPageNum,
        source: "fullText",
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Sort by confidence (descending) and prefer edge/corner locations
  candidates.sort((a, b) => {
    // Prioritize edge locations
    const aEdge = a.isEdge ? 1 : 0;
    const bEdge = b.isEdge ? 1 : 0;
    if (aEdge !== bEdge) return bEdge - aEdge;

    // Then by confidence
    return b.confidence - a.confidence;
  });

  // Return the best candidate
  return candidates[0];
}

/**
 * Extract page number from a block (paragraph group)
 */
function _extractPageNumberFromBlock(block, page) {
  if (!block.layout || !block.layout.textAnchor) return null;

  const text = _getTextFromLayout(block.layout, page);
  if (!text) return null;

  const bounds = block.layout.boundingPoly;
  const isEdge = _isInEdgeRegion(bounds, page);

  return _parsePageNumber(text, isEdge);
}

/**
 * Extract page number from a paragraph
 */
function _extractPageNumberFromParagraph(paragraph, page) {
  if (!paragraph.layout || !paragraph.layout.textAnchor) return null;

  const text = _getTextFromLayout(paragraph.layout, page);
  if (!text) return null;

  const bounds = paragraph.layout.boundingPoly;
  const isEdge = _isInEdgeRegion(bounds, page);

  return _parsePageNumber(text, isEdge);
}

/**
 * Extract page number from a token (single word/number)
 */
function _extractPageNumberFromToken(token, page) {
  if (!token.layout || !token.layout.textAnchor) return null;

  const text = _getTextFromLayout(token.layout, page);
  if (!text) return null;

  const bounds = token.layout.boundingPoly;
  const isEdge = _isInEdgeRegion(bounds, page);

  // For tokens, only consider if in edge region
  if (!isEdge) return null;

  return _parsePageNumber(text, isEdge);
}

/**
 * Extract page number from form field
 */
function _extractPageNumberFromFormField(field) {
  if (!field.fieldValue || !field.fieldValue.textAnchor) return null;

  const fieldName = field.fieldName?.textAnchor?.content?.toLowerCase() || "";

  // Check if field name suggests page number
  if (
    fieldName.includes("page") ||
    fieldName.includes("pg") ||
    fieldName.includes("no.")
  ) {
    const value = field.fieldValue.textAnchor.content;
    const parsed = _parsePageNumber(value, true);
    if (parsed) {
      parsed.confidence = Math.min(parsed.confidence + 0.15, 1.0);
    }
    return parsed;
  }

  return null;
}

/**
 * Extract page number from full text using patterns
 */
function _extractPageNumberFromText(text, page) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Check first and last lines (header/footer regions)
  const edgeLines = [
    ...lines.slice(0, 3),
    ...lines.slice(-3),
  ];

  for (const line of edgeLines) {
    const parsed = _parsePageNumber(line, true);
    if (parsed && parsed.confidence >= 0.7) {
      return parsed;
    }
  }

  // Check all lines for explicit page patterns
  for (const line of lines) {
    const parsed = _parsePageNumber(line, false);
    if (parsed && parsed.pattern !== "standalone_number") {
      return parsed;
    }
  }

  return null;
}

/**
 * Get text content from a layout element
 */
function _getTextFromLayout(layout, page) {
  if (!layout.textAnchor || !layout.textAnchor.textSegments) return null;

  // For Document AI, text is referenced by indices into the full document text
  // This simplified version handles the common case
  if (layout.textAnchor.content) {
    return layout.textAnchor.content.trim();
  }

  return null;
}

/**
 * Check if a bounding box is in the edge region (header/footer/margins)
 */
function _isInEdgeRegion(boundingPoly, page) {
  if (!boundingPoly || !boundingPoly.normalizedVertices) return false;

  const vertices = boundingPoly.normalizedVertices;
  if (vertices.length < 2) return false;

  // Calculate center Y position (normalized 0-1)
  const avgY =
    vertices.reduce((sum, v) => sum + (v.y || 0), 0) / vertices.length;

  // Calculate center X position
  const avgX =
    vertices.reduce((sum, v) => sum + (v.x || 0), 0) / vertices.length;

  // Edge region: top 15%, bottom 15%, or sides (left/right 10%)
  const isVerticalEdge = avgY < 0.15 || avgY > 0.85;
  const isHorizontalEdge = avgX < 0.1 || avgX > 0.9;

  return isVerticalEdge || isHorizontalEdge;
}

/**
 * Parse page number from text using multiple patterns
 */
function _parsePageNumber(text, isEdge) {
  if (!text || text.trim().length === 0) return null;

  const trimmed = text.trim();

  // Page number patterns (ordered by specificity)
  const patterns = [
    // "Page 3" / "page: 3" / "Page 3 of 10"
    {
      name: "page_keyword",
      regex: /\bpage\s*[:\-.]?\s*(\d+)(?:\s*(?:of|\/)\s*\d+)?\b/i,
      group: 1,
      confidence: 0.95,
    },
    // "Pg 2" / "Pg. 2"
    {
      name: "pg_keyword",
      regex: /\bpg\.?\s*(\d+)(?:\s*(?:of|\/)\s*\d+)?\b/i,
      group: 1,
      confidence: 0.92,
    },
    // "P. 4"
    {
      name: "p_dot_keyword",
      regex: /\bP\.\s*(\d+)\b/,
      group: 1,
      confidence: 0.88,
    },
    // "#3" / "No. 3"
    {
      name: "number_sign",
      regex: /(?:#\s*|No\.?\s+)(\d+)\b/i,
      group: 1,
      confidence: 0.86,
    },
    // "-3-" / "– 3 –"
    {
      name: "dashes",
      regex: /[-–—]\s*(\d+)\s*[-–—]/,
      group: 1,
      confidence: 0.85,
    },
    // "3 / 10" / "3/10"
    {
      name: "fraction",
      regex: /^(\d+)\s*\/\s*\d+$/,
      group: 1,
      confidence: 0.85,
    },
    // "(4)" on its own
    {
      name: "parens",
      regex: /^\(\s*(\d+)\s*\)$/,
      group: 1,
      confidence: 0.78,
    },
    // "[4]"
    {
      name: "brackets",
      regex: /^\[\s*(\d+)\s*\]$/,
      group: 1,
      confidence: 0.78,
    },
    // Standalone number (1-3 digits)
    {
      name: "standalone_number",
      regex: /^(\d{1,3})$/,
      group: 1,
      confidence: isEdge ? 0.75 : 0.45,
    },
  ];

  for (const { name, regex, group, confidence } of patterns) {
    const match = trimmed.match(regex);
    if (!match) continue;

    const num = parseInt(match[group], 10);
    if (!Number.isFinite(num) || num <= 0 || num > 500) continue;

    // Boost confidence for edge locations
    const finalConf = isEdge ? Math.min(confidence + 0.1, 1.0) : confidence;

    return {
      pageNumber: num,
      confidence: finalConf,
      matchedText: match[0].trim(),
      pattern: name,
      isEdge,
    };
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Gemini Fallback (when Document AI not configured)
// ══════════════════════════════════════════════════════════════════════════════

const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_PROMPT = `You are a precise document page number extractor.

## TASK
Analyze this image and extract ONLY the page number if one is visible.

## WHERE TO LOOK
- Top corners (left and right)
- Bottom corners (left and right)
- Headers and footers
- Margins

## WHAT TO LOOK FOR
- Explicit numbers: "1", "2", "3", etc.
- Formatted numbers: "Page 3", "Pg. 2", "P. 4", "#3", "-3-", "(3)"
- Fractions: "3/10", "3 of 10"

## RESPONSE FORMAT (JSON only, no markdown):
{
  "page_number": <number or null>,
  "confidence": <"high"|"medium"|"low">,
  "location": "<where found: e.g., 'top-right corner', 'bottom center'>",
  "matched_text": "<exact text that indicates page number>"
}

If NO page number is visible, return:
{
  "page_number": null,
  "confidence": "high",
  "location": null,
  "matched_text": null
}

IMPORTANT: Only report actual page numbers. Do not guess or infer.`;

/**
 * Process image with Gemini as fallback
 */
async function _processWithGemini(filePath) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { temperature: 0.1 },
  });

  const imageContent = fs.readFileSync(filePath);
  const mimeType = _getMimeType(filePath);

  const imagePart = {
    inlineData: {
      data: imageContent.toString("base64"),
      mimeType,
    },
  };

  const result = await model.generateContent([GEMINI_PROMPT, imagePart]);
  const response = result.response;
  const text = response.text().trim();

  // Parse JSON response
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const objMatch = cleaned.match(/\{[\s\S]*\}/);

  if (!objMatch) return null;

  try {
    const parsed = JSON.parse(objMatch[0]);

    if (parsed.page_number === null) return null;

    const num = parseInt(String(parsed.page_number), 10);
    if (!Number.isFinite(num) || num <= 0 || num > 500) return null;

    const confMap = { high: 0.95, medium: 0.75, low: 0.55 };

    return {
      pageNumber: num,
      confidence: confMap[parsed.confidence] || 0.75,
      matchedText: parsed.matched_text || String(num),
      location: parsed.location || "unknown",
      pattern: "gemini_detection",
      isEdge: true,
    };
  } catch (err) {
    logger.warn(`Gemini parse error: ${err.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Content-Based Analysis (Fallback for pages without page numbers)
// ══════════════════════════════════════════════════════════════════════════════

const CONTENT_ANALYSIS_PROMPT = `Analyze this document image and determine its likely position in a sequence.

## INDICATORS TO LOOK FOR:

### EARLY PAGES (1-3):
- Title pages, covers
- "Introduction", "Overview", "Chapter 1"
- Table of contents
- Definitions, basics, fundamentals

### MIDDLE PAGES:
- Main content, details
- Continuation of topics
- Examples, explanations
- "contd...", numbered problems

### LATE PAGES:
- "Conclusion", "Summary"
- "Bibliography", "References"
- "The End", appendices
- Final examples or solutions

## RESPONSE FORMAT (JSON only):
{
  "position_hint": "<early|middle|late>",
  "confidence": "<high|medium|low>",
  "indicators": ["<indicator 1>", "<indicator 2>"],
  "reasoning": "<brief explanation>"
}`;

/**
 * Analyze content to determine approximate position (for pages without numbers)
 */
async function _analyzeContentForPosition(filePath) {
  if (!isGeminiFallbackAvailable()) return null;

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { temperature: 0.2 },
    });

    const imageContent = fs.readFileSync(filePath);
    const mimeType = _getMimeType(filePath);

    const imagePart = {
      inlineData: {
        data: imageContent.toString("base64"),
        mimeType,
      },
    };

    const result = await model.generateContent([CONTENT_ANALYSIS_PROMPT, imagePart]);
    const text = result.response.text().trim();

    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const objMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!objMatch) return null;

    const parsed = JSON.parse(objMatch[0]);

    return {
      positionHint: parsed.position_hint || "middle",
      confidence: parsed.confidence || "low",
      indicators: parsed.indicators || [],
      reasoning: parsed.reasoning || "",
    };
  } catch (err) {
    logger.debug(`Content analysis failed: ${err.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Main: Process all images and extract page numbers
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} PageDetectionResult
 * @property {number|null} pageNumber - Detected page number (null if not found)
 * @property {number} confidence - Confidence score (0.0 - 1.0)
 * @property {string|null} matchedText - The text that matched
 * @property {string} pattern - Detection method used
 * @property {string|null} location - Where the number was found
 * @property {Object|null} contentAnalysis - Fallback content analysis (if no page number)
 */

/**
 * @typedef {Object} ProcessedPage
 * @property {number} originalIndex - Original index in input array
 * @property {string} filePath - Path to the image file
 * @property {string} originalName - Original filename
 * @property {number|null} detectedPageNumber - Extracted page number
 * @property {number} confidence - Detection confidence
 * @property {Object|null} detection - Full detection result
 * @property {Object|null} contentAnalysis - Content analysis for fallback ordering
 */

/**
 * Process all images and detect page numbers using Document AI Layout Parser
 *
 * @param {{ filePath: string, originalName: string }[]} files - Array of image files
 * @returns {Promise<{
 *   pages: ProcessedPage[],
 *   sortedPages: ProcessedPage[],
 *   method: string,
 *   coverage: number
 * }>}
 */
async function detectAndSortPages(files) {
  if (!files || files.length === 0) {
    return {
      pages: [],
      sortedPages: [],
      method: "none",
      coverage: 0,
    };
  }

  const n = files.length;
  logger.info(`Document AI: Processing ${n} images for page number extraction...`);
  const t0 = Date.now();

  // Step 1: Extract page numbers from all images
  const useDocumentAI = isDocumentAIAvailable();
  const method = useDocumentAI ? "document_ai_layout" : "gemini_vision";

  logger.info(`Using method: ${method}`);

  const processedPages = [];

  for (let i = 0; i < n; i++) {
    const file = files[i];

    try {
      let detection = null;

      if (useDocumentAI) {
        const document = await _processWithDocumentAI(file.filePath);
        detection = _extractPageNumberFromLayout(document);
      } else {
        detection = await _processWithGemini(file.filePath);
      }

      processedPages.push({
        originalIndex: i,
        filePath: file.filePath,
        originalName: file.originalName,
        detectedPageNumber: detection?.pageNumber || null,
        confidence: detection?.confidence || 0,
        detection,
        contentAnalysis: null, // Will be filled for pages without numbers
      });

      if (detection?.pageNumber) {
        logger.debug(
          `Image ${i + 1} (${file.originalName}): Page ${detection.pageNumber} ` +
          `(confidence: ${detection.confidence.toFixed(2)}, pattern: ${detection.pattern})`
        );
      } else {
        logger.debug(`Image ${i + 1} (${file.originalName}): No page number detected`);
      }
    } catch (err) {
      logger.warn(`Failed to process image ${i + 1} (${file.originalName}): ${err.message}`);
      processedPages.push({
        originalIndex: i,
        filePath: file.filePath,
        originalName: file.originalName,
        detectedPageNumber: null,
        confidence: 0,
        detection: null,
        contentAnalysis: null,
      });
    }
  }

  // Step 2: Analyze content for pages without page numbers (for fallback ordering)
  const pagesWithoutNumbers = processedPages.filter((p) => p.detectedPageNumber === null);

  if (pagesWithoutNumbers.length > 0 && pagesWithoutNumbers.length < n) {
    logger.info(`Analyzing content for ${pagesWithoutNumbers.length} pages without page numbers...`);

    for (const page of pagesWithoutNumbers) {
      page.contentAnalysis = await _analyzeContentForPosition(page.filePath);
    }
  }

  // Step 3: Sort pages according to the sorting rules
  const sortedPages = _sortPages(processedPages);

  const detectedCount = processedPages.filter((p) => p.detectedPageNumber !== null).length;
  const coverage = detectedCount / n;

  logger.info(
    `Document AI complete in ${Date.now() - t0}ms — ` +
    `${detectedCount}/${n} pages detected (${(coverage * 100).toFixed(0)}% coverage)`
  );

  return {
    pages: processedPages,
    sortedPages,
    method,
    coverage,
  };
}

/**
 * Sort pages according to the strict sorting rules:
 *  1. Sort by detected page numbers in ascending order
 *  2. Do NOT fill missing page numbers
 *  3. Pages without numbers are inserted logically based on content analysis
 *
 * @param {ProcessedPage[]} pages
 * @returns {ProcessedPage[]}
 */
function _sortPages(pages) {
  if (pages.length <= 1) return [...pages];

  // Separate pages with and without page numbers
  const withNumbers = pages.filter((p) => p.detectedPageNumber !== null);
  const withoutNumbers = pages.filter((p) => p.detectedPageNumber === null);

  // Sort numbered pages strictly by page number (ascending)
  // DO NOT fill gaps - just sort by detected numbers
  withNumbers.sort((a, b) => a.detectedPageNumber - b.detectedPageNumber);

  // If all pages have numbers, return sorted
  if (withoutNumbers.length === 0) {
    return withNumbers;
  }

  // If no pages have numbers, sort by content analysis or original order
  if (withNumbers.length === 0) {
    return _sortByContentAnalysis(withoutNumbers);
  }

  // Insert pages without numbers at logical positions
  return _insertPagesLogically(withNumbers, withoutNumbers);
}

/**
 * Sort pages by content analysis when no page numbers are available
 */
function _sortByContentAnalysis(pages) {
  const positionOrder = { early: 0, middle: 1, late: 2 };

  return [...pages].sort((a, b) => {
    const aPos = a.contentAnalysis?.positionHint || "middle";
    const bPos = b.contentAnalysis?.positionHint || "middle";

    const aOrder = positionOrder[aPos] ?? 1;
    const bOrder = positionOrder[bPos] ?? 1;

    if (aOrder !== bOrder) return aOrder - bOrder;

    // If same position category, use original order as tiebreaker
    return a.originalIndex - b.originalIndex;
  });
}

/**
 * Insert pages without numbers at logical positions between numbered pages
 *
 * Strategy:
 *  1. Pages with "early" content hint go before the first numbered page
 *  2. Pages with "late" content hint go after the last numbered page
 *  3. Pages with "middle" hint are inserted at gaps in the page sequence
 *     or appended at the end if no gaps
 */
function _insertPagesLogically(numberedPages, unnumberedPages) {
  const result = [];
  let unnumberedIdx = 0;

  // Categorize unnumbered pages by position hint
  const early = unnumberedPages.filter(
    (p) => p.contentAnalysis?.positionHint === "early"
  );
  const middle = unnumberedPages.filter(
    (p) => !p.contentAnalysis?.positionHint || p.contentAnalysis?.positionHint === "middle"
  );
  const late = unnumberedPages.filter(
    (p) => p.contentAnalysis?.positionHint === "late"
  );

  // Sort each category by original index for stability
  early.sort((a, b) => a.originalIndex - b.originalIndex);
  middle.sort((a, b) => a.originalIndex - b.originalIndex);
  late.sort((a, b) => a.originalIndex - b.originalIndex);

  // Insert "early" pages at the beginning (before first numbered page)
  result.push(...early);

  // Insert numbered pages with "middle" pages in gaps
  let middleIdx = 0;

  for (let i = 0; i < numberedPages.length; i++) {
    result.push(numberedPages[i]);

    // Check for gap to next numbered page
    if (i < numberedPages.length - 1) {
      const currentNum = numberedPages[i].detectedPageNumber;
      const nextNum = numberedPages[i + 1].detectedPageNumber;
      const gap = nextNum - currentNum - 1;

      // Insert middle pages into the gap (up to gap size)
      if (gap > 0 && middleIdx < middle.length) {
        const toInsert = Math.min(gap, middle.length - middleIdx);
        for (let j = 0; j < toInsert; j++) {
          result.push(middle[middleIdx++]);
        }
      }
    }
  }

  // Append remaining "middle" pages and all "late" pages
  while (middleIdx < middle.length) {
    result.push(middle[middleIdx++]);
  }
  result.push(...late);

  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// Exports
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  isAvailable,
  isDocumentAIAvailable,
  isGeminiFallbackAvailable,
  detectAndSortPages,
};
