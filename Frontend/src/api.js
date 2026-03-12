const API_BASE = '/api'

export async function uploadImages(files) {
  const formData = new FormData()
  files.forEach((file) => formData.append('images', file))

  const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.message || 'Upload failed. Please try again.')
  }
  const json = await res.json()
  return json.data
}

/**
 * Process images with real-time per-image progress via Server-Sent Events.
 *
 * @param {string}   sessionId
 * @param {Function} onProgress  – called with ({ done, total, filename }) for each image
 * @param {Function} onPhase     – called with (phase: number, label: string) for phase changes
 * @returns {Promise<object>}    – resolves with the full sorted results data
 */
export function processImagesWithProgress(sessionId, onProgress, onPhase) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}/process/${sessionId}/stream`
    const es  = new EventSource(url)

    es.onmessage = (e) => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }

      switch (msg.type) {
        case 'start':
          onPhase?.(1, 'Running OCR on each image…')
          break

        case 'ocr_progress':
          onProgress?.({ done: msg.done, total: msg.total, filename: msg.filename })
          // Advance phase labels as we pass thresholds
          if (msg.done === msg.total) {
            onPhase?.(2, 'Detecting page numbers & signals…')
            // Brief delay so the user sees phase 2 before phase 3 fires
            setTimeout(() => onPhase?.(3, 'Sorting into correct order…'), 400)
          }
          break

        case 'done':
          es.close()
          resolve(msg.data)
          break

        case 'error':
          es.close()
          reject(new Error(msg.message || 'Processing failed. Please try again.'))
          break
      }
    }

    es.onerror = () => {
      es.close()
      reject(new Error('Connection to server lost. Please try again.'))
    }
  })
}

/** Classic JSON endpoint (kept for fallback / non-SSE contexts). */
export async function processImages(sessionId) {
  const res = await fetch(`${API_BASE}/process/${sessionId}`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.message || 'Processing failed. Please try again.')
  }
  const json = await res.json()
  return json.data
}

export function getExportUrl(sessionId) {
  return `${API_BASE}/export/${sessionId}`
}
