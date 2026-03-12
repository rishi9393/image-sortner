/**
 * PDF Service
 * Generates a multi-page PDF from an ordered list of images.
 * Each image occupies one page, sized to match the image dimensions.
 */

const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const logger = require("../utils/logger");

/**
 * @typedef {Object} SortedImage
 * @property {string} filePath     - Absolute path to the image file
 * @property {string} originalName - Original filename (used only for logging)
 */

/**
 * Generate a PDF from an ordered array of images.
 *
 * @param {SortedImage[]} sortedImages  - Images in desired page order
 * @param {string}        outputPath    - Absolute path for the output .pdf file
 * @returns {Promise<string>}           - Resolves with outputPath on success
 */
async function generatePDF(sortedImages, outputPath) {
  if (!sortedImages || sortedImages.length === 0) {
    throw new Error("No images provided to generate PDF.");
  }

  // Ensure the output directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
    const writeStream = fs.createWriteStream(outputPath);

    writeStream.on("error", (err) => {
      logger.error(`PDF write stream error: ${err.message}`);
      reject(err);
    });

    writeStream.on("finish", () => {
      logger.info(`PDF generated: ${outputPath}`);
      resolve(outputPath);
    });

    doc.pipe(writeStream);

    for (let i = 0; i < sortedImages.length; i++) {
      const image = sortedImages[i];
      try {
        // Get image dimensions so the PDF page is a perfect fit
        const meta = await sharp(image.filePath).metadata();
        const width = meta.width || 595;   // fallback to A4 width (pts)
        const height = meta.height || 842; // fallback to A4 height (pts)

        doc.addPage({ size: [width, height], margin: 0 });
        doc.image(image.filePath, 0, 0, { width, height });

        logger.debug(
          `PDF: added page ${i + 1} (${image.originalName}) ${width}×${height}`
        );
      } catch (err) {
        // Skip corrupt/unreadable images rather than aborting the whole PDF
        logger.warn(
          `PDF: skipping ${image.originalName} – ${err.message}`
        );
      }
    }

    doc.end();
  });
}

module.exports = { generatePDF };
