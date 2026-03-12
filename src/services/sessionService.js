/**
 * In-memory session store.
 * Each upload batch gets a unique sessionId. Sessions hold file info,
 * processing results, and status. Sessions expire after 1 hour.
 */

const logger = require("../utils/logger");

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

/** @type {Map<string, Session>} */
const sessions = new Map();

/**
 * @typedef {Object} SessionFile
 * @property {string} originalName
 * @property {string} storedFilename
 * @property {string} filePath
 * @property {number} size
 * @property {string} url
 */

/**
 * @typedef {Object} Session
 * @property {string} sessionId
 * @property {SessionFile[]} files
 * @property {'uploaded'|'processing'|'processed'|'error'} status
 * @property {any[]|null} results
 * @property {string|null} sortMethod
 * @property {string|null} pdfPath
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/**
 * Create a new session with uploaded files.
 * @param {string} sessionId
 * @param {SessionFile[]} files
 * @returns {Session}
 */
function createSession(sessionId, files) {
  const now = new Date();
  const session = {
    sessionId,
    files,
    status: "uploaded",
    results: null,
    sortMethod: null,
    pdfPath: null,
    createdAt: now,
    updatedAt: now,
  };
  sessions.set(sessionId, session);
  logger.info(`Session created: ${sessionId} (${files.length} files)`);
  return session;
}

/**
 * Retrieve a session by ID.
 * @param {string} sessionId
 * @returns {Session|null}
 */
function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

/**
 * Partially update a session.
 * @param {string} sessionId
 * @param {Partial<Session>} data
 * @returns {Session|null}
 */
function updateSession(sessionId, data) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  Object.assign(session, data, { updatedAt: new Date() });
  return session;
}

/**
 * Delete a session and release memory.
 * @param {string} sessionId
 */
function deleteSession(sessionId) {
  sessions.delete(sessionId);
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

/**
 * Remove sessions that have exceeded the TTL.
 */
function cleanupExpiredSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  let removed = 0;
  for (const [id, session] of sessions.entries()) {
    if (session.createdAt.getTime() < cutoff) {
      sessions.delete(id);
      removed++;
    }
  }
  if (removed > 0) {
    logger.info(`Session cleanup: removed ${removed} expired session(s)`);
  }
}

// Run cleanup every 15 minutes
setInterval(cleanupExpiredSessions, 15 * 60 * 1000);

module.exports = { createSession, getSession, updateSession, deleteSession };
