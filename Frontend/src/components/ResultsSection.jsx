import ImageCard from './ImageCard.jsx'

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

export default function ResultsSection({ sortResults, onDownloadPDF, onSortAgain, onOpenLightbox }) {
  const { sortMethod, sortMethodDescription, images } = sortResults
  const badgeClass = BADGE_STYLES[sortMethod] || BADGE_STYLES.original_order

  return (
    <section className="animate-fade-up">

      {/* ── Results header ─────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-7 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Sorted Results</h2>
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium
                       bg-app-accent text-white border border-app-accent
                       hover:bg-app-accent-h hover:border-app-accent-h
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
      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">
        {images.map((img, idx) => (
          <ImageCard
            key={img.filename || idx}
            image={img}
            sortedIndex={idx + 1}
            onClick={() => onOpenLightbox(idx)}
          />
        ))}
      </div>

    </section>
  )
}
