import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

export default function Lightbox({ images, currentIndex, onClose, onPrev, onNext }) {
  const image = images[currentIndex]

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape')     onClose()
    if (e.key === 'ArrowLeft')  onPrev()
    if (e.key === 'ArrowRight') onNext()
  }, [onClose, onPrev, onNext])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [handleKey])

  if (!image) return null

  // ── Render via portal so `position:fixed` is relative to the VIEWPORT,
  //    not any transformed ancestor (animate-fade-up retains transform:translateY(0)
  //    via fill-mode:both, which creates a CSS containing block for fixed descendants).
  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75"
        style={{ zIndex: 9998 }}
        onClick={onClose}
      />

      {/* Shell */}
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 9999 }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center
                     bg-white border border-app-border text-app-text shadow-card-md
                     hover:bg-app-bg transition-colors cursor-pointer"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Prev */}
        {images.length > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); onPrev() }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center
                       bg-white border border-app-border text-app-text shadow-card-md
                       hover:bg-app-bg transition-colors cursor-pointer max-sm:hidden"
            aria-label="Previous"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Image + caption */}
        <div
          className="flex flex-col items-center px-4"
          style={{ maxWidth: '88vw', maxHeight: '92vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            key={image.url || image.storedFilename}
            src={image.url || `/uploads/raw/${image.storedFilename}`}
            alt={`Page ${currentIndex + 1}`}
            style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            className="rounded-2xl shadow-card-lg border border-app-border bg-white block"
          />
          <div className="mt-3 bg-white rounded-full shadow-card border border-app-border px-5 py-2 flex items-center gap-3">
            <span className="text-xs font-bold text-app-accent">PAGE {currentIndex + 1}</span>
            <span className="text-app-border text-sm">·</span>
            <span className="text-xs text-app-text-sec">{currentIndex + 1} of {images.length}</span>
            <span className="text-app-border text-sm">·</span>
            <span className="text-xs text-app-text-muted truncate" style={{ maxWidth: 200 }}>
              {image.originalName || image.storedFilename}
            </span>
          </div>
        </div>

        {/* Next */}
        {images.length > 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); onNext() }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center
                       bg-white border border-app-border text-app-text shadow-card-md
                       hover:bg-app-bg transition-colors cursor-pointer max-sm:hidden"
            aria-label="Next"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </>,
    document.body
  )
}
