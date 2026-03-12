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
  return json.data  // unwrap the { success, data } envelope
}

export async function processImages(sessionId) {
  const res = await fetch(`${API_BASE}/process/${sessionId}`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || err.message || 'Processing failed. Please try again.')
  }
  const json = await res.json()
  return json.data  // unwrap the { success, data } envelope
}

export function getExportUrl(sessionId) {
  return `${API_BASE}/export/${sessionId}`
}
