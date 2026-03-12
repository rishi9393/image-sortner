export default function ImageCard({ image, sortedIndex, onClick }) {
  const { filename, url, pageNumber, hasTimestamp, textContinuityScore } = image

  const hasPage = pageNumber != null
  const hasCont = textContinuityScore != null && textContinuityScore > 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      className="bg-app-card border border-app-border rounded-xl overflow-hidden cursor-pointer
                 relative transition-all duration-200 outline-none select-none
                 hover:-translate-y-1 hover:border-app-accent hover:shadow-[0_8px_32px_rgba(108,99,255,0.2)]
                 focus:border-app-accent"
    >
      {/* Badge */}
      <span
        className="absolute top-2.5 left-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center
                   bg-app-accent text-white text-xs font-bold shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
      >
        {sortedIndex}
      </span>

      {/* Thumbnail */}
      <img
        src={url || `/uploads/${filename}`}
        alt={`Page ${sortedIndex}`}
        className="w-full aspect-[3/4] object-cover block bg-app-bg"
        loading="lazy"
      />

      {/* Signals */}
      {(hasPage || hasTimestamp || hasCont) && (
        <div className="flex gap-1 flex-wrap px-3 pt-2">
          {hasPage && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                             bg-[rgba(34,197,94,0.12)] text-app-success">
              📄 pg {pageNumber}
            </span>
          )}
          {hasTimestamp && (
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

      {/* Footer */}
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-app-text mb-0.5">Page {sortedIndex}</p>
        <p className="text-[11px] text-app-text-muted truncate">{filename}</p>
      </div>
    </div>
  )
}
