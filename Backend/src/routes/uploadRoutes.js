const express = require("express");
const router = express.Router();

const upload = require("../middlewares/upload");
const { uploadImages } = require("../controllers/uploadController");

/**
 * POST /api/upload
 * Accepts 1-50 images under the field name "images".
 */
router.post("/", upload.array("images", 50), uploadImages);

module.exports = router;
