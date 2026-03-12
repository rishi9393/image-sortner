# 📚 Smart Notes Image Sorter — Project Context & Checkpoint

> **Purpose of this file:** Every time work resumes on this project, read this file first.
> It explains the full idea, the current architecture, what is done, what is pending,
> and where to continue from.

---

## 🧠 The Problem

In group chats (WhatsApp, Telegram, etc.) students share photos of handwritten notes
or printed study material. Because messages arrive out of order, downloaded images
are shuffled — forcing students to manually re-order them before studying.

**Example chaos:**
```
Downloaded: Page 4 → Page 1 → Page 3 → Page 2
Wanted:     Page 1 → Page 2 → Page 3 → Page 4
```

---

## 💡 The Solution

A web app where users:
1. **Upload** all the shuffled note images at once
2. The system **analyses** every image using multiple signals
3. Images are **automatically re-ordered** into the correct sequence
4. User can **view** the sorted pages and optionally **download a PDF**

---

## 🔍 Sorting Signals (Priority Order)

| Priority | Signal                  | Method                                         | Status      |
|----------|-------------------------|------------------------------------------------|-------------|
| 1 (HIGH) | Page number in text     | OCR → regex patterns ("Page 3", "Pg 2/10"…)   | ✅ Done     |
| 2        | EXIF / metadata date    | exifr library reads DateTimeOriginal etc.      | ✅ Done     |
| 3        | Text continuity         | NLP — does sentence on page N flow into N+1?   | ✅ Done     |
| 4 (LOW)  | Original upload order   | Fallback if no signal works                    | ✅ Done     |

---

## 🏗️ Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Backend     | Node.js + Express.js                |
| OCR         | Tesseract.js (v7)                   |
| Image meta  | exifr                               |
| PDF export  | PDFKit + sharp                      |
| File upload | Multer (disk storage)               |
| Frontend    | Vanilla HTML + CSS + JS (no framework) |
| Session     | In-memory Map (TTL: 1 hour)         |

---

## 📁 Project Structure

```
image-sortner/
├── src/
│   ├── app.js                        # Express app setup
│   ├── server.js                     # HTTP server entry point
│   ├── config/
│   │   └── index.js                  # All env-based config
│   ├── routes/
│   │   ├── index.js                  # Router aggregator
│   │   ├── healthRoutes.js
│   │   ├── uploadRoutes.js           # POST /api/upload
│   │   ├── processRoutes.js          # POST|GET /api/process/:sessionId
│   │   └── exportRoutes.js           # GET /api/export/:sessionId
│   ├── controllers/
│   │   ├── healthController.js
│   │   ├── uploadController.js
│   │   ├── processController.js      # Orchestrates the full pipeline
│   │   └── exportController.js
│   ├── services/
│   │   ├── sessionService.js         # In-memory session store + TTL cleanup
│   │   ├── metadataService.js        # EXIF extraction via exifr
│   │   ├── ocrService.js             # Tesseract.js OCR per image
│   │   ├── pageDetectionService.js   # Regex patterns for page numbers
│   │   ├── textContinuityService.js  # Text-flow scoring between pages
│   │   ├── sortingService.js         # Combines all signals → final order
│   │   └── pdfService.js             # PDFKit multi-page PDF generator
│   ├── middlewares/
│   │   ├── upload.js                 # Multer config + file filter
│   │   ├── errorHandler.js           # Global JSON error responses
│   │   └── notFound.js              # 404 handler
│   └── utils/
│       ├── AppError.js               # Custom error class
│       └── logger.js                 # Simple levelled console logger
├── public/                           # Frontend (served as static files)
│   ├── index.html                    # Single-page UI
│   ├── css/
│   │   └── style.css                 # All styles
│   └── js/
│       └── app.js                    # Frontend logic (upload, poll, display)
├── uploads/
│   ├── raw/                          # Uploaded originals (per session folder)
│   └── processed/                    # Generated PDFs
├── .env                              # Environment variables (not in git)
├── .gitignore
├── package.json
└── PROJECT_IDEA.md                   # ← YOU ARE HERE
```

---

## 🔌 API Reference

### `GET /api/health`
Returns server status.

### `POST /api/upload`
- **Body:** `multipart/form-data`, field name `images` (1–50 files)
- **Returns:** `{ sessionId, fileCount, files[] }`

### `POST /api/process/:sessionId`
- Runs full pipeline: metadata → OCR → page detection → sort
- **Returns:** `{ sortMethod, sortMethodDescription, images[] }` (sorted)

### `GET /api/process/:sessionId`
- Returns cached results (must have run POST first)

### `GET /api/export/:sessionId`
- Streams a sorted PDF file as download

---

## 🔄 Request Flow

```
User uploads images
       ↓
POST /api/upload  →  stores files in uploads/raw/:sessionId/
       ↓              returns sessionId
POST /api/process/:sessionId
       ↓
  ┌─── For each image (parallel) ───┐
  │  extractMetadata()              │
  │  extractText() [OCR]            │
  └─────────────────────────────────┘
       ↓
  detectPageNumber(text)  [each image]
  scoreTextContinuity()   [across pages]
       ↓
  sortImages()  ← picks best signal
       ↓
  Session updated with sorted results
       ↓
GET /api/export/:sessionId  →  generates PDF → streams to browser
```

---

## ✅ What Is Complete

- [x] Full backend Express server with all routes
- [x] Multer file upload with session-based storage
- [x] EXIF metadata extraction (exifr)
- [x] OCR with Tesseract.js
- [x] Page number detection with 7 regex patterns
- [x] Text continuity scoring service
- [x] Multi-signal sorting service (page → timestamp → continuity → fallback)
- [x] PDF generation with PDFKit + sharp
- [x] In-memory session store with 1-hour TTL cleanup
- [x] Structured error handling & logging
- [x] Frontend UI (upload, processing, results, PDF download)

---

## 🚧 Possible Future Improvements

- [ ] **Persistent storage** — replace in-memory sessions with Redis or SQLite
- [ ] **Queue system** — BullMQ for large batches so HTTP doesn't timeout
- [ ] **Progress streaming** — Server-Sent Events to push per-image OCR progress
- [ ] **Manual reordering** — drag-and-drop UI to correct the auto-sort
- [ ] **Multi-language OCR** — add more Tesseract language packs
- [ ] **Cloud deployment** — Dockerize + deploy to Railway / Render / Fly.io
- [ ] **File cleanup cron** — auto-delete uploads older than 24 hours
- [ ] **Rate limiting** — express-rate-limit to prevent abuse
- [ ] **Authentication** — optional user accounts to save sessions

---

## 🗂️ Checkpoint — Last Worked On

**Date:** March 2026
**Last commit:** Frontend UI built and wired into Express static serving.
**Branch:** `master`
**Repo:** https://github.com/rishi9393/image-sortner

### To resume work:
```bash
git pull origin master
npm install
npm run dev
# Visit http://localhost:3000
```

### To test the API manually:
```bash
# 1. Upload images
curl -X POST http://localhost:3000/api/upload \
  -F "images=@page1.jpg" -F "images=@page2.jpg"

# 2. Process (use sessionId from step 1)
curl -X POST http://localhost:3000/api/process/<sessionId>

# 3. Download PDF
curl -O http://localhost:3000/api/export/<sessionId>
```

---

## 📝 Key Design Decisions

| Decision | Reason |
|----------|--------|
| No React/Vue — plain HTML+JS | Zero build step, fast to iterate, no framework overhead |
| Sync processing in same request | Simple for MVP; avoids polling complexity |
| In-memory sessions | No DB dependency; fine for single-server MVP |
| One Tesseract worker per image | Avoids memory exhaustion on large batches |
| PDF page = image dimensions | Notes look best at native resolution, not forced A4 |
