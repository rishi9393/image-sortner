const config = require("../config");

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = config.nodeEnv === "production" ? "warn" : "debug";

function log(level, message, data = null) {
  if (LOG_LEVELS[level] > LOG_LEVELS[currentLevel]) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (data) {
    console[level === "error" ? "error" : "log"](`${prefix} ${message}`, data);
  } else {
    console[level === "error" ? "error" : "log"](`${prefix} ${message}`);
  }
}

const logger = {
  error: (message, data) => log("error", message, data),
  warn: (message, data) => log("warn", message, data),
  info: (message, data) => log("info", message, data),
  debug: (message, data) => log("debug", message, data),
};

module.exports = logger;
