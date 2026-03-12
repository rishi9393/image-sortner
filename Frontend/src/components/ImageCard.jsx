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
      className="bg-app-card border border-app-border rounded-xl overflow-hidden cursor-pointer
                 relative transition-all duration-200 outline-none select-none group
                 hover:-translate-y-1 hover:border-app-accent hover:shadow-[0_8px_32px_rgba(108,99,255,0.2)]
                 focus:border-app-accent"
    >
      {/* ── Page-number badge (top-left) ─────────────────── */}
      <span
        className="absolute top-2.5 left-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center
                   bg-app-accent text-white text-xs font-bold shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
      >
        {sortedIndex}
      </span>

      {/* ── Remove button (top-right) ─────────────────────── */}
      <button
        type="button"
        aria-label={`Remove image ${originalName}`}
        onClick={(e) => {
          e.stopPropagation()   // don't open the lightbox
          onRemove()
        }}
        className="absolute top-2 right-2 z-20
                   w-6 h-6 rounded-full flex items-center justify-center
                   bg-black/50 text-white/80
                   opacity-0 group-hover:opacity-100
                   hover:!opacity-100 hover:bg-red-500 hover:text-white hover:scale-110
                   transition-all duration-150 cursor-pointer"
      >
        {/* ✕ icon */}
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="2" y1="2" x2="10" y2="10" />
          <line x1="10" y1="2" x2="2"  y2="10" />
        </svg>
      </button>

      {/* ── Thumbnail ────────────────────────────────────── */}
      <img
        src={url}
        alt={`Page ${sortedIndex}`}
        className="w-full aspect-[3/4] object-cover block bg-app-bg"
        loading="lazy"
      />

      {/* ── Signal pills ─────────────────────────────────── */}
      {(hasPage || hasTs || hasCont) && (
        <div className="flex gap-1 flex-wrap px-3 pt-2">
          {hasPage && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                             bg-[rgba(34,197,94,0.12)] text-app-success">
              📄 pg {signals.pageNumber.value}
            </span>
          )}
          {hasTs && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                             bg-[rgba(59,130,246,0.12)] text-app-info">
              🕐 ts
            </span>
          )}
          {hasCont && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                             bg-[rgba(245,158,11,0.12)] text-app-warning">
              🔗 flow
            </span>
          )}
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────── */}
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-app-text mb-0.5">Page {sortedIndex}</p>
        <p className="text-[11px] text-app-text-muted truncate">{originalName}</p>
      </div>
    </div>
  )
}
