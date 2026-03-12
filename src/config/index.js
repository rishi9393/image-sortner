const path = require("path");

// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",

  // Upload
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB
    maxFileCount: parseInt(process.env.MAX_FILE_COUNT, 10) || 50,
    allowedExtensions: (process.env.ALLOWED_EXTENSIONS || ".jpg,.jpeg,.png,.webp").split(","),
    rawDir: path.join(__dirname, "../../uploads/raw"),
    processedDir: path.join(__dirname, "../../uploads/processed"),
  },

  // Paths
  paths: {
    root: path.join(__dirname, "../.."),
    src: path.join(__dirname, ".."),
    uploads: path.join(__dirname, "../../uploads"),
  },
};

module.exports = config;
