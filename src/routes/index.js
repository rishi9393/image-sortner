const express = require("express");
const router = express.Router();

const healthRoutes = require("./healthRoutes");

// Mount route modules
router.use("/health", healthRoutes);

// Future routes will be added here:
// router.use("/upload", uploadRoutes);
// router.use("/process", processRoutes);
// router.use("/sort", sortRoutes);
// router.use("/export", exportRoutes);

module.exports = router;
