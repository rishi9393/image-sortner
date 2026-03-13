import { useState, useMemo, useCallback } from 'react'

/* ── Mock data ─────────────────────────────────────────────────────────────── */
const MOCK_DOCS = [
  {
    id: 1, title: 'Project Alpha Sketches', type: 'SKETCH',
    category: 'Sketches', collection: 'Work Notes',
    date: 'Modified 2 hours ago', tags: ['#ideation', '#design'],
    img: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&q=80',
    favorited: false, trashed: false,
  },
  {
    id: 2, title: 'Office Supplies Invoice', type: 'RECEIPT',
    category: 'Receipts', collection: 'Personal Receipts',
    date: 'Added May 12, 2024', tags: ['#finance', '#tax2024'],
    img: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=400&q=80',
    favorited: true, trashed: false,
  },
  {
    id: 3, title: 'Q3 Strategy Notes', type: 'HANDWRITTEN',
    category: 'Handwritten Notes', collection: 'Work Notes',
    date: 'Added May 10, 2024', tags: ['#strategy', '#meeting-notes'],
    img: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=400&q=80',
    favorited: true, trashed: false,
  },
  {
    id: 4, title: 'App User Flow Diagram', type: 'WHITEBOARD',
    category: 'Whiteboards', collection: 'Work Notes',
    date: 'Added Yesterday', tags: ['#ux-design', '#workflow'],
    img: 'https://images.unsplash.com/photo-1512758017271-d7b84c2113f1?w=400&q=80',
    favorited: false, trashed: false,
  },
  {
    id: 5, title: 'Feature Brainstorming', type: 'SKETCH',
    category: 'Sketches', collection: 'Brainstorming',
    date: 'Modified 1 week ago', tags: ['#roadmap'],
    img: 'https://images.unsplash.com/photo-1587614382346-4ec70e388b28?w=400&q=80',
    favorited: true, trashed: false,
  },
  {
    id: 6, title: 'Contract Draft v2', type: 'DOCUMENT',
    category: 'Screenshots', collection: 'Personal Receipts',
    date: 'Added May 5, 2024', tags: ['#legal', '#partnership'],
    img: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&q=80',
    favorited: false, trashed: false,
  },
  {
    id: 7, title: 'Budget Planning 2024', type: 'HANDWRITTEN',
    category: 'Handwritten Notes', collection: 'Personal Receipts',
    date: 'Added Apr 30, 2024', tags: ['#finance', '#planning'],
    img: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=80',
    favorited: false, trashed: false,
  },
  {
    id: 8, title: 'Product Roadmap Q4', type: 'WHITEBOARD',
    category: 'Whiteboards', collection: 'Brainstorming',
    date: 'Modified 3 days ago', tags: ['#roadmap', '#product'],
    img: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400&q=80',
    favorited: false, trashed: false,
  },
]

const COLLECTIONS = [
  { name: 'Work Notes',        color: '#f59e0b' },
  { name: 'Personal Receipts', color: '#10b981' },
  { name: 'Brainstorming',     color: '#a78bfa' },
]

const FILTER_TABS = ['All Documents', 'Handwritten Notes', 'Receipts', 'Sketches', 'Whiteboards', 'Screenshots']

const TYPE_BADGE = {
  SKETCH:      { bg: 'bg-orange-50',  text: 'text-orange-500',  border: 'border-orange-100' },
  RECEIPT:     { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
  HANDWRITTEN: { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-100'   },
  WHITEBOARD:  { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-100' },
  DOCUMENT:    { bg: 'bg-gray-100',   text: 'text-gray-500',    border: 'border-gray-200'   },
}

/* ── Sidebar icons ─────────────────────────────────────────────────────────── */
const HomeIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
)
const LibraryIcon = ({ active }) => (
  <svg className="w-[18px] h-[18px]" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 4h18" />
  </svg>
)
const FavoritesIcon = ({ active }) => (
  <svg className="w-[18px] h-[18px]" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
)
const TrashIcon = ({ active }) => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.2 : 1.8}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

/* ── Heart button ──────────────────────────────────────────────────────────── */
function HeartButton({ favorited, onClick }) {
  return (
    <button onClick={onClick}
      className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center border border-gray-100 hover:scale-110 transition-transform cursor-pointer"
      aria-label="Favourite"
    >
      <svg className={`w-4 h-4 transition-colors ${favorited ? 'text-app-accent fill-app-accent' : 'text-gray-400 fill-none'}`}
        stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </button>
  )
}

/* ── Restore button (Trash view) ───────────────────────────────────────────── */
function RestoreButton({ onClick }) {
  return (
    <button onClick={onClick}
      className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center border border-gray-100 hover:scale-110 hover:border-emerald-300 transition-all cursor-pointer"
      aria-label="Restore"
      title="Restore"
    >
      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  )
}

/* ── Grid card ─────────────────────────────────────────────────────────────── */
function GridCard({ doc, selected, isTrashed, onToggleSelect, onToggleFavorite, onRestore }) {
  const [imgErr, setImgErr] = useState(false)
  const badge = TYPE_BADGE[doc.type] || TYPE_BADGE.DOCUMENT

  return (
    <div onClick={() => onToggleSelect(doc.id)}
      className={`bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 border hover:shadow-lg
        ${selected ? 'border-app-accent ring-2 ring-app-accent/20 shadow-md' : 'border-gray-200 shadow-sm hover:border-gray-300'}
        ${isTrashed ? 'opacity-75' : ''}`}
    >
      {/* Image */}
      <div className="relative" style={{ height: '160px' }}>
        {!imgErr ? (
          <img src={doc.img} alt={doc.title} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Checkbox */}
        <div className={`absolute top-2.5 left-2.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-opacity
          ${selected ? 'opacity-100 bg-app-accent border-app-accent' : 'opacity-0 bg-white border-gray-300'}`}
          style={{ opacity: selected ? 1 : undefined }}>
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        {/* Top-right: restore (trash) OR heart */}
        <div className="absolute top-2.5 right-2.5" onClick={e => e.stopPropagation()}>
          {isTrashed
            ? <RestoreButton onClick={() => onRestore(doc.id)} />
            : <HeartButton favorited={doc.favorited} onClick={() => onToggleFavorite(doc.id)} />
          }
        </div>

        {/* Trashed overlay badge */}
        {isTrashed && (
          <div className="absolute bottom-2 left-2.5">
            <span className="px-2 py-0.5 bg-red-100 text-red-500 text-[9px] font-bold rounded border border-red-200 uppercase tracking-wide">
              Deleted
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-3.5 pt-3 pb-3.5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-[13px] font-bold text-gray-900 leading-snug line-clamp-1 flex-1 min-w-0">{doc.title}</p>
          <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide border mt-0.5
            ${badge.bg} ${badge.text} ${badge.border}`}>{doc.type}</span>
        </div>
        <p className="text-[11px] text-gray-400 mb-2">{doc.date}</p>
        <div className="flex flex-wrap gap-1">
          {doc.tags.map(t => (
            <span key={t} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-500 border border-gray-200">{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── New Document card ─────────────────────────────────────────────────────── */
function NewDocCard({ onUpload }) {
  return (
    <button onClick={onUpload}
      className="bg-white rounded-2xl border-2 border-dashed border-gray-300 hover:border-app-accent
                 hover:bg-blue-50/40 transition-all duration-200 cursor-pointer flex flex-col
                 items-center justify-center gap-2 group"
      style={{ minHeight: '240px' }}>
      <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 group-hover:border-app-accent
                      flex items-center justify-center transition-colors">
        <svg className="w-5 h-5 text-gray-400 group-hover:text-app-accent transition-colors"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <p className="text-[13px] font-bold text-gray-500 group-hover:text-app-accent transition-colors">New Document</p>
      <p className="text-[11px] text-gray-400">Upload image or PDF</p>
    </button>
  )
}

/* ── List row ──────────────────────────────────────────────────────────────── */
function ListRow({ doc, selected, isTrashed, onToggleSelect, onToggleFavorite, onRestore }) {
  const [imgErr, setImgErr] = useState(false)
  const badge = TYPE_BADGE[doc.type] || TYPE_BADGE.DOCUMENT

  return (
    <div onClick={() => onToggleSelect(doc.id)}
      className={`flex items-center gap-4 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-150
        ${selected ? 'bg-blue-50 border-app-accent' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
        ${isTrashed ? 'opacity-75' : ''}`}>
      {/* Checkbox */}
      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors
        ${selected ? 'bg-app-accent border-app-accent' : 'border-gray-300 hover:border-app-accent'}`}>
        {selected && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
        {!imgErr
          ? <img src={doc.img} alt={doc.title} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          : <div className="w-full h-full flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
        }
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-gray-900 truncate">{doc.title}</p>
          <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide border
            ${badge.bg} ${badge.text} ${badge.border}`}>{doc.type}</span>
          {isTrashed && <span className="px-1.5 py-0.5 bg-red-100 text-red-500 text-[9px] font-bold rounded border border-red-200 uppercase">Deleted</span>}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{doc.date}</p>
      </div>
      {/* Tags */}
      <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
        {doc.tags.map(t => (
          <span key={t} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-500 border border-gray-200">{t}</span>
        ))}
      </div>
      {/* Action button */}
      <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
        {isTrashed
          ? <RestoreButton onClick={() => onRestore(doc.id)} />
          : <HeartButton favorited={doc.favorited} onClick={() => onToggleFavorite(doc.id)} />
        }
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════════════ */
export default function MyNotesPage({ onGoHome, onGoToUpload }) {
  const [docs,           setDocs]          = useState(MOCK_DOCS)
  const [activeSideNav,  setSideNav]        = useState('Library')
  const [activeCollection, setCollection]  = useState(null)   // null | collection name
  const [activeFilter,   setFilter]         = useState('All Documents')
  const [search,         setSearch]         = useState('')
  const [viewMode,       setViewMode]       = useState('grid')
  const [selected,       setSelected]       = useState(new Set())

  /* ── Derived view mode ─────────────────────────────────────────────────────── */
  // What the main area is currently showing
  const viewContext = activeCollection
    ? 'collection'
    : activeSideNav  // 'Library' | 'Favorites' | 'Trash'

  /* ── Heading config per view ───────────────────────────────────────────────── */
  const VIEW_META = {
    Library:    { title: 'My Notes',   subtitle: 'Manage and sort your visual knowledge base' },
    Favorites:  { title: 'Favourites', subtitle: 'All the documents you\'ve marked as favourite' },
    Trash:      { title: 'Trash',      subtitle: 'Documents moved to trash · they won\'t appear elsewhere' },
    collection: {
      title: activeCollection || '',
      subtitle: `Documents in the "${activeCollection}" collection`,
    },
  }
  const meta = VIEW_META[viewContext] || VIEW_META.Library

  /* ── Filtered list ─────────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let out = docs

    // Trash view: only trashed
    if (viewContext === 'Trash') {
      out = out.filter(d => d.trashed)
      if (search.trim()) {
        const q = search.toLowerCase()
        out = out.filter(d => d.title.toLowerCase().includes(q) || d.tags.some(t => t.toLowerCase().includes(q)))
      }
      return out
    }

    // Never show trashed in other views
    out = out.filter(d => !d.trashed)

    // Favorites view
    if (viewContext === 'Favorites') {
      out = out.filter(d => d.favorited)
    }

    // Collection view
    if (viewContext === 'collection') {
      out = out.filter(d => d.collection === activeCollection)
    }

    // Type filter tab (only in Library + collection views)
    if (viewContext !== 'Favorites' && activeFilter !== 'All Documents') {
      out = out.filter(d => d.category === activeFilter)
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.tags.some(t => t.toLowerCase().includes(q)) ||
        d.type.toLowerCase().includes(q)
      )
    }

    return out
  }, [docs, viewContext, activeCollection, activeFilter, search])

  /* ── Counts for sidebar badges ─────────────────────────────────────────────── */
  const favCount   = useMemo(() => docs.filter(d => !d.trashed && d.favorited).length, [docs])
  const trashCount = useMemo(() => docs.filter(d => d.trashed).length, [docs])
  const collectionCount = useCallback(name => docs.filter(d => !d.trashed && d.collection === name).length, [docs])

  /* ── Selection helpers ─────────────────────────────────────────────────────── */
  const toggleSelect   = useCallback(id => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }), [])
  const clearSelection = useCallback(() => setSelected(new Set()), [])

  /* ── Move selected to trash ────────────────────────────────────────────────── */
  const moveToTrash = useCallback(() => {
    setDocs(p => p.map(d => selected.has(d.id) ? { ...d, trashed: true } : d))
    setSelected(new Set())
  }, [selected])

  /* ── Restore one or selected ───────────────────────────────────────────────── */
  const restoreDoc = useCallback(id => {
    setDocs(p => p.map(d => d.id === id ? { ...d, trashed: false } : d))
  }, [])

  const restoreSelected = useCallback(() => {
    setDocs(p => p.map(d => selected.has(d.id) ? { ...d, trashed: false } : d))
    setSelected(new Set())
  }, [selected])

  /* ── Permanently delete selected ───────────────────────────────────────────── */
  const deleteForever = useCallback(() => {
    setDocs(p => p.filter(d => !selected.has(d.id)))
    setSelected(new Set())
  }, [selected])

  /* ── Empty entire trash ────────────────────────────────────────────────────── */
  const emptyTrash = useCallback(() => {
    setDocs(p => p.filter(d => !d.trashed))
    setSelected(new Set())
  }, [])

  /* ── Favorite toggle ───────────────────────────────────────────────────────── */
  const toggleFavorite = useCallback(id => setDocs(p => p.map(d => d.id === id ? { ...d, favorited: !d.favorited } : d)), [])

  /* ── Sidebar nav click ─────────────────────────────────────────────────────── */
  const handleSideNav = key => {
    if (key === 'Home') { onGoHome(); return }
    setSideNav(key)
    setCollection(null)
    setFilter('All Documents')
    setSearch('')
    setSelected(new Set())
  }

  /* ── Collection click ──────────────────────────────────────────────────────── */
  const handleCollection = name => {
    setCollection(name)
    setSideNav('Library')  // keep Library highlighted
    setFilter('All Documents')
    setSearch('')
    setSelected(new Set())
  }

  const isInTrash = viewContext === 'Trash'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f2f5', fontFamily: 'Inter,system-ui,sans-serif' }}>

      {/* ══════════════════════════════════
          SIDEBAR
         ══════════════════════════════════ */}
      <aside className="w-[230px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0 h-screen">

        {/* Logo */}
        <div className="px-5 pt-5 pb-4">
          <button onClick={onGoHome} className="flex items-center gap-2.5 cursor-pointer group">
            <div className="w-8 h-8 bg-app-accent rounded-full flex items-center justify-center shadow-blue group-hover:bg-app-accent-h transition-colors flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
            </div>
            <span className="text-[15px] font-bold text-gray-900">Smart Notes</span>
          </button>
        </div>

        {/* Primary nav */}
        <nav className="px-3 pb-3 flex flex-col gap-0.5">
          {[
            { key: 'Home',      icon: <HomeIcon />,                                   label: 'Home',     count: null        },
            { key: 'Library',   icon: <LibraryIcon active={activeSideNav==='Library' && !activeCollection} />, label: 'My Notes', count: null },
            { key: 'Favorites', icon: <FavoritesIcon active={activeSideNav==='Favorites'} />, label: 'Favorites', count: favCount   },
            { key: 'Trash',     icon: <TrashIcon active={activeSideNav==='Trash'} />, label: 'Trash',    count: trashCount   },
          ].map(({ key, icon, label, count }) => {
            const active = key !== 'Home' && (
              key === 'Library'
                ? (activeSideNav === 'Library' && !activeCollection)
                : activeSideNav === key
            )
            return (
              <button key={key} onClick={() => handleSideNav(key)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium w-full text-left cursor-pointer transition-all duration-150
                  ${active ? 'bg-blue-50 text-app-accent font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                <span className={active ? 'text-app-accent' : 'text-gray-400'}>{icon}</span>
                <span className="flex-1">{label}</span>
                {count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                    ${active ? 'bg-app-accent text-white' : 'bg-gray-200 text-gray-600'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="mx-4 border-t border-gray-100 mb-3" />

        {/* Collections */}
        <div className="px-5 flex-1 overflow-y-auto">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Collections</p>
          <div className="flex flex-col gap-0.5">
            {COLLECTIONS.map(col => {
              const isActive = activeCollection === col.name
              const cnt = collectionCount(col.name)
              return (
                <button key={col.name} onClick={() => handleCollection(col.name)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] w-full text-left cursor-pointer transition-all duration-150
                    ${isActive ? 'bg-blue-50 text-app-accent font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
                  <span className="flex-1 truncate">{col.name}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                    ${isActive ? 'bg-app-accent text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {cnt}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Bottom */}
        <div className="px-4 pb-4 pt-3 border-t border-gray-100">
          <button onClick={onGoToUpload}
            className="w-full flex items-center justify-center gap-2 py-3 bg-app-accent text-white text-[13px] font-bold
                       rounded-xl shadow-blue hover:bg-app-accent-h transition-colors cursor-pointer mb-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            New Upload
          </button>

          {/* User */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>AR</div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-gray-900 leading-none truncate">Alex Rivera</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">Pro Account</p>
            </div>
            <button className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors cursor-pointer flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════════
          MAIN
         ══════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top search bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <div className="flex-1 relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search notes, text, or automatic labels..."
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full text-[13px] text-gray-700
                         placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-app-accent/40
                         focus:bg-white border border-transparent focus:border-app-accent/30 transition-all" />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="relative w-9 h-9 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
            <button className="w-9 h-9 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 pt-7 pb-4">

            {/* Title row */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-3">
                  {/* Breadcrumb back arrow when in collection view */}
                  {viewContext === 'collection' && (
                    <button onClick={() => { setCollection(null); setFilter('All Documents') }}
                      className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer shadow-sm">
                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  <div>
                    <h1 className="text-[28px] font-extrabold text-gray-900 leading-tight">{meta.title}</h1>
                    <p className="text-[13px] text-gray-500 mt-0.5">{meta.subtitle}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-1 flex-shrink-0">
                {/* Empty Trash button (only in trash view) */}
                {isInTrash && trashCount > 0 && (
                  <button onClick={emptyTrash}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold
                               bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Empty Trash
                  </button>
                )}

                {/* View toggle */}
                <div className="flex items-center p-1 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <button onClick={() => setViewMode('grid')}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer
                      ${viewMode === 'grid' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-700'}`}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button onClick={() => setViewMode('list')}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer
                      ${viewMode === 'list' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-700'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Filter tabs — only shown in Library / Collection views */}
            {(viewContext === 'Library' || viewContext === 'collection') && (
              <div className="flex items-center gap-2 flex-wrap mb-6">
                {FILTER_TABS.map(tab => (
                  <button key={tab} onClick={() => setFilter(tab)}
                    className={`px-4 py-2 rounded-full text-[13px] font-semibold border transition-all duration-150 cursor-pointer
                      ${activeFilter === tab
                        ? 'bg-app-accent text-white border-app-accent shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-900'}`}>
                    {tab}
                  </button>
                ))}
              </div>
            )}

            {/* Collection colour strip */}
            {viewContext === 'collection' && (
              <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-white rounded-xl border border-gray-200 shadow-sm w-fit">
                <span className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: COLLECTIONS.find(c => c.name === activeCollection)?.color || '#ccc' }} />
                <span className="text-[12px] font-semibold text-gray-700">{activeCollection}</span>
                <span className="text-[11px] text-gray-400">· {filtered.length} document{filtered.length !== 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Favourites header */}
            {viewContext === 'Favorites' && filtered.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-app-accent fill-app-accent" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span className="text-[12px] font-semibold text-gray-600">{filtered.length} favourited document{filtered.length !== 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                {isInTrash ? (
                  <>
                    <div className="w-14 h-14 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center mb-4">
                      <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <p className="text-base font-bold text-gray-600 mb-1">Trash is empty</p>
                    <p className="text-sm text-gray-400">Deleted documents will appear here.</p>
                  </>
                ) : viewContext === 'Favorites' ? (
                  <>
                    <div className="w-14 h-14 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center mb-4">
                      <svg className="w-7 h-7 text-gray-300 fill-none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <p className="text-base font-bold text-gray-600 mb-1">No favourites yet</p>
                    <p className="text-sm text-gray-400">Tap the ♡ on any document to add it here.</p>
                  </>
                ) : (
                  <>
                    <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-base font-bold text-gray-600 mb-1">
                      {search ? `No results for "${search}"` : 'Nothing here yet'}
                    </p>
                    <p className="text-sm text-gray-400 mb-3">
                      {search ? 'Try a different search.' : 'Upload something to get started.'}
                    </p>
                    {search && (
                      <button onClick={() => setSearch('')}
                        className="text-sm font-semibold text-app-accent hover:underline cursor-pointer">
                        Clear search
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Grid view */}
            {viewMode === 'grid' && filtered.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map(doc => (
                  <GridCard key={doc.id} doc={doc} selected={selected.has(doc.id)} isTrashed={isInTrash}
                    onToggleSelect={toggleSelect} onToggleFavorite={toggleFavorite} onRestore={restoreDoc} />
                ))}
                {!isInTrash && viewContext !== 'Favorites' && <NewDocCard onUpload={onGoToUpload} />}
              </div>
            )}

            {/* List view */}
            {viewMode === 'list' && filtered.length > 0 && (
              <div className="flex flex-col gap-2">
                {filtered.map(doc => (
                  <ListRow key={doc.id} doc={doc} selected={selected.has(doc.id)} isTrashed={isInTrash}
                    onToggleSelect={toggleSelect} onToggleFavorite={toggleFavorite} onRestore={restoreDoc} />
                ))}
                {!isInTrash && viewContext !== 'Favorites' && (
                  <button onClick={onGoToUpload}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300
                               hover:border-app-accent hover:bg-blue-50/40 transition-all cursor-pointer group">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 border border-dashed border-gray-300 group-hover:border-app-accent">
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-app-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-gray-500 group-hover:text-app-accent transition-colors">New Document</p>
                      <p className="text-[11px] text-gray-400">Upload image or PDF</p>
                    </div>
                  </button>
                )}
              </div>
            )}

          </div>
          <div className="h-20" />
        </div>

        {/* ══════════════════════════════════
            BOTTOM ACTION BAR
           ══════════════════════════════════ */}
        <div className="absolute bottom-0 left-[230px] right-0 pb-5 px-8 pointer-events-none">
          <div className="bg-gray-900 text-white rounded-2xl px-6 py-3.5 flex items-center gap-4 shadow-2xl pointer-events-auto">

            {/* Count */}
            <span className="text-[13px] text-gray-400 font-medium flex-shrink-0">
              Selected: <span className={`font-bold ${selected.size > 0 ? 'text-white' : 'text-gray-400'}`}>{selected.size}</span>
            </span>

            <div className="w-px h-5 bg-gray-700 flex-shrink-0" />

            {/* Actions */}
            <div className="flex items-center gap-0.5 flex-1 flex-wrap">
              {isInTrash ? (
                /* Trash-specific actions */
                <>
                  <button onClick={restoreSelected} disabled={selected.size === 0}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors cursor-pointer
                      ${selected.size > 0 ? 'text-emerald-400 hover:bg-emerald-900/30 hover:text-emerald-300' : 'text-gray-600 cursor-default'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Restore
                  </button>
                  <div className="w-px h-5 bg-gray-700 mx-1 flex-shrink-0" />
                  <button onClick={deleteForever} disabled={selected.size === 0}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors cursor-pointer
                      ${selected.size > 0 ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300' : 'text-gray-600 cursor-default'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Forever
                  </button>
                </>
              ) : (
                /* Normal actions */
                <>
                  {[
                    { label: 'Move',   icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg> },
                    { label: 'Label',  icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg> },
                    { label: 'Export', icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> },
                  ].map(({ label, icon }) => (
                    <button key={label} disabled={selected.size === 0}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors
                        ${selected.size > 0 ? 'text-gray-200 hover:bg-gray-800 hover:text-white cursor-pointer' : 'text-gray-600 cursor-default'}`}>
                      {icon} {label}
                    </button>
                  ))}
                  <div className="w-px h-5 bg-gray-700 mx-1 flex-shrink-0" />
                  <button onClick={moveToTrash} disabled={selected.size === 0}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors
                      ${selected.size > 0 ? 'text-red-400 hover:bg-red-900/30 hover:text-red-300 cursor-pointer' : 'text-gray-600 cursor-default'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </>
              )}
            </div>

            {/* Clear selection */}
            {selected.size > 0 && (
              <button onClick={clearSelection}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-800 hover:text-white transition-colors cursor-pointer flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
