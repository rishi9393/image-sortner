const app = require("./app");
const config = require("./config");
const logger = require("./utils/logger");

// Start the server
app.listen(config.port, () => {
  logger.info(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
  logger.info(`Health check: http://localhost:${config.port}/api/health`);
});
