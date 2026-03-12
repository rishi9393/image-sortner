import { useCallback, useRef, useState } from 'react'

const MAX_FILES   = 50
const MAX_SIZE_MB = 10
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
      errors.push(`"${f.name}" exceeds the 10 MB limit.`)
    } else {
      valid.push(f)
    }
  }
  return { valid, errors }
}

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

  /* ── Drag events ─────────────────────────────────────────── */
  const onDragOver  = (e) => { e.preventDefault(); setIsDragOver(true) }
  const onDragLeave = ()  => setIsDragOver(false)
  const onDrop      = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    processIncoming(e.dataTransfer.files)
  }

  const onFileChange = (e) => {
    processIncoming(e.target.files)
    e.target.value = ''
  }

  const onZoneClick  = () => fileInputRef.current?.click()
  const onZoneKeyDown = (e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }

  const displayError = validationError || error
  const hasFiles = files.length > 0

  return (
    <section className="animate-fade-up">
      <div className="bg-app-card border border-app-border rounded-xl p-8">

        {/* Title */}
        <h2 className="text-xl font-semibold mb-1">Upload Your Note Images</h2>
        <p className="text-app-text-sec text-sm mb-6">
          Supports JPG, JPEG, PNG, WEBP &nbsp;·&nbsp; Max {MAX_FILES} images &nbsp;·&nbsp; {MAX_SIZE_MB} MB each
        </p>

        {/* Drop Zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={onZoneClick}
          onKeyDown={onZoneKeyDown}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`
            border-2 border-dashed rounded-xl py-14 px-8 text-center cursor-pointer
            transition-colors duration-200 outline-none select-none
            ${isDragOver
              ? 'border-app-accent bg-[rgba(108,99,255,0.12)]'
              : 'border-app-border hover:border-app-accent hover:bg-[rgba(108,99,255,0.07)] focus:border-app-accent'}
          `}
        >
          <div className="text-5xl mb-3">🖼️</div>
          <p className="font-medium text-app-text">Drag &amp; drop images here</p>
          <p className="text-app-text-sec text-sm mt-2">
            or <span className="text-app-accent underline cursor-pointer">browse files</span>
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

        {/* File list */}
        {hasFiles && (
          <div className="mt-5">
            <div className="flex justify-between items-center mb-2 text-sm text-app-text-sec">
              <span>{files.length} file{files.length !== 1 ? 's' : ''} selected</span>
              <span>{files.length}/{MAX_FILES} max</span>
            </div>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {files.map((file, i) => (
                <FileItem key={`${file.name}-${i}`} file={file} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {hasFiles && (
          <div className="flex gap-3 justify-end mt-5">
            <button
              onClick={onClear}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
                         bg-transparent text-app-text-sec border border-app-border
                         hover:bg-app-card2 hover:text-app-text hover:border-app-border-hover
                         transition-colors duration-200 cursor-pointer"
            >
              ✕ Clear
            </button>
            <button
              onClick={onSort}
              disabled={files.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
                         bg-app-accent text-white border border-app-accent
                         hover:bg-app-accent-h hover:border-app-accent-h
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors duration-200 cursor-pointer"
            >
              <span>⬆</span> Sort These Images
            </button>
          </div>
        )}

        {/* Error */}
        {displayError && (
          <div className="mt-4 px-4 py-3 rounded-lg text-sm bg-[rgba(239,68,68,0.12)] border border-app-error text-[#fca5a5]">
            {displayError}
          </div>
        )}

      </div>
    </section>
  )
}

/* ── File Item ─────────────────────────────────────────────── */
function FileItem({ file }) {
  const [thumb] = useState(() => URL.createObjectURL(file))
  return (
    <div className="flex items-center gap-3 bg-app-card2 border border-app-border rounded-lg px-3 py-2 text-sm">
      <img
        src={thumb}
        alt={file.name}
        onLoad={() => {}} // keep alive
        className="w-10 h-10 object-cover rounded flex-shrink-0 bg-app-bg"
      />
      <span className="flex-1 text-app-text truncate">{file.name}</span>
      <span className="text-app-text-muted text-xs flex-shrink-0">{formatBytes(file.size)}</span>
    </div>
  )
}
