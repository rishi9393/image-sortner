const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");
const AppError = require("../utils/AppError");

// Storage configuration - save to raw uploads directory with unique session folders
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Session ID is created per upload batch
    if (!req.sessionId) {
      req.sessionId = uuidv4();
    }
    const dest = path.join(config.upload.rawDir, req.sessionId);
    // Create directory synchronously for multer
    const fs = require("fs");
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Preserve original name but add unique prefix to avoid collisions
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e4);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// File filter - only allow image types
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (config.upload.allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `File type '${ext}' not allowed. Accepted: ${config.upload.allowedExtensions.join(", ")}`,
        400,
        "INVALID_FILE_TYPE"
      ),
      false
    );
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: config.upload.maxFileCount,
  },
});

module.exports = upload;
