/**
 * Upload Controller
 * Receives one or more image files via multipart/form-data,
 * stores them (handled by Multer middleware), creates a session,
 * and returns the sessionId plus a manifest of uploaded files.
 */

const sessionService = require("../services/sessionService");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

// Note: Multer middleware should be configured in the route to handle file uploads,

/**
 * POST /api/upload
 *
 * Expects: multipart/form-data with field name "images" (1–50 files)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     sessionId: string,
 *     fileCount: number,
 *     files: [{ originalName, storedFilename, size, url }]
 *   }
 * }
 */
async function uploadImages(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      throw new AppError(
        "No image files were uploaded. Use field name 'images'.",
        400,
        "NO_FILES"
      );
    }

    const sessionId = req.sessionId; // set by multer storage destination

    const files = req.files.map((f) => ({
      originalName: f.originalname,
      storedFilename: f.filename,
      filePath: f.path,
      size: f.size,
      url: `/uploads/raw/${sessionId}/${f.filename}`,
    }));

    sessionService.createSession(sessionId, files);

    logger.info(`Upload complete: session=${sessionId}, files=${files.length}`);

    res.status(200).json({
      success: true,
      data: {
        sessionId,
        fileCount: files.length,
        files: files.map(({ originalName, storedFilename, size, url }) => ({
          originalName,
          storedFilename,
          size,
          url,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadImages };
