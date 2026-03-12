export default function Header() {
  return (
    <header className="bg-app-card border-b border-app-border sticky top-0 z-50 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* ── Brand — left side ─────────────────────────────── */}
        <div className="flex items-center gap-2.5">
          <span className="text-xl leading-none">📚</span>
          <span className="text-lg font-bold bg-gradient-to-r from-[#6c63ff] to-[#a78bfa] bg-clip-text text-transparent whitespace-nowrap">
            Smart Notes Sorter
          </span>
        </div>

        {/* ── Tagline — right side (hidden on small screens) ── */}
        <p className="hidden sm:block text-app-text-muted text-xs">
          Upload shuffled notes → get them sorted automatically
        </p>

      </div>
    </header>
  )
}
