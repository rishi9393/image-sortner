export default function Header({ onLogoClick, onNavigate, activeStep }) {
  const navItems = [
    { key: 'upload',      label: 'Upload'      },
    { key: 'notes',       label: 'My Notes'    },
    { key: 'collections', label: 'Collections' },
  ]

  return (
    <header className="bg-white border-b border-app-border sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Brand */}
        <button
          onClick={onLogoClick}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 bg-app-accent rounded-lg flex items-center justify-center shadow-blue group-hover:bg-app-accent-h transition-colors">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-app-text leading-none">Smart Notes</p>
            <p className="text-[10px] text-app-text-muted leading-none mt-0.5 uppercase tracking-wide">Image Sorter</p>
          </div>
        </button>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(({ key, label }) => {
            const isActive = activeStep === key
            return (
              <button
                key={key}
                onClick={() => onNavigate?.(key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer
                  ${isActive
                    ? 'bg-app-accent-light text-app-accent'
                    : 'text-app-text-sec hover:text-app-text hover:bg-app-bg'}`}
              >
                {label}
              </button>
            )
          })}
        </nav>

        {/* Right icons */}
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-full border border-app-border bg-app-bg flex items-center justify-center hover:bg-app-border transition-colors cursor-pointer">
            <svg className="w-4 h-4 text-app-text-sec" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <div className="w-9 h-9 rounded-full bg-app-accent flex items-center justify-center text-white text-xs font-bold shadow-blue cursor-pointer">
            JD
          </div>
        </div>

      </div>
    </header>
  )
}
