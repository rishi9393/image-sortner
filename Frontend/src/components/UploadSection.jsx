import { useCallback, useRef, useState } from 'react'

const MAX_FILES   = 50
const MAX_SIZE_MB = 20
const VALID_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

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

const RECENT_UPLOADS = [
  { name: 'Math_Linear_Algebra.jpg', status: "Sorted into 'Calculus'" },
  { name: 'Lecture_Physics_12.png',  status: 'Processing…' },
]

const PRO_TIPS = [
  'Ensure good lighting when taking photos of handwritten notes for better OCR accuracy.',
  'You can upload multiple files at once. The AI will group them automatically based on content.',
  'Tag your images before uploading to force them into specific project folders.',
]

export default function UploadSection({ files, error, onFilesSelected, onClear, onSort }) {
  const fileInputRef = useRef(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [validationError, setValidationError] = useState(null)

  const processIncoming = useCallback((fileList) => {
    const { valid, errors } = validateFiles(Array.from(fileList))
    if (errors.length) setValidationError(errors[0])
    else setValidationError(null)
    if (valid.length) onFilesSelected(valid)
  }, [onFilesSelected])

  const onDragOver  = (e) => { e.preventDefault(); setIsDragOver(true) }
  const onDragLeave = ()  => setIsDragOver(false)
  const onDrop      = (e) => { e.preventDefault(); setIsDragOver(false); processIncoming(e.dataTransfer.files) }
  const onFileChange = (e) => { processIncoming(e.target.files); e.target.value = '' }
  const onZoneClick  = () => fileInputRef.current?.click()

  const displayError = validationError || error
  const hasFiles = files.length > 0

  return (
    <section className="animate-fade-up">
      {/* Page heading */}
      <div className="mb-7">
        <h1 className="text-3xl font-extrabold text-app-text mb-1">Upload Your Notes</h1>
        <p className="text-app-text-sec">Instantly organize your handwritten or digital study materials with AI-powered sorting.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">

        {/* ── Left: Upload zone ──────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-app-border shadow-card p-6">

            {/* Drop zone */}
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
              {/* Icons */}
              <div className="flex justify-center gap-3 mb-5">
                <div className="w-14 h-14 bg-app-accent-light rounded-2xl flex items-center justify-center shadow-card">
                  <svg className="w-7 h-7 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center shadow-card">
                  <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              <p className="text-base font-bold text-app-text mb-1.5">
                Drag your notes here to start sorting
              </p>
              <p className="text-app-text-sec text-sm mb-6">
                We support JPG, PNG, and HEIC formats. High resolution images work best for handwritten notes.
              </p>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onZoneClick() }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-app-accent text-white text-sm font-semibold
                           rounded-full hover:bg-app-accent-h transition-colors shadow-blue cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Select Files
              </button>

              <p className="mt-3 text-xs text-app-text-muted">
                or <span className="text-app-accent font-medium hover:underline cursor-pointer">link Google Drive</span>
              </p>

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
                { icon: '✓', label: 'SECURE UPLOAD' },
                { icon: '✓', label: 'AUTO-OCR' },
                { icon: '✓', label: `${MAX_SIZE_MB}MB MAX` },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs font-semibold text-app-text-sec uppercase tracking-wide">
                  <svg className="w-3.5 h-3.5 text-app-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* File list */}
          {hasFiles && (
            <div className="bg-white rounded-2xl border border-app-border shadow-card p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-app-text">
                  Selected Files
                  <span className="ml-2 px-2 py-0.5 bg-app-accent-light text-app-accent text-xs font-bold rounded-full">
                    {files.length}
                  </span>
                </h3>
                <span className="text-xs text-app-text-muted">{files.length}/{MAX_FILES} max</span>
              </div>
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                {files.map((file, i) => (
                  <FileItem key={`${file.name}-${i}`} file={file} index={i} />
                ))}
              </div>
              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-app-border">
                <button
                  onClick={onClear}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                             bg-white text-app-text-sec border border-app-border
                             hover:bg-app-bg hover:text-app-text hover:border-app-border-hover
                             transition-colors cursor-pointer"
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

        {/* ── Right: Sidebar ─────────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Recent Uploads */}
          <div className="bg-white rounded-2xl border border-app-border shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-app-text">Recent Uploads</h3>
              <span className="text-xs text-app-accent font-semibold hover:underline cursor-pointer">View All</span>
            </div>
            <div className="flex flex-col gap-3">
              {RECENT_UPLOADS.map(({ name, status }) => (
                <div key={name} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-app-bg rounded-xl border border-app-border flex-shrink-0 flex items-center justify-center">
                    <svg className="w-5 h-5 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-app-text truncate">{name}</p>
                    <p className={`text-xs truncate ${status === 'Processing…' ? 'text-app-warning' : 'text-app-text-muted'}`}>{status}</p>
                  </div>
                </div>
              ))}
            </div>
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

function FileItem({ file }) {
  const [thumb] = useState(() => URL.createObjectURL(file))
  return (
    <div className="flex items-center gap-3 bg-app-bg border border-app-border rounded-xl px-3 py-2 text-sm">
      <img
        src={thumb}
        alt={file.name}
        className="w-9 h-9 object-cover rounded-lg flex-shrink-0 bg-app-border"
      />
      <span className="flex-1 text-app-text text-sm truncate">{file.name}</span>
      <span className="text-app-text-muted text-xs flex-shrink-0">{formatBytes(file.size)}</span>
    </div>
  )
}
