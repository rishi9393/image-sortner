/**
 * ProcessingSection  –  v3 (Figma redesign)
 *
 * Matches the "Uploading Documents" + "Uploads & Processing" Figma screens.
 * Shows a total-progress card + per-file queue list driven by real SSE events.
 */

export default function ProcessingSection({ steps, phase, phaseLabel, ocrProgress }) {
  const { done = 0, total = 0 } = ocrProgress || {}
  const showProgress = total > 0
  const pct = showProgress ? Math.round((done / total) * 100) : 0

  // Map phase → friendly label for the status chip
  const phaseChip = {
    0: { label: 'Uploading',  color: 'bg-blue-100 text-app-accent' },
    1: { label: 'Analyzing',  color: 'bg-purple-100 text-purple-600' },
    2: { label: 'Detecting',  color: 'bg-yellow-100 text-yellow-700' },
    3: { label: 'Sorting',    color: 'bg-orange-100 text-orange-600' },
    4: { label: 'Complete',   color: 'bg-green-100 text-app-success' },
  }[phase] || { label: 'Processing', color: 'bg-blue-100 text-app-accent' }

  return (
    <section className="animate-fade-up">

      {/* ── Page heading ────────────────────────────────── */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-3xl font-extrabold text-app-text mb-1">
            {phase === 0 ? 'Uploading Documents' : 'Uploads & Processing'}
          </h1>
          <p className="text-app-text-sec text-sm">
            {phase === 0
              ? 'Please wait while your files are securely uploaded to the cloud.'
              : 'AI-powered extraction of timestamps and page organization.'}
          </p>
        </div>
        {phase > 0 && (
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-app-accent text-white text-sm font-semibold rounded-full shadow-blue hover:bg-app-accent-h transition-colors cursor-not-allowed opacity-60">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload More
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">

        {/* ── Total progress card ─────────────────────── */}
        <div className="bg-white rounded-2xl border border-app-border shadow-card p-5">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-app-accent-light rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-app-text">Total Upload Progress</p>
                <span className="text-xl font-extrabold text-app-accent tabular-nums">{pct}%</span>
              </div>
              <p className="text-xs text-app-text-muted mb-3">
                {showProgress
                  ? `${total - done} files remaining · ${total} total`
                  : phaseLabel}
              </p>
              {/* Progress bar */}
              <div className="h-2 w-full bg-app-bg rounded-full overflow-hidden border border-app-border">
                <div
                  className="h-full bg-app-accent rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(pct, phase === 0 ? 5 : 0)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Currently analyzing card (phase 1+) ─────── */}
        {phase >= 1 && showProgress && (
          <div className="bg-white rounded-2xl border border-app-border shadow-card p-5">
            <div className="flex items-start gap-4">
              {/* Thumbnail placeholder */}
              <div className="w-24 h-24 bg-app-bg rounded-xl border border-app-border flex-shrink-0 flex items-center justify-center relative overflow-hidden">
                <svg className="w-8 h-8 text-app-border" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
                </svg>
                <div className="absolute inset-0 flex items-end justify-center pb-2">
                  <span className="text-[9px] font-bold text-app-text-muted uppercase tracking-wide bg-white/80 px-1.5 rounded">Scanning AI</span>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-app-accent uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-app-accent animate-pulse inline-block" />
                    Currently Analyzing
                  </span>
                  <span className="ml-auto text-xl font-extrabold text-app-accent tabular-nums">{pct}%</span>
                </div>

                <p className="text-base font-bold text-app-text mb-0.5 truncate">
                  Image {done + 1} of {total}
                </p>
                <p className="text-xs text-app-text-sec mb-3">{phaseLabel}</p>

                <div className="flex items-center justify-between text-[10px] font-semibold text-app-text-muted uppercase tracking-wide mb-1.5">
                  <span>Progress</span>
                  <span>Estimated: ~{Math.max(1, Math.round((total - done) * 2))}s</span>
                </div>
                <div className="h-1.5 w-full bg-app-bg rounded-full overflow-hidden border border-app-border">
                  <div
                    className="h-full bg-app-accent rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Metadata chips */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-app-bg rounded-xl border border-app-border text-xs">
                    <svg className="w-3 h-3 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-app-text-muted font-semibold uppercase tracking-wide text-[9px]">Timestamp</span>
                    <span className="text-app-text font-bold">Detecting…</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-app-bg rounded-xl border border-app-border text-xs">
                    <svg className="w-3 h-3 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="text-app-text-muted font-semibold uppercase tracking-wide text-[9px]">Page Num</span>
                    <span className="text-app-text font-bold">Page {done + 1} of {total}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-app-bg rounded-xl border border-app-border text-xs">
                    <svg className="w-3 h-3 text-app-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-app-text-muted font-semibold uppercase tracking-wide text-[9px]">Legibility</span>
                    <span className="text-app-text font-bold">Analyzing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── File Queue / Step indicators ────────────── */}
        <div className="bg-white rounded-2xl border border-app-border shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-app-text-muted uppercase tracking-widest">
              {phase >= 1 ? 'Waiting in Queue' : 'File Queue'}
            </h3>
            {phase >= 1 && (
              <button className="text-xs text-app-error font-semibold hover:underline cursor-pointer">Clear All</button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {steps.map((s, idx) => {
              const isDone   = idx < phase
              const isActive = idx === phase

              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-4 p-3 rounded-xl border transition-all duration-300
                    ${isDone   ? 'bg-app-success-bg border-green-200'
                    : isActive ? 'bg-app-accent-light border-blue-200'
                    :            'bg-app-bg border-app-border'}`}
                >
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                    ${isDone   ? 'bg-app-success-bg'
                    : isActive ? 'bg-app-accent-light'
                    :            'bg-app-bg border border-app-border'}`}
                  >
                    {isDone ? (
                      <svg className="w-4 h-4 text-app-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isActive ? (
                      <svg className="w-4 h-4 text-app-accent animate-spin-fast" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-app-border block" />
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate
                      ${isDone ? 'text-app-success' : isActive ? 'text-app-accent' : 'text-app-text-muted'}`}
                    >
                      {s.label}
                    </p>
                    {isActive && (
                      <p className="text-xs text-app-text-sec mt-0.5">{phaseLabel}</p>
                    )}
                  </div>

                  {/* Status badge */}
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full flex-shrink-0
                    ${isDone   ? 'bg-app-success-bg text-app-success'
                    : isActive ? 'bg-app-accent-light text-app-accent'
                    :            'bg-app-bg text-app-text-muted border border-app-border'}`}
                  >
                    {isDone ? 'Done' : isActive ? 'Running' : 'Pending'}
                  </span>

                  {/* OCR progress inline */}
                  {isActive && s.id === 'ocr' && showProgress && (
                    <span className="text-xs font-bold tabular-nums text-app-accent ml-1 flex-shrink-0">
                      {done}/{total}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Info note */}
          <div className="mt-4 flex items-start gap-2.5 px-4 py-3 bg-app-accent-light rounded-xl border border-blue-200">
            <svg className="w-4 h-4 text-app-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-app-text-sec">
              AI processing will begin automatically once the first batch of uploads is complete.
            </p>
          </div>
        </div>

      </div>
    </section>
  )
}
