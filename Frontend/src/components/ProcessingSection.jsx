// phase: 0=upload active, 1=ocr active … 4=all done
// step index < phase → done, === phase → active, > phase → pending

export default function ProcessingSection({ steps, phase, phaseLabel }) {
  return (
    <section className="animate-fade-up flex justify-center">
      <div className="bg-app-card border border-app-border rounded-xl p-14 flex flex-col items-center text-center w-full max-w-lg">

        {/* Spinner */}
        <div className="relative w-20 h-20 mb-7">
          <div className="absolute inset-0 border-[3px] border-app-border border-t-app-accent rounded-full animate-spin-fast" />
          <span className="absolute inset-0 flex items-center justify-center text-3xl">🔍</span>
        </div>

        <h2 className="text-2xl font-semibold mb-2">Analysing Your Images…</h2>
        <p className="text-app-text-sec text-sm mb-8">{phaseLabel}</p>

        {/* Steps */}
        <div className="flex flex-col items-start gap-4 w-full max-w-xs mx-auto">
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
                {/* Dot */}
                <span
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 border-2 transition-all duration-300
                    ${isDone   ? 'bg-app-success border-app-success'
                    : isActive ? 'bg-app-accent border-app-accent'
                    :            'bg-transparent border-app-border'}`}
                />
                {s.label}
                {isDone && <span className="ml-1 text-xs">✓</span>}
              </div>
            )
          })}
        </div>

      </div>
    </section>
  )
}
