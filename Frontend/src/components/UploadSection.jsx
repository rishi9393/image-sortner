import { useCallback, useRef, useState } from 'react'

const MAX_FILES   = 50
const MAX_SIZE_MB = 20
const VALID_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

function loadRecentNotes() {
  try {
    const cols = JSON.parse(localStorage.getItem('collections') || '[]').filter(c => !c.trashed)
    const all = []
    cols.forEach(col => {
      ;(col.notesList || []).forEach(note => {
        all.push({ name: note.title, status: `In "${col.name}"`, color: col.color })
      })
    })
    return all.slice(-4).reverse()
  } catch {
    return []
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFiles(fileList) {
  const valid = []
  const errors = []
  for (const f of fileList) {
    if (!VALID_TYPES.includes(f.type)) {
      errors.push(`"${f.name}" is not a supported image type.`)
    } else if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      errors.push(`"${f.name}" exceeds the ${MAX_SIZE_MB} MB limit.`)
    } else {
      valid.push(f)
    }
  }
  return { valid, errors }
}

const PRO_TIPS = [
  'Ensure good lighting when taking photos of handwritten notes for better OCR accuracy.',
  'You can upload multiple files at once. The AI will group them automatically based on content.',
  'Tag your images before uploading to force them into specific project folders.',
]

export default function UploadSection({ files, error, onFilesSelected, onClear, onRemoveFile, onSort, targetCollection }) {
  const fileInputRef = useRef(null)
  const [isDragOver, setIsDragOver]     = useState(false)
  const [validationError, setValidationError] = useState(null)
  const [recentNotes] = useState(loadRecentNotes)

  const processIncoming = useCallback((fileList) => {
    const { valid, errors } = validateFiles(Array.from(fileList))
    if (errors.length) setValidationError(errors[0])
    else setValidationError(null)
    if (valid.length) onFilesSelected(valid)
  }, [onFilesSelected])

  const onDragOver   = (e) => { e.preventDefault(); setIsDragOver(true) }
  const onDragLeave  = ()  => setIsDragOver(false)
  const onDrop       = (e) => { e.preventDefault(); setIsDragOver(false); processIncoming(e.dataTransfer.files) }
  const onFileChange = (e) => { processIncoming(e.target.files); e.target.value = '' }
  const onZoneClick  = ()  => fileInputRef.current?.click()

  const displayError = validationError || error
  const hasFiles     = files.length > 0
  const totalBytes   = files.reduce((sum, f) => sum + f.size, 0)

  return (
    <section className="animate-fade-up">

      {/* ── Page heading ─────────────────────────────────── */}
      <div className="mb-7">
        <h1 className="text-3xl font-extrabold text-app-text mb-1">Upload Your Notes</h1>
        <p className="text-app-text-sec">Instantly organize your handwritten or digital study materials with AI-powered sorting.</p>
      </div>

      {/* ── Collection context banner ─────────────────────── */}
      {targetCollection && (
        <div className="flex items-center gap-4 px-5 py-4 rounded-2xl border mb-6 shadow-card"
          style={{ background: `${targetCollection.color}12`, borderColor: `${targetCollection.color}40` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
            style={{ background: targetCollection.color }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-app-text">
              Adding notes to&nbsp;
              <span style={{ color: targetCollection.color }}>"{targetCollection.name}"</span>
            </p>
            <p className="text-xs text-app-text-sec mt-0.5">
              Upload images below — they'll be saved directly into this collection after sorting.
            </p>
          </div>
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: targetCollection.color }} />
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">

        {/* ── Left column ──────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Drop zone card */}
          <div className="bg-white rounded-2xl border border-app-border shadow-card p-6">
            <div
              role="button"
              tabIndex={0}
              onClick={onZoneClick}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onZoneClick()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`
                border-2 border-dashed rounded-2xl py-14 px-8 text-center cursor-pointer
                transition-all duration-200 outline-none select-none
                ${isDragOver
                  ? 'border-app-accent bg-app-accent-light/40 scale-[1.01]'
                  : 'border-app-border hover:border-app-accent hover:bg-app-accent-light/20'}
              `}
            >
              {/* Single centered icon */}
              <div className="flex justify-center mb-5">
                <div className="w-16 h-16 bg-app-accent-light rounded-2xl flex items-center justify-center shadow-card">
                  <svg className="w-8 h-8 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              <p className="text-base font-bold text-app-text mb-1.5">
                {isDragOver ? 'Drop your files here' : 'Drag your notes here to start sorting'}
              </p>
              <p className="text-app-text-sec text-sm mb-4">
                JPG, PNG, and WEBP supported · Max {MAX_SIZE_MB}MB per file
              </p>

              {/* Format pills */}
              <div className="flex justify-center gap-2 mb-6">
                {['JPG', 'PNG', 'WEBP'].map(fmt => (
                  <span key={fmt} className="px-2.5 py-1 rounded-full bg-app-bg border border-app-border text-xs font-semibold text-app-text-sec">
                    {fmt}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onZoneClick() }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-app-accent text-white text-sm font-semibold
                           rounded-full hover:bg-app-accent-h transition-colors shadow-blue cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Select Files
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-6 mt-5 pt-5 border-t border-app-border">
              {[
                { label: 'SECURE UPLOAD' },
                { label: 'AUTO-OCR' },
                { label: `${MAX_SIZE_MB}MB MAX` },
              ].map(({ label }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs font-semibold text-app-text-sec uppercase tracking-wide">
                  <svg className="w-3.5 h-3.5 text-app-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Image grid + actions ─────────────────────── */}
          {hasFiles && (
            <div className="bg-white rounded-2xl border border-app-border shadow-card p-5">

              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-app-text">
                  Selected Files
                  <span className="ml-2 px-2 py-0.5 bg-app-accent-light text-app-accent text-xs font-bold rounded-full">
                    {files.length}
                  </span>
                </h3>
                <span className="text-xs text-app-text-muted">{files.length}/{MAX_FILES} max</span>
              </div>

              {/* Thumbnail grid */}
              <div className="grid grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                {files.map((file, i) => (
                  <GridThumb key={`${file.name}-${i}`} file={file} index={i} onRemove={onRemoveFile} />
                ))}
              </div>

              {/* Action row */}
              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-app-border">
                <button
                  onClick={onClear}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                             bg-white text-app-text-sec border border-app-border
                             hover:bg-app-bg hover:text-app-text transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear All
                </button>
                <button
                  onClick={onSort}
                  disabled={files.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold
                             bg-app-accent text-white border border-app-accent
                             hover:bg-app-accent-h disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors shadow-blue cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  Sort These Images
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {displayError && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm bg-app-error-bg border border-red-200 text-app-error">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {displayError}
            </div>
          )}
        </div>

        {/* ── Right sidebar ────────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Recent Notes */}
          <div className="bg-white rounded-2xl border border-app-border shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-app-text">Recent Notes</h3>
              <span className="text-xs text-app-text-muted">{recentNotes.length} saved</span>
            </div>
            {recentNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-10 h-10 bg-app-bg rounded-xl border border-app-border flex items-center justify-center mb-2">
                  <svg className="w-5 h-5 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-xs text-app-text-muted">No notes yet — your sorted notes will appear here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recentNotes.map(({ name, status, color }, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl border border-app-border flex-shrink-0 flex items-center justify-center"
                      style={{ background: `${color}15` }}>
                      <svg className="w-5 h-5" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-app-text truncate">{name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        <p className="text-xs text-app-text-muted truncate">{status}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pro Tips */}
          <div className="bg-app-accent-light rounded-2xl border border-blue-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-app-accent" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              <h3 className="text-sm font-bold text-app-accent">Pro Tips</h3>
            </div>
            <div className="flex flex-col gap-3">
              {PRO_TIPS.map((tip, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-app-accent text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-xs text-app-text-sec leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}

function GridThumb({ file, index, onRemove }) {
  const [thumb] = useState(() => URL.createObjectURL(file))
  return (
    <div className="relative group rounded-xl overflow-hidden border border-app-border bg-app-bg aspect-square">
      {/* Thumbnail */}
      <img
        src={thumb}
        alt={file.name}
        className="w-full h-full object-cover"
      />
      {/* Hover overlay with filename + size */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
        <p className="text-white text-[10px] font-semibold truncate leading-tight">{file.name}</p>
        <p className="text-white/70 text-[9px] mt-0.5">{formatBytes(file.size)}</p>
      </div>
      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-red-500
                   flex items-center justify-center opacity-0 group-hover:opacity-100
                   transition-all duration-150 cursor-pointer"
      >
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
