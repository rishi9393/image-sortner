import { useState, useMemo, useCallback } from 'react'

/* ── Mock data ─────────────────────────────────────────────────────────────── */
const MOCK_DOCS = [
  {
    id: 1,
    title: 'Project Alpha Sketches',
    type: 'SKETCH',
    category: 'Sketches',
    date: 'Modified 2 hours ago',
    tags: ['#ideation', '#design'],
    img: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&q=80',
    favorited: false,
  },
  {
    id: 2,
    title: 'Office Supplies Invoice',
    type: 'RECEIPT',
    category: 'Receipts',
    date: 'Added May 12, 2024',
    tags: ['#finance', '#tax2024'],
    img: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=400&q=80',
    favorited: true,
  },
  {
    id: 3,
    title: 'Q3 Strategy Notes',
    type: 'HANDWRITTEN',
    category: 'Handwritten Notes',
    date: 'Added May 10, 2024',
    tags: ['#strategy', '#meeting-notes'],
    img: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=400&q=80',
    favorited: true,
  },
  {
    id: 4,
    title: 'App User Flow Diagram',
    type: 'WHITEBOARD',
    category: 'Whiteboards',
    date: 'Added Yesterday',
    tags: ['#ux-design', '#workflow'],
    img: 'https://images.unsplash.com/photo-1512758017271-d7b84c2113f1?w=400&q=80',
    favorited: false,
  },
  {
    id: 5,
    title: 'Feature Brainstorming',
    type: 'SKETCH',
    category: 'Sketches',
    date: 'Modified 1 week ago',
    tags: ['#roadmap'],
    img: 'https://images.unsplash.com/photo-1587614382346-4ec70e388b28?w=400&q=80',
    favorited: false,
  },
  {
    id: 6,
    title: 'Contract Draft v2',
    type: 'DOCUMENT',
    category: 'Screenshots',
    date: 'Added May 5, 2024',
    tags: ['#legal', '#partnership'],
    img: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&q=80',
    favorited: false,
  },
]

const COLLECTIONS = [
  { name: 'Work Notes',        color: '#f59e0b' },
  { name: 'Personal Receipts', color: '#10b981' },
  { name: 'Brainstorming',     color: '#a78bfa' },
]

const FILTER_TABS = ['All Documents', 'Handwritten Notes', 'Receipts', 'Sketches', 'Whiteboards', 'Screenshots']

const TYPE_BADGE = {
  SKETCH:      { label: 'SKETCH',      bg: 'bg-orange-50', text: 'text-orange-500', border: 'border-orange-200' },
  RECEIPT:     { label: 'RECEIPT',     bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  HANDWRITTEN: { label: 'HANDWRITTEN', bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200' },
  WHITEBOARD:  { label: 'WHITEBOARD',  bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200' },
  DOCUMENT:    { label: 'DOCUMENT',    bg: 'bg-gray-100',  text: 'text-gray-500',   border: 'border-gray-200' },
}

const NAV_ICONS = {
  Home: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Library: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
    </svg>
  ),
  Favorites: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
    </svg>
  ),
  Trash: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
}

/* ── Document card ─────────────────────────────────────────────────────────── */
function DocCard({ doc, selected, onToggleSelect, onToggleFavorite, viewMode }) {
  const [imgError, setImgError] = useState(false)
  const badge = TYPE_BADGE[doc.type] || TYPE_BADGE.DOCUMENT

  if (viewMode === 'list') {
    return (
      <div
        className={`flex items-center gap-4 px-5 py-3.5 rounded-xl border transition-all duration-150 cursor-pointer group
          ${selected
            ? 'bg-blue-50 border-app-accent shadow-sm'
            : 'bg-white border-app-border hover:border-app-border-hover hover:shadow-card'}`}
        onClick={() => onToggleSelect(doc.id)}
      >
        {/* Checkbox */}
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
          ${selected ? 'bg-app-accent border-app-accent' : 'border-app-border group-hover:border-app-accent'}`}>
          {selected && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        {/* Thumbnail */}
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-app-bg flex-shrink-0 border border-app-border">
          {!imgError ? (
            <img src={doc.img} alt={doc.title} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-app-text-muted">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-bold text-app-text truncate">{doc.title}</p>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 ${badge.bg} ${badge.text} ${badge.border}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-xs text-app-text-muted">{doc.date}</p>
        </div>

        {/* Tags */}
        <div className="hidden md:flex items-center gap-1 flex-shrink-0">
          {doc.tags.map((t) => (
            <span key={t} className="px-2 py-0.5 bg-app-bg rounded-full text-[11px] text-app-text-sec border border-app-border">{t}</span>
          ))}
        </div>

        {/* Favorite */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(doc.id) }}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-app-bg transition-colors flex-shrink-0 cursor-pointer"
          aria-label="Favorite"
        >
          <svg className={`w-4 h-4 transition-colors ${doc.favorited ? 'fill-app-accent text-app-accent' : 'fill-none text-app-text-muted'}`} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>
    )
  }

  // Grid card
  return (
    <div
      className={`group relative bg-white rounded-2xl border overflow-hidden shadow-card hover:shadow-card-md transition-all duration-200 cursor-pointer
        ${selected ? 'border-app-accent ring-2 ring-app-accent ring-offset-2' : 'border-app-border hover:border-app-border-hover'}`}
      onClick={() => onToggleSelect(doc.id)}
    >
      {/* Image */}
      <div className="relative h-44 bg-app-bg overflow-hidden">
        {!imgError ? (
          <img
            src={doc.img}
            alt={doc.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-app-bg to-app-card2">
            <svg className="w-12 h-12 text-app-border" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        )}

        {/* Favorite button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(doc.id) }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white shadow-card-md flex items-center justify-center
                     opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 cursor-pointer border border-app-border"
          aria-label="Favorite"
        >
          <svg className={`w-4 h-4 transition-colors ${doc.favorited ? 'fill-app-accent text-app-accent' : 'fill-none text-app-text-muted'}`} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {/* Always-visible favorited indicator */}
        {doc.favorited && (
          <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white shadow-card-md flex items-center justify-center border border-app-border group-hover:hidden">
            <svg className="w-4 h-4 fill-app-accent text-app-accent" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
        )}

        {/* Select checkbox */}
        <div className={`absolute top-3 left-3 w-5 h-5 rounded border-2 flex items-center justify-center transition-all
          ${selected
            ? 'bg-app-accent border-app-accent opacity-100'
            : 'bg-white border-app-border opacity-0 group-hover:opacity-100'}`}>
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-sm font-bold text-app-text truncate leading-snug">{doc.title}</p>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 ${badge.bg} ${badge.text} ${badge.border}`}>
            {badge.label}
          </span>
        </div>
        <p className="text-xs text-app-text-muted mb-2">{doc.date}</p>
        <div className="flex flex-wrap gap-1">
          {doc.tags.map((t) => (
            <span key={t} className="px-2 py-0.5 bg-app-bg rounded-full text-[11px] text-app-text-sec border border-app-border">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── New Document card ─────────────────────────────────────────────────────── */
function NewDocCard({ onUpload, viewMode }) {
  if (viewMode === 'list') {
    return (
      <button
        onClick={onUpload}
        className="flex items-center gap-4 px-5 py-3.5 rounded-xl border-2 border-dashed border-app-border
                   hover:border-app-accent hover:bg-app-accent-light transition-all duration-150 cursor-pointer group w-full text-left"
      >
        <div className="w-12 h-12 rounded-lg bg-app-bg flex items-center justify-center flex-shrink-0 group-hover:bg-white transition-colors border border-app-border">
          <svg className="w-5 h-5 text-app-text-muted group-hover:text-app-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-app-text-sec group-hover:text-app-accent transition-colors">New Document</p>
          <p className="text-xs text-app-text-muted">Upload image or PDF</p>
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={onUpload}
      className="group relative bg-white rounded-2xl border-2 border-dashed border-app-border overflow-hidden
                 hover:border-app-accent hover:bg-app-accent-light transition-all duration-200 cursor-pointer
                 flex flex-col items-center justify-center"
      style={{ minHeight: '240px' }}
    >
      <div className="w-12 h-12 rounded-full bg-app-bg border border-app-border flex items-center justify-center mb-3
                      group-hover:bg-white group-hover:border-app-accent group-hover:shadow-blue transition-all duration-200">
        <svg className="w-6 h-6 text-app-text-muted group-hover:text-app-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <p className="text-sm font-bold text-app-text-sec group-hover:text-app-accent transition-colors">New Document</p>
      <p className="text-xs text-app-text-muted mt-0.5">Upload image or PDF</p>
    </button>
  )
}

/* ── Main page ─────────────────────────────────────────────────────────────── */
export default function MyNotesPage({ onGoHome, onGoToUpload }) {
  const [docs, setDocs]             = useState(MOCK_DOCS)
  const [activeFilter, setFilter]   = useState('All Documents')
  const [activeSideNav, setSideNav] = useState('Library')
  const [search, setSearch]         = useState('')
  const [viewMode, setViewMode]     = useState('grid')   // 'grid' | 'list'
  const [selected, setSelected]     = useState(new Set())

  /* ── Filter & search ──────────────────────────────────── */
  const filtered = useMemo(() => {
    let out = docs
    if (activeFilter !== 'All Documents') {
      out = out.filter((d) => d.category === activeFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q)) ||
          d.type.toLowerCase().includes(q)
      )
    }
    return out
  }, [docs, activeFilter, search])

  /* ── Selection ────────────────────────────────────────── */
  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const selectAll = useCallback(() => {
    setSelected(new Set(filtered.map((d) => d.id)))
  }, [filtered])

  /* ── Favorite toggle ──────────────────────────────────── */
  const toggleFavorite = useCallback((id) => {
    setDocs((prev) => prev.map((d) => d.id === id ? { ...d, favorited: !d.favorited } : d))
  }, [])

  /* ── Delete selected ──────────────────────────────────── */
  const deleteSelected = useCallback(() => {
    setDocs((prev) => prev.filter((d) => !selected.has(d.id)))
    setSelected(new Set())
  }, [selected])

  /* ── Sidebar nav handler ──────────────────────────────── */
  const handleSideNav = (item) => {
    setSideNav(item)
    if (item === 'Home') onGoHome()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-app-bg font-sans">

      {/* ══════════════════════════════════════════════════
          SIDEBAR
         ══════════════════════════════════════════════════ */}
      <aside className="w-60 bg-white border-r border-app-border flex flex-col flex-shrink-0 h-screen">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-app-border">
          <button onClick={onGoHome} className="flex items-center gap-2.5 cursor-pointer group">
            <div className="w-8 h-8 bg-app-accent rounded-lg flex items-center justify-center shadow-blue group-hover:bg-app-accent-h transition-colors">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-app-text">Smart Notes</span>
          </button>
        </div>

        {/* Primary nav */}
        <nav className="px-3 py-4 flex flex-col gap-0.5">
          {['Home', 'Library', 'Favorites', 'Trash'].map((item) => (
            <button
              key={item}
              onClick={() => handleSideNav(item)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 w-full text-left cursor-pointer
                ${activeSideNav === item
                  ? 'bg-app-accent-light text-app-accent font-semibold'
                  : 'text-app-text-sec hover:bg-app-bg hover:text-app-text'}`}
            >
              <span className={activeSideNav === item ? 'text-app-accent' : 'text-app-text-muted'}>
                {NAV_ICONS[item]}
              </span>
              {item}
            </button>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-4 border-t border-app-border" />

        {/* Collections */}
        <div className="px-5 py-4 flex-1 overflow-y-auto">
          <p className="text-[10px] font-bold text-app-text-muted uppercase tracking-widest mb-3">Collections</p>
          <div className="flex flex-col gap-0.5">
            {COLLECTIONS.map((col) => (
              <button
                key={col.name}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-app-text-sec hover:bg-app-bg hover:text-app-text transition-colors cursor-pointer w-full text-left"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                {col.name}
              </button>
            ))}

            {/* Add collection */}
            <button className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-app-text-muted hover:bg-app-bg hover:text-app-text transition-colors cursor-pointer w-full text-left mt-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Collection
            </button>
          </div>
        </div>

        {/* Bottom — New Upload + User */}
        <div className="px-4 py-4 border-t border-app-border flex flex-col gap-3">
          <button
            onClick={onGoToUpload}
            className="w-full flex items-center justify-center gap-2 py-3 bg-app-accent text-white text-sm font-bold
                       rounded-xl shadow-blue hover:bg-app-accent-h transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            New Upload
          </button>

          {/* User profile */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-app-accent flex items-center justify-center text-white text-xs font-bold shadow-blue flex-shrink-0">
              AR
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-app-text truncate leading-none">Alex Rivera</p>
              <p className="text-[11px] text-app-text-muted leading-none mt-0.5">Pro Account</p>
            </div>
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-app-text-muted hover:bg-app-bg hover:text-app-text transition-colors cursor-pointer flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

      </aside>

      {/* ══════════════════════════════════════════════════
          MAIN CONTENT
         ══════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top search bar ──────────────────────────────── */}
        <div className="bg-white border-b border-app-border px-8 py-3.5 flex items-center gap-4 flex-shrink-0">
          <div className="flex-1 relative max-w-xl mx-auto">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes, text, or automatic labels..."
              className="w-full pl-11 pr-4 py-2.5 bg-app-bg border border-app-border rounded-full text-sm text-app-text placeholder-app-text-muted
                         focus:outline-none focus:ring-2 focus:ring-app-accent focus:border-transparent transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-app-border flex items-center justify-center hover:bg-app-text-muted transition-colors cursor-pointer"
              >
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Notification */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="relative w-9 h-9 rounded-full border border-app-border bg-app-bg flex items-center justify-center hover:bg-app-border transition-colors cursor-pointer">
              <svg className="w-4 h-4 text-app-text-sec" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
            <button className="w-9 h-9 rounded-full border border-app-border bg-app-bg flex items-center justify-center hover:bg-app-border transition-colors cursor-pointer">
              <svg className="w-4 h-4 text-app-text-sec" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Scrollable content ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-6">

            {/* Page header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-3xl font-extrabold text-app-text leading-tight">My Library</h1>
                <p className="text-app-text-sec text-sm mt-1">Manage and sort your visual knowledge base</p>
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-1 p-1 bg-white border border-app-border rounded-xl shadow-card flex-shrink-0">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer
                    ${viewMode === 'grid' ? 'bg-app-bg shadow-sm text-app-accent' : 'text-app-text-muted hover:text-app-text'}`}
                  aria-label="Grid view"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer
                    ${viewMode === 'list' ? 'bg-app-bg shadow-sm text-app-accent' : 'text-app-text-muted hover:text-app-text'}`}
                  aria-label="List view"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-2 flex-wrap mb-6">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-150 cursor-pointer
                    ${activeFilter === tab
                      ? 'bg-app-accent text-white border-app-accent shadow-blue'
                      : 'bg-white text-app-text-sec border-app-border hover:border-app-border-hover hover:text-app-text'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Select-all row */}
            {filtered.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={selected.size === filtered.length ? clearSelection : selectAll}
                    className="text-xs font-semibold text-app-accent hover:text-app-accent-h transition-colors cursor-pointer"
                  >
                    {selected.size === filtered.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {selected.size > 0 && (
                    <span className="text-xs text-app-text-muted">
                      {selected.size} selected
                    </span>
                  )}
                </div>
                <p className="text-xs text-app-text-muted">{filtered.length} document{filtered.length !== 1 ? 's' : ''}</p>
              </div>
            )}

            {/* Empty search state */}
            {filtered.length === 0 && search && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 bg-white rounded-2xl border border-app-border shadow-card flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-base font-bold text-app-text mb-1">No results for "{search}"</p>
                <p className="text-sm text-app-text-muted mb-4">Try a different search term or browse by category.</p>
                <button onClick={() => setSearch('')} className="text-sm font-semibold text-app-accent hover:text-app-accent-h cursor-pointer">
                  Clear search
                </button>
              </div>
            )}

            {/* Document grid */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map((doc) => (
                  <DocCard
                    key={doc.id}
                    doc={doc}
                    selected={selected.has(doc.id)}
                    onToggleSelect={toggleSelect}
                    onToggleFavorite={toggleFavorite}
                    viewMode="grid"
                  />
                ))}
                <NewDocCard onUpload={onGoToUpload} viewMode="grid" />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map((doc) => (
                  <DocCard
                    key={doc.id}
                    doc={doc}
                    selected={selected.has(doc.id)}
                    onToggleSelect={toggleSelect}
                    onToggleFavorite={toggleFavorite}
                    viewMode="list"
                  />
                ))}
                <NewDocCard onUpload={onGoToUpload} viewMode="list" />
              </div>
            )}

          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            BOTTOM ACTION BAR
           ══════════════════════════════════════════════════ */}
        <div className={`flex-shrink-0 transition-all duration-300 ${selected.size > 0 ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
          <div className="mx-8 mb-6">
            <div className="bg-gray-900 text-white rounded-2xl px-6 py-3.5 flex items-center gap-5 shadow-card-lg">

              {/* Count */}
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="font-semibold text-white">Selected:</span>
                <span className="w-6 h-6 bg-app-accent rounded-full flex items-center justify-center text-xs font-bold text-white">
                  {selected.size}
                </span>
              </div>

              <div className="h-5 w-px bg-gray-700" />

              {/* Actions */}
              <div className="flex items-center gap-1 flex-1 flex-wrap">
                {[
                  {
                    label: 'Move',
                    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                  },
                  {
                    label: 'Label',
                    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                  },
                  {
                    label: 'Export',
                    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  },
                ].map(({ label, icon }) => (
                  <button
                    key={label}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-gray-300
                               hover:bg-gray-800 hover:text-white transition-colors cursor-pointer"
                  >
                    {icon}
                    {label}
                  </button>
                ))}

                <div className="h-5 w-px bg-gray-700 mx-1" />

                <button
                  onClick={deleteSelected}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-red-400
                             hover:bg-red-900/30 hover:text-red-300 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>

              {/* Close */}
              <button
                onClick={clearSelection}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-800 hover:text-white transition-colors cursor-pointer flex-shrink-0"
                aria-label="Clear selection"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
