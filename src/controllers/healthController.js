const config = require("../config");

/**
 * Health check endpoint.
 * Returns server status and basic info.
 */
function getHealth(req, res) {
  res.status(200).json({
    success: true,
    message: "Smart Notes Image Sorter API is running",
    data: {
      status: "healthy",
      environment: config.nodeEnv,
      uptime: `${Math.floor(process.uptime())}s`,
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = { getHealth };
