/**
 * ProcessingSection  –  v2
 *
 * Shows real per-image OCR progress (driven by SSE) instead of static steps.
 * When ocrProgress.total > 0 a live progress bar + "X / Y images" counter
 * replaces the spinner so the user knows exactly how far along processing is.
 *
 * Props:
 *   steps        – array of { id, label }
 *   phase        – 0=upload, 1=ocr, 2=detect, 3=sort, 4=done
 *   phaseLabel   – current status description string
 *   ocrProgress  – { done: number, total: number }  (0/0 = not yet started)
 */

export default function ProcessingSection({ steps, phase, phaseLabel, ocrProgress }) {
  const { done = 0, total = 0 } = ocrProgress || {}
  const showProgress = total > 0
  const pct          = showProgress ? Math.round((done / total) * 100) : 0

  return (
    <section className="animate-fade-up flex justify-center">
      <div className="bg-app-card border border-app-border rounded-xl p-14 flex flex-col items-center text-center w-full max-w-lg">

        {/* Spinner / progress ring */}
        <div className="relative w-20 h-20 mb-7">
          {showProgress ? (
            /* SVG progress ring — fills as images complete */
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40" cy="40" r="34"
                fill="none"
                strokeWidth="5"
                className="stroke-app-border"
              />
              <circle
                cx="40" cy="40" r="34"
                fill="none"
                strokeWidth="5"
                strokeLinecap="round"
                className="stroke-app-accent transition-all duration-300"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
              />
            </svg>
          ) : (
            <div className="absolute inset-0 border-[3px] border-app-border border-t-app-accent rounded-full animate-spin-fast" />
          )}
          <span className="absolute inset-0 flex items-center justify-center text-2xl">
            {showProgress ? (
              <span className="text-sm font-semibold tabular-nums text-app-text">{pct}%</span>
            ) : '🔍'}
          </span>
        </div>

        <h2 className="text-2xl font-semibold mb-2">Analysing Your Images…</h2>
        <p className="text-app-text-sec text-sm mb-2">{phaseLabel}</p>

        {/* Live image counter */}
        {showProgress && (
          <p className="text-app-accent text-sm font-medium mb-6 tabular-nums">
            {done} / {total} image{total !== 1 ? 's' : ''} processed
          </p>
        )}

        {/* Progress bar (only when OCR is running) */}
        {showProgress && (
          <div className="w-full max-w-xs mx-auto mb-6">
            <div className="h-1.5 w-full bg-app-border rounded-full overflow-hidden">
              <div
                className="h-full bg-app-accent rounded-full transition-all duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Step indicators */}
        <div className={`flex flex-col items-start gap-4 w-full max-w-xs mx-auto ${showProgress ? '' : 'mt-2'}`}>
          {steps.map((s, idx) => {
            const isDone   = idx < phase
            const isActive = idx === phase

            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 text-sm transition-colors duration-300
                  ${isDone   ? 'text-app-success'
                  : isActive ? 'text-app-text'
                  :            'text-app-text-muted'}`}
              >
                {/* Status dot */}
                <span
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 border-2 transition-all duration-300
                    ${isDone   ? 'bg-app-success border-app-success'
                    : isActive ? 'bg-app-accent  border-app-accent animate-pulse'
                    :            'bg-transparent border-app-border'}`}
                />
                {s.label}
                {isDone   && <span className="ml-1 text-xs opacity-70">✓</span>}
                {isActive && s.id === 'ocr' && showProgress && (
                  <span className="ml-auto text-xs tabular-nums text-app-text-muted">
                    {done}/{total}
                  </span>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </section>
  )
}
