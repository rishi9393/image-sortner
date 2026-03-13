export default function ImageCard({ image, sortedIndex, onClick, onRemove }) {
  const { originalName, url, signals } = image

  const hasPage = signals?.pageNumber != null
  const hasTs   = signals?.timestamp  != null
  const hasCont = image.ocrConfidence != null && image.ocrConfidence > 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      className="bg-white border border-app-border rounded-2xl overflow-hidden cursor-pointer
                 relative transition-all duration-200 outline-none select-none group shadow-card
                 hover:-translate-y-1 hover:border-app-accent hover:shadow-card-lg
                 focus:border-app-accent focus:ring-2 focus:ring-app-accent/20"
    >
      {/* ── PAGE badge (top-left, matching Figma notes.png) ── */}
      <span
        className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-md flex items-center
                   bg-app-accent text-white text-[10px] font-bold tracking-wide shadow-blue"
      >
        PAGE {sortedIndex}
      </span>

      {/* ── Remove button (top-right) ──────────────────────── */}
      <button
        type="button"
        aria-label={`Remove image ${originalName}`}
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="absolute top-2 right-2 z-20
                   w-6 h-6 rounded-full flex items-center justify-center
                   bg-white/80 text-app-text-muted border border-app-border
                   opacity-0 group-hover:opacity-100
                   hover:!opacity-100 hover:bg-app-error hover:text-white hover:border-app-error hover:scale-110
                   transition-all duration-150 cursor-pointer shadow-card"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="2" y1="2" x2="10" y2="10" />
          <line x1="10" y1="2" x2="2"  y2="10" />
        </svg>
      </button>

      {/* ── Thumbnail ──────────────────────────────────────── */}
      <img
        src={url}
        alt={`Page ${sortedIndex}`}
        className="w-full aspect-[3/4] object-cover block bg-app-bg"
        loading="lazy"
      />

      {/* ── Signal pills ───────────────────────────────────── */}
      {(hasPage || hasTs || hasCont) && (
        <div className="flex gap-1 flex-wrap px-3 pt-2">
          {hasPage && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                             bg-app-success-bg text-app-success border border-green-200">
              📄 pg {signals.pageNumber.value}
            </span>
          )}
          {hasTs && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                             bg-app-info-bg text-app-info border border-blue-200">
              🕐 ts
            </span>
          )}
          {hasCont && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                             bg-app-warning-bg text-app-warning border border-yellow-200">
              🔗 flow
            </span>
          )}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold text-app-text mb-0.5 truncate">{originalName}</p>
        </div>
        {/* Drag handle dots */}
        <button
          onClick={(e) => e.stopPropagation()}
          className="ml-2 flex-shrink-0 p-1 rounded hover:bg-app-bg transition-colors cursor-grab"
        >
          <svg className="w-3 h-3 text-app-text-muted" fill="currentColor" viewBox="0 0 12 12">
            <circle cx="4" cy="3" r="1"/><circle cx="8" cy="3" r="1"/>
            <circle cx="4" cy="6" r="1"/><circle cx="8" cy="6" r="1"/>
            <circle cx="4" cy="9" r="1"/><circle cx="8" cy="9" r="1"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
