import { useEffect, useCallback } from 'react'

export default function Lightbox({ images, currentIndex, onClose, onPrev, onNext }) {
  const image = images[currentIndex]

  /* ── Keyboard navigation ─────────────────────────────────── */
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

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Lightbox */}
      <div className="fixed inset-0 z-[201] flex items-center justify-center pointer-events-none">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-6 w-10 h-10 rounded-full flex items-center justify-center
                     bg-app-card border border-app-border text-app-text text-xl
                     hover:bg-app-card2 transition-colors pointer-events-auto cursor-pointer"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Prev */}
        <button
          onClick={onPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center
                     bg-app-card border border-app-border text-app-text text-3xl
                     hover:bg-app-card2 transition-colors pointer-events-auto cursor-pointer
                     max-sm:hidden"
          aria-label="Previous"
        >
          ‹
        </button>

        {/* Image */}
        <div className="flex flex-col items-center max-w-[90vw] max-h-[92vh] pointer-events-auto">
          <img
            src={image.url || `/uploads/${image.filename}`}
            alt={`Page ${currentIndex + 1}`}
            className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
          />
          <p className="mt-3 text-app-text-sec text-sm text-center">
            Page {currentIndex + 1} of {images.length} &nbsp;·&nbsp; {image.filename}
          </p>
        </div>

        {/* Next */}
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center
                     bg-app-card border border-app-border text-app-text text-3xl
                     hover:bg-app-card2 transition-colors pointer-events-auto cursor-pointer
                     max-sm:hidden"
          aria-label="Next"
        >
          ›
        </button>

      </div>
    </>
  )
}
