import { useState } from 'react'

export default function LandingPage({ onGetStarted, onGoToSignIn, onGoToRegister, currentUser, onSignOut }) {
  const [showBanner, setShowBanner] = useState(true)
  const [importModal, setImportModal] = useState(null) // 'whatsapp' | 'telegram' | null

  const IMPORT_GUIDES = {
    whatsapp: {
      title: 'Import from WhatsApp',
      color: '#25D366',
      lightColor: '#f0fdf4',
      borderColor: '#bbf7d0',
      emoji: '💬',
      steps: [
        { step: '01', text: 'Open WhatsApp and go to the chat that contains your note photos.' },
        { step: '02', text: 'Tap the attachment icon → select the photos you want to sort.' },
        { step: '03', text: 'Save them to your device\'s camera roll or Downloads folder.' },
        { step: '04', text: 'Come back here and upload those saved photos using the upload zone.' },
      ],
      tip: 'You can also use WhatsApp Web → right-click any image → Save As to bulk-save faster.',
    },
    telegram: {
      title: 'Import from Telegram',
      color: '#229ED9',
      lightColor: '#eff6ff',
      borderColor: '#bfdbfe',
      emoji: '✈️',
      steps: [
        { step: '01', text: 'Open Telegram and navigate to the chat with your note images.' },
        { step: '02', text: 'Long-press a photo → select multiple → tap the download icon.' },
        { step: '03', text: 'Or forward them to your "Saved Messages" for easy access.' },
        { step: '04', text: 'Come back here and upload those downloaded photos to start sorting.' },
      ],
      tip: 'Telegram Desktop lets you select all media in a chat at once — the fastest way to bulk-export.',
    },
  }

  const guide = importModal ? IMPORT_GUIDES[importModal] : null

  const totalNotes = (() => {
    try {
      const cols = JSON.parse(localStorage.getItem('collections') || '[]').filter(c => !c.trashed)
      const inCollections = cols.reduce((sum, c) => sum + (c.notesList?.length || 0), 0)
      const uncategorized = JSON.parse(localStorage.getItem('uncategorized_notes') || '[]').length
      return inCollections + uncategorized
    } catch { return 0 }
  })()
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Announcement Bar ──────────────────────────────── */}
      {showBanner && (
        <div className="bg-app-accent text-white text-sm py-2.5 px-4 flex items-center justify-center gap-3 relative">
          <span className="inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            <strong>New:</strong> AI-powered Collections are here —
          </span>
          <button onClick={onGetStarted} className="underline underline-offset-2 font-semibold hover:text-blue-100 transition-colors cursor-pointer">
            Try it free →
          </button>
          <button onClick={() => setShowBanner(false)} className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-app-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-app-accent rounded-lg flex items-center justify-center shadow-blue">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-app-text">SmartNotes</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features"   className="text-sm text-app-text-sec hover:text-app-text transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-app-text-sec hover:text-app-text transition-colors">How it works</a>
            <a href="#pricing"    className="text-sm text-app-text-sec hover:text-app-text transition-colors">Pricing</a>
          </div>

          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-app-bg border border-app-border">
                <div className="w-6 h-6 rounded-full bg-app-accent flex items-center justify-center text-white text-[10px] font-bold">
                  {currentUser.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-app-text">{currentUser.name.split(' ')[0]}</span>
              </div>
              <button onClick={onSignOut}
                className="text-sm font-medium text-app-text-sec hover:text-app-text transition-colors cursor-pointer">
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={onGoToSignIn}
                className="px-4 py-2 text-sm font-semibold text-app-text hover:text-app-accent transition-colors cursor-pointer">
                Sign In
              </button>
              <button onClick={onGoToRegister}
                className="px-5 py-2 bg-app-accent text-white text-sm font-semibold rounded-full
                           hover:bg-app-accent-h transition-colors shadow-blue cursor-pointer">
                Get Started
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid md:grid-cols-2 gap-12 items-center">

        {/* Left */}
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-app-accent-light text-app-accent text-xs font-semibold mb-6 tracking-wide uppercase">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            AI-Powered Organization
          </span>

          {/* Social proof avatars */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex -space-x-2">
              {[
                { bg: 'bg-blue-500',    initials: 'PR' },
                { bg: 'bg-emerald-500', initials: 'AK' },
                { bg: 'bg-violet-500',  initials: 'MS' },
                { bg: 'bg-orange-400',  initials: 'JL' },
                { bg: 'bg-rose-500',    initials: 'TC' },
              ].map(({ bg, initials }) => (
                <div key={initials}
                  className={`w-8 h-8 rounded-full ${bg} border-2 border-white flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                  {initials}
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-0.5 mb-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-3 h-3 fill-amber-400" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-xs text-app-text-sec">Trusted by <span className="font-bold text-app-text">12,000+</span> students &amp; professionals</p>
            </div>
          </div>

          <h1 className="text-5xl font-extrabold leading-tight text-app-text mb-4">
            Your notes,<br />
            <span style={{ background: 'linear-gradient(135deg,#2563eb 0%,#7c3aed 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              perfectly ordered.
            </span>
          </h1>

          <p className="text-app-text-sec text-lg mb-8 leading-relaxed">
            Automatically sort and organize handwritten photos from your messaging apps into structured, searchable sequences.
          </p>

          {/* Mini Upload Zone */}
          <div
            onClick={onGetStarted}
            className="border-2 border-dashed border-app-border rounded-2xl p-8 text-center cursor-pointer
                       hover:border-app-accent hover:bg-app-accent-light/30 transition-all duration-200 mb-5 group"
          >
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full bg-app-accent-light flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-semibold text-app-text mb-1">Click to upload or drag and drop</p>
            <p className="text-xs text-app-text-muted">PNG, JPG or HEIC (MAX. 20MB per batch)</p>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-app-border" />
            <span className="text-xs text-app-text-muted font-medium">OR IMPORT FROM</span>
            <div className="flex-1 h-px bg-app-border" />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setImportModal('whatsapp')} className="flex-1 flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-app-border bg-white text-sm font-medium text-app-text hover:border-green-400 hover:bg-green-50 transition-colors shadow-card cursor-pointer">
              <span className="text-green-500 text-base">💬</span>
              WhatsApp
            </button>
            <button onClick={() => setImportModal('telegram')} className="flex-1 flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-app-border bg-white text-sm font-medium text-app-text hover:border-blue-400 hover:bg-blue-50 transition-colors shadow-card cursor-pointer">
              <span className="text-blue-500 text-base">✈️</span>
              Telegram
            </button>
          </div>

          {/* No credit card note */}
          <p className="flex items-center justify-center gap-1.5 mt-4 text-xs text-app-text-muted">
            <svg className="w-3.5 h-3.5 text-app-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            No credit card required &nbsp;·&nbsp; Free tier includes 50 notes/month
          </p>
        </div>

        {/* Right — visual */}
        <div className="hidden md:block animate-fade-up relative" style={{ animationDelay: '0.1s' }}>
          <div className="grid grid-cols-2 gap-4">
            {/* Card 1 */}
            <div className="bg-white rounded-2xl shadow-card-md p-4 aspect-[4/3] flex items-center justify-center border border-app-border">
              <svg className="w-10 h-10 text-app-border" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h10" />
              </svg>
            </div>
            {/* Card 2 */}
            <div className="bg-white rounded-2xl shadow-card-md p-4 aspect-[4/3] flex items-center justify-center border border-app-border">
              <svg className="w-10 h-10 text-app-border" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            {/* Card 3 — processing */}
            <div className="bg-app-accent-light rounded-2xl shadow-card-md p-4 aspect-[4/3] flex flex-col items-center justify-center border border-blue-200 gap-3">
              <div className="w-8 h-1.5 bg-app-accent/30 rounded-full w-full" />
              <div className="w-full flex items-center justify-center">
                <svg className="w-8 h-8 text-app-accent animate-spin-fast" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              </div>
            </div>
            {/* Card 4 — done */}
            <div className="bg-white rounded-2xl shadow-card-md p-4 aspect-[4/3] flex items-center justify-center border border-app-border">
              <div className="w-12 h-12 rounded-full bg-app-success-bg flex items-center justify-center">
                <svg className="w-6 h-6 text-app-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Floating badge */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-card-lg border border-app-border px-5 py-3 flex items-center gap-3 whitespace-nowrap">
            <div className="w-8 h-8 rounded-full bg-app-success-bg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-app-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-app-success uppercase tracking-wide">Process Complete</p>
              <p className="text-sm font-semibold text-app-text">
                {totalNotes > 0 ? `${totalNotes} note${totalNotes !== 1 ? 's' : ''} organized` : 'Ready to organize'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ───────────────────────────────────────── */}
      <section className="border-y border-app-border bg-app-bg">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '12,000+', label: 'Active Users' },
            { value: '500K+',   label: 'Notes Sorted' },
            { value: '4.9 ★',   label: 'Average Rating' },
            { value: '99.9%',   label: 'Uptime' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl font-extrabold text-app-text mb-1">{value}</p>
              <p className="text-sm text-app-text-sec">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section id="how-it-works" className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-extrabold text-app-text mb-3">From chaos to clarity in seconds</h2>
          <p className="text-app-text-sec max-w-2xl mx-auto mb-14">
            Our AI analyzes your handwritten notes and sorts them into the perfect chronological or thematic order, saving you hours of manual clicking.
          </p>

          <div className="grid md:grid-cols-3 gap-8" id="features">
            {[
              {
                icon: (
                  <svg className="w-7 h-7 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
                step: '1. Capture',
                desc: 'Snap photos of your handwritten notes or import directly from messaging apps.',
              },
              {
                icon: (
                  <svg className="w-7 h-7 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
                step: '2. Process',
                desc: 'Our smart engine detects text, dates, context, and page numbers automatically.',
              },
              {
                icon: (
                  <svg className="w-7 h-7 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h8" />
                    <rect x="14" y="12" width="6" height="6" rx="1" strokeWidth={2} />
                  </svg>
                ),
                step: '3. Organize',
                desc: 'Get a structured, searchable sequence ready to export or archive in one click.',
              },
            ].map(({ icon, step, desc }) => (
              <div key={step} className="flex flex-col items-center text-center p-6 rounded-2xl hover:bg-app-bg transition-colors">
                <div className="w-14 h-14 rounded-2xl bg-app-accent-light flex items-center justify-center mb-4">
                  {icon}
                </div>
                <h3 className="text-base font-bold text-app-text mb-2">{step}</h3>
                <p className="text-app-text-sec text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Visual Sequence Preview ──────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="bg-white rounded-3xl border border-app-border shadow-card p-8 flex flex-col md:flex-row items-center gap-8">
          {/* Shuffled thumbnails */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {[0.08, 0.05, 0.02].map((rot, i) => (
              <div
                key={i}
                className="w-20 h-24 bg-app-bg rounded-xl border border-app-border shadow-card flex items-center justify-center"
                style={{ transform: `rotate(${(i - 1) * 3}deg)` }}
              >
                <svg className="w-8 h-8 text-app-border" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            ))}
            <div className="text-app-text-muted mx-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            {[1, 2, 3].map((n) => (
              <div key={n} className="w-16 h-20 bg-app-accent-light rounded-xl border-2 border-app-accent/30 shadow-card flex items-center justify-center relative">
                <span className="absolute top-1.5 left-1.5 text-[10px] font-bold text-app-accent bg-white rounded-full w-5 h-5 flex items-center justify-center shadow-card">{n}</span>
                <svg className="w-6 h-6 text-app-accent/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            ))}
          </div>

          {/* Text */}
          <div>
            <h3 className="text-xl font-bold text-app-text mb-2">Visual Sequence Preview</h3>
            <p className="text-app-text-sec text-sm leading-relaxed">
              Our engine maps handwriting similarity and page markers to ensure your multi-page notes stay together.
            </p>
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────── */}
      <section className="bg-app-bg py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-app-text mb-3">Loved by note-takers everywhere</h2>
            <p className="text-app-text-sec max-w-xl mx-auto text-sm">Real stories from students and professionals who stopped drowning in disorganized photos.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "I used to spend 30 minutes every week manually sorting my lecture photos. SmartNotes does it in seconds. Genuinely life-changing for med school.",
                name: 'Priya R.',
                role: 'Medical Student, Delhi',
                initials: 'PR',
                bg: 'bg-blue-500',
                stars: 5,
              },
              {
                quote: "Our team shares whiteboard photos in a group chat daily. The auto-sort feature means nothing ever gets lost or out of order. Finally.",
                name: 'Alex K.',
                role: 'Product Manager, Berlin',
                initials: 'AK',
                bg: 'bg-emerald-500',
                stars: 5,
              },
              {
                quote: "The collection feature is brilliant — I have separate folders for each subject. It's like Notion but built specifically for handwritten notes.",
                name: 'Mei S.',
                role: 'Architecture Student, Singapore',
                initials: 'MS',
                bg: 'bg-violet-500',
                stars: 5,
              },
            ].map(({ quote, name, role, initials, bg, stars }) => (
              <div key={name} className="bg-white rounded-2xl border border-app-border p-6 shadow-card flex flex-col gap-4 hover:shadow-card-md transition-shadow">
                {/* Stars */}
                <div className="flex gap-0.5">
                  {[...Array(stars)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 fill-amber-400" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                {/* Quote */}
                <p className="text-app-text-sec text-sm leading-relaxed flex-1">"{quote}"</p>
                {/* Author */}
                <div className="flex items-center gap-3 pt-2 border-t border-app-border">
                  <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-app-text">{name}</p>
                    <p className="text-xs text-app-text-muted">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section id="pricing" className="bg-app-accent py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-extrabold text-white mb-4 leading-tight">
            Ready to declutter your<br />digital workspace?
          </h2>
          <p className="text-blue-200 mb-10 text-lg">
            Join thousands of students and professionals using SmartNotes to organize their thoughts.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={onGetStarted}
              className="px-8 py-3.5 bg-white text-app-accent font-bold rounded-full text-base
                         hover:bg-blue-50 transition-colors shadow-card-md cursor-pointer"
            >
              Try it for free
            </button>
            <button className="px-8 py-3.5 bg-transparent text-white font-semibold rounded-full text-base border-2 border-white/50 hover:border-white hover:bg-white/10 transition-colors cursor-pointer">
              View Demo
            </button>
          </div>
          <p className="mt-6 text-blue-200/70 text-sm">No credit card required. Free tier includes up to 50 notes per month.</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="bg-white border-t border-app-border">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-app-accent rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                </svg>
              </div>
              <span className="font-bold text-app-text text-sm">SmartNotes</span>
            </div>
            <p className="text-app-text-muted text-xs leading-relaxed">The world's first AI dedicated to organizing handwritten image streams.</p>
          </div>

          <div>
            <h4 className="font-semibold text-app-text text-sm mb-3">Product</h4>
            {['Features', 'API Access', 'Integrations'].map(l => (
              <p key={l} className="text-app-text-sec text-sm mb-1.5 hover:text-app-accent cursor-pointer transition-colors">{l}</p>
            ))}
          </div>

          <div>
            <h4 className="font-semibold text-app-text text-sm mb-3">Resources</h4>
            {['Documentation', 'Support', 'Privacy Policy'].map(l => (
              <p key={l} className="text-app-text-sec text-sm mb-1.5 hover:text-app-accent cursor-pointer transition-colors">{l}</p>
            ))}
          </div>

          <div>
            <h4 className="font-semibold text-app-text text-sm mb-3">Stay updated</h4>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Email address"
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-app-border rounded-lg bg-app-bg outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/20 transition"
              />
              <button className="w-9 h-9 bg-app-accent rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-app-accent-h transition-colors cursor-pointer">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-app-border max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-app-text-muted text-xs">© 2026 Smart Notes Image Sorter. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <svg className="w-4 h-4 text-app-text-muted hover:text-app-accent cursor-pointer transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <svg className="w-4 h-4 text-app-text-muted hover:text-app-accent cursor-pointer transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </div>
        </div>
      </footer>

      {/* ── Import Guide Modal ───────────────────────────────── */}
      {importModal && guide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setImportModal(null)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          {/* Card */}
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 z-10"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: guide.lightColor, border: `1.5px solid ${guide.borderColor}` }}>
                {guide.emoji}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-extrabold text-app-text">{guide.title}</h2>
                <p className="text-xs text-app-text-sec mt-0.5">Follow these steps to get your photos here</p>
              </div>
              <button onClick={() => setImportModal(null)}
                className="w-8 h-8 rounded-full bg-app-bg border border-app-border flex items-center justify-center hover:bg-app-border transition-colors cursor-pointer flex-shrink-0">
                <svg className="w-4 h-4 text-app-text-sec" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Steps */}
            <div className="flex flex-col gap-4 mb-5">
              {guide.steps.map(({ step, text }) => (
                <div key={step} className="flex gap-3 items-start">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold flex-shrink-0 mt-0.5"
                    style={{ background: guide.lightColor, color: guide.color, border: `1.5px solid ${guide.borderColor}` }}>
                    {step}
                  </span>
                  <p className="text-sm text-app-text-sec leading-relaxed pt-1">{text}</p>
                </div>
              ))}
            </div>

            {/* Tip */}
            <div className="flex gap-2.5 px-4 py-3 rounded-xl mb-6"
              style={{ background: guide.lightColor, border: `1px solid ${guide.borderColor}` }}>
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: guide.color }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              <p className="text-xs leading-relaxed" style={{ color: guide.color }}><strong>Tip:</strong> {guide.tip}</p>
            </div>

            {/* CTA */}
            <button
              onClick={() => { setImportModal(null); onGetStarted() }}
              className="w-full py-3 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90 cursor-pointer"
              style={{ background: guide.color }}>
              I've saved my photos — Start uploading →
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
