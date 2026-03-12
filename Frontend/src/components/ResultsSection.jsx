import { useState, useCallback } from 'react'
import ImageCard from './ImageCard.jsx'
import Lightbox  from './Lightbox.jsx'

const BADGE_STYLES = {
  filename_order:  'bg-[rgba(168,85,247,0.12)] text-purple-400   border-purple-400',
  page_number:     'bg-[rgba(34,197,94,0.12)]  text-app-success  border-app-success',
  timestamp:       'bg-[rgba(59,130,246,0.12)] text-app-info     border-app-info',
  text_continuity: 'bg-[rgba(245,158,11,0.12)] text-app-warning  border-app-warning',
  original_order:  'bg-app-card2               text-app-text-muted border-app-border',
}

const BADGE_ICONS = {
  filename_order:  '🔢',
  page_number:     '📄',
  timestamp:       '🕐',
  text_continuity: '🔗',
  original_order:  '📋',
}

export default function ResultsSection({ sortResults, onDownloadPDF, onSortAgain }) {
  const { sortMethod, sortMethodDescription } = sortResults

  // ── Local image list — starts from sorted results, shrinks on removal ──────
  const [images,  setImages]  = useState(() => sortResults.images)
  const [lightbox, setLightbox] = useState({ open: false, index: 0 })

  // ── Remove an image by its current position, then renumber remaining ───────
  const handleRemove = useCallback((targetIdx) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== targetIdx)
      return next.map((img, i) => ({ ...img, sortedIndex: i + 1 }))
    })
    // If the lightbox is open and showing this or a later card, adjust index
    setLightbox((lb) => {
      if (!lb.open) return lb
      if (targetIdx < lb.index) return { ...lb, index: lb.index - 1 }
      if (targetIdx === lb.index) return { open: false, index: 0 }
      return lb
    })
  }, [])

  // ── Lightbox helpers ───────────────────────────────────────────────────────
  const openLightbox  = useCallback((idx) => setLightbox({ open: true, index: idx }), [])
  const closeLightbox = useCallback(() => setLightbox((p) => ({ ...p, open: false })), [])
  const navLightbox   = useCallback((dir) => {
    setLightbox((p) => ({
      ...p,
      index: (p.index + dir + images.length) % images.length,
    }))
  }, [images.length])

  const badgeClass = BADGE_STYLES[sortMethod] || BADGE_STYLES.original_order

  return (
    <section className="animate-fade-up">

      {/* ── Results header ─────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-7 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold mb-2">
            Sorted Results
            <span className="ml-2 text-base font-normal text-app-text-muted">
              ({images.length} image{images.length !== 1 ? 's' : ''})
            </span>
          </h2>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                        uppercase tracking-wide border mb-2 ${badgeClass}`}
          >
            <span>{BADGE_ICONS[sortMethod]}</span>
            {(sortMethod || 'original_order').replace(/_/g, ' ')}
          </span>

          {sortMethodDescription && (
            <p className="text-app-text-sec text-sm max-w-lg">{sortMethodDescription}</p>
          )}
        </div>

        <div className="flex gap-2.5 flex-shrink-0">
          <button
            onClick={onDownloadPDF}
            disabled={images.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
                       bg-app-accent text-white border border-app-accent
                       hover:bg-app-accent-h hover:border-app-accent-h
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors duration-200 cursor-pointer"
          >
            <span>⬇</span> Download PDF
          </button>
          <button
            onClick={onSortAgain}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
                       bg-transparent text-app-text-sec border border-app-border
                       hover:bg-app-card2 hover:text-app-text hover:border-app-border-hover
                       transition-colors duration-200 cursor-pointer"
          >
            ↩ Sort New Images
          </button>
        </div>
      </div>

      {/* ── Image grid ─────────────────────────────────────── */}
      {images.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">
          {images.map((img, idx) => (
            <ImageCard
              key={img.storedFilename || img.originalName || idx}
              image={img}
              sortedIndex={idx + 1}
              onClick={() => openLightbox(idx)}
              onRemove={() => handleRemove(idx)}
            />
          ))}
        </div>
      ) : (
        /* ── Empty state after all images removed ────────── */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-5xl mb-4">🗑️</span>
          <p className="text-lg font-semibold text-app-text mb-1">No images left</p>
          <p className="text-app-text-muted text-sm mb-6">
            You removed all images from the sorted list.
          </p>
          <button
            onClick={onSortAgain}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
                       bg-app-accent text-white hover:bg-app-accent-h transition-colors duration-200 cursor-pointer"
          >
            ↩ Start Over
          </button>
        </div>
      )}

      {/* ── Lightbox — uses the live `images` list so removals are reflected ── */}
      {lightbox.open && images.length > 0 && (
        <Lightbox
          images={images}
          currentIndex={lightbox.index}
          onClose={closeLightbox}
          onPrev={() => navLightbox(-1)}
          onNext={() => navLightbox(1)}
        />
      )}

    </section>
  )
}
