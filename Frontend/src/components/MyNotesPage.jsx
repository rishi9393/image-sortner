import { useState, useMemo, useCallback, useEffect, useRef } from 'react'

/* ══════════════════════════════════════════════════════════════════════════════
   LOCALSTORAGE HELPERS
   ══════════════════════════════════════════════════════════════════════════════ */

function loadNotes() {
  try {
    const cols = JSON.parse(localStorage.getItem('collections') || '[]')
    const unc  = JSON.parse(localStorage.getItem('uncategorized_notes') || '[]')
    const flat = []

    cols.filter(c => !c.trashed).forEach(col => {
      ;(col.notesList || []).forEach(note => {
        flat.push({
          ...note,
          favorited:       note.favorited       || false,
          trashed:         note.trashed         || false,
          collectionId:    col.id,
          collectionName:  col.name,
          collectionColor: col.color,
        })
      })
    })

    unc.forEach(note => {
      flat.push({
        ...note,
        favorited:       note.favorited || false,
        trashed:         note.trashed   || false,
        collectionId:    null,
        collectionName:  null,
        collectionColor: null,
      })
    })

    return flat
  } catch {
    return []
  }
}

function loadCollections() {
  try {
    return JSON.parse(localStorage.getItem('collections') || '[]').filter(c => !c.trashed)
  } catch {
    return []
  }
}

function writeNoteUpdate(noteId, updates) {
  try {
    const cols = JSON.parse(localStorage.getItem('collections') || '[]')
    let found = false
    const newCols = cols.map(c => ({
      ...c,
      notesList: (c.notesList || []).map(n => {
        if (n.id === noteId) { found = true; return { ...n, ...updates } }
        return n
      }),
    }))
    if (found) { localStorage.setItem('collections', JSON.stringify(newCols)); return }

    const unc = JSON.parse(localStorage.getItem('uncategorized_notes') || '[]')
    localStorage.setItem('uncategorized_notes',
      JSON.stringify(unc.map(n => n.id === noteId ? { ...n, ...updates } : n))
    )
  } catch {}
}

function removeNoteFromStorage(noteId) {
  try {
    const cols = JSON.parse(localStorage.getItem('collections') || '[]')
    let found = false
    const newCols = cols.map(c => ({
      ...c,
      notesList: (c.notesList || []).filter(n => {
        if (n.id === noteId) { found = true; return false }
        return true
      }),
    }))
    if (found) { localStorage.setItem('collections', JSON.stringify(newCols)); return }

    const unc = JSON.parse(localStorage.getItem('uncategorized_notes') || '[]')
    localStorage.setItem('uncategorized_notes', JSON.stringify(unc.filter(n => n.id !== noteId)))
  } catch {}
}

function doAssignToCollection(noteId, targetColId) {
  try {
    const unc = JSON.parse(localStorage.getItem('uncategorized_notes') || '[]')
    const note = unc.find(n => n.id === noteId)
    if (!note) return

    const { collectionId, collectionName, collectionColor, ...cleanNote } = note
    localStorage.setItem('uncategorized_notes', JSON.stringify(unc.filter(n => n.id !== noteId)))

    const cols = JSON.parse(localStorage.getItem('collections') || '[]')
    localStorage.setItem('collections', JSON.stringify(
      cols.map(c => c.id === targetColId
        ? { ...c, notesList: [...(c.notesList || []), cleanNote], lastUpdated: 'just now' }
        : c
      )
    ))
  } catch {}
}

/* ══════════════════════════════════════════════════════════════════════════════
   ICONS
   ══════════════════════════════════════════════════════════════════════════════ */
const HomeIcon     = () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
const LibraryIcon  = ({ active }) => <svg className="w-[18px] h-[18px]" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 4h18" /></svg>
const FavIcon      = ({ active }) => <svg className="w-[18px] h-[18px]" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
const TrashIcon    = () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
const FolderIcon   = () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>

/* ══════════════════════════════════════════════════════════════════════════════
   ASSIGN TO COLLECTION DROPDOWN
   ══════════════════════════════════════════════════════════════════════════════ */
function AssignDropdown({ collections, onAssign, onClose }) {
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref}
      className="absolute top-full mt-1 right-0 z-30 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 w-48 overflow-hidden">
      <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Move to collection</p>
      {collections.length === 0 ? (
        <p className="px-3 py-2 text-[12px] text-gray-400">No collections yet</p>
      ) : (
        collections.map(col => (
          <button key={col.id} onClick={() => onAssign(col.id)}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col.color }} />
            <span className="truncate">{col.name}</span>
          </button>
        ))
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   NOTE GRID CARD
   ══════════════════════════════════════════════════════════════════════════════ */
function NoteCard({ note, selected, isTrashed, collections, onToggleSelect, onToggleFavorite, onRestore, onAssign }) {
  const [imgErr,      setImgErr]      = useState(false)
  const [showAssign,  setShowAssign]  = useState(false)
  const isUncategorized = !note.collectionId

  return (
    <div onClick={() => onToggleSelect(note.id)}
      className={`bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 border hover:shadow-lg relative
        ${selected ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' : 'border-gray-200 shadow-sm hover:border-gray-300'}
        ${isTrashed ? 'opacity-70' : ''}`}>

      {/* Image */}
      <div className="relative" style={{ height: '150px' }}>
        {note.img && !imgErr ? (
          <img src={note.img} alt={note.title} className="w-full h-full object-cover"
            onError={() => setImgErr(true)} />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        )}

        {/* Checkbox */}
        <div className={`absolute top-2.5 left-2.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
          ${selected ? 'bg-blue-600 border-blue-600 opacity-100' : 'bg-white border-gray-300 opacity-0 hover:opacity-100'}`}>
          {selected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
        </div>

        {/* Top right: restore or heart */}
        <div className="absolute top-2.5 right-2.5" onClick={e => e.stopPropagation()}>
          {isTrashed ? (
            <button onClick={() => onRestore(note.id)}
              className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center border border-gray-100 hover:scale-110 hover:border-emerald-300 transition-all cursor-pointer">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          ) : (
            <button onClick={() => onToggleFavorite(note.id)}
              className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center border border-gray-100 hover:scale-110 transition-all cursor-pointer">
              <svg className={`w-4 h-4 transition-colors ${note.favorited ? 'text-red-500 fill-red-500' : 'text-gray-400 fill-none'}`}
                stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          )}
        </div>

        {/* Trashed badge */}
        {isTrashed && (
          <div className="absolute bottom-2 left-2.5">
            <span className="px-2 py-0.5 bg-red-100 text-red-500 text-[9px] font-bold rounded border border-red-200 uppercase">Deleted</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-3.5 pt-3 pb-3.5">
        <p className="text-[13px] font-bold text-gray-900 leading-snug line-clamp-1 mb-1">{note.title}</p>
        <p className="text-[11px] text-gray-400 mb-2">{note.date}</p>

        {/* Tags */}
        {note.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {note.tags.map(t => (
              <span key={t} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-500 border border-gray-200">{t}</span>
            ))}
          </div>
        )}

        {/* Collection badge + Assign button */}
        <div className="flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
          {/* Collection badge */}
          {note.collectionId ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: note.collectionColor }} />
              <span className="text-[11px] text-gray-500 font-medium truncate">{note.collectionName}</span>
            </div>
          ) : (
            <span className="text-[11px] text-gray-400 italic">Uncategorized</span>
          )}

          {/* Assign button — only for uncategorized, not in trash */}
          {isUncategorized && !isTrashed && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowAssign(v => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-[11px] font-bold border border-blue-100 transition-colors cursor-pointer">
                <FolderIcon />
                Assign
              </button>
              {showAssign && (
                <AssignDropdown
                  collections={collections}
                  onAssign={(colId) => { onAssign(note.id, colId); setShowAssign(false) }}
                  onClose={() => setShowAssign(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   NOTE LIST ROW
   ══════════════════════════════════════════════════════════════════════════════ */
function NoteRow({ note, selected, isTrashed, collections, onToggleSelect, onToggleFavorite, onRestore, onAssign }) {
  const [imgErr,     setImgErr]     = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const isUncategorized = !note.collectionId

  return (
    <div onClick={() => onToggleSelect(note.id)}
      className={`flex items-center gap-4 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-150
        ${selected ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
        ${isTrashed ? 'opacity-70' : ''}`}>

      {/* Checkbox */}
      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors
        ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-500'}`}>
        {selected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
      </div>

      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
        {note.img && !imgErr
          ? <img src={note.img} alt={note.title} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          : <div className="w-full h-full flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-bold text-gray-900 truncate">{note.title}</p>
          {isTrashed && <span className="px-1.5 py-0.5 bg-red-100 text-red-500 text-[9px] font-bold rounded border border-red-200 uppercase flex-shrink-0">Deleted</span>}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400">{note.date}</p>
          {note.collectionId ? (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: note.collectionColor }} />
              <span className="text-[10px] text-gray-500 font-medium">{note.collectionName}</span>
            </div>
          ) : (
            <span className="text-[10px] text-gray-400 italic">Uncategorized</span>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
        {note.tags?.map(t => (
          <span key={t} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-500 border border-gray-200">{t}</span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
        {/* Assign button for uncategorized */}
        {isUncategorized && !isTrashed && (
          <div className="relative">
            <button onClick={() => setShowAssign(v => !v)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-[11px] font-bold border border-blue-100 transition-colors cursor-pointer">
              <FolderIcon />
              Assign
            </button>
            {showAssign && (
              <AssignDropdown
                collections={collections}
                onAssign={(colId) => { onAssign(note.id, colId); setShowAssign(false) }}
                onClose={() => setShowAssign(false)}
              />
            )}
          </div>
        )}

        {isTrashed ? (
          <button onClick={() => onRestore(note.id)}
            className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center border border-gray-100 hover:border-emerald-300 transition-all cursor-pointer">
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        ) : (
          <button onClick={() => onToggleFavorite(note.id)}
            className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center border border-gray-100 hover:scale-110 transition-all cursor-pointer">
            <svg className={`w-4 h-4 ${note.favorited ? 'text-red-500 fill-red-500' : 'text-gray-400 fill-none'}`}
              stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════════════ */
export default function MyNotesPage({ onGoHome, onGoToUpload }) {
  const [notes,        setNotes]       = useState(loadNotes)
  const [collections,  setCollections] = useState(loadCollections)
  const [activeView,   setActiveView]  = useState('all')   // 'all' | 'favorites' | 'trash' | colId | 'uncategorized'
  const [search,       setSearch]      = useState('')
  const [viewMode,     setViewMode]    = useState('grid')
  const [selected,     setSelected]    = useState(new Set())

  /* ── Reload from localStorage when page becomes active ─────────────────── */
  useEffect(() => {
    setNotes(loadNotes())
    setCollections(loadCollections())
  }, [])

  /* ── Counts ─────────────────────────────────────────────────────────────── */
  const totalCount        = useMemo(() => notes.filter(n => !n.trashed).length, [notes])
  const favCount          = useMemo(() => notes.filter(n => !n.trashed && n.favorited).length, [notes])
  const trashCount        = useMemo(() => notes.filter(n => n.trashed).length, [notes])
  const uncategorizedCount = useMemo(() => notes.filter(n => !n.trashed && !n.collectionId).length, [notes])
  const colCount = useCallback(id => notes.filter(n => !n.trashed && n.collectionId === id).length, [notes])

  /* ── Filtered notes ─────────────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    let out = notes

    if (activeView === 'trash') {
      out = out.filter(n => n.trashed)
    } else {
      out = out.filter(n => !n.trashed)
      if (activeView === 'favorites')      out = out.filter(n => n.favorited)
      else if (activeView === 'uncategorized') out = out.filter(n => !n.collectionId)
      else if (activeView !== 'all')       out = out.filter(n => n.collectionId === activeView)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(n =>
        n.title?.toLowerCase().includes(q) ||
        n.tags?.some(t => t.toLowerCase().includes(q))
      )
    }

    return out
  }, [notes, activeView, search])

  const isTrash = activeView === 'trash'

  /* ── Heading ─────────────────────────────────────────────────────────────── */
  const headingMap = {
    all:           { title: 'My Notes',      sub: 'All your processed notes in one place.' },
    favorites:     { title: 'Favorites',     sub: 'Notes you\'ve starred for quick access.' },
    trash:         { title: 'Trash',         sub: 'Deleted notes. Restore or remove them forever.' },
    uncategorized: { title: 'Uncategorized', sub: 'Notes not yet assigned to any collection.' },
  }
  const activeCol = collections.find(c => c.id === activeView)
  const heading = activeCol
    ? { title: activeCol.name, sub: `Notes in the "${activeCol.name}" collection.` }
    : (headingMap[activeView] || headingMap.all)

  /* ── Mutations ───────────────────────────────────────────────────────────── */
  const toggleFavorite = useCallback(id => {
    setNotes(prev => prev.map(n => {
      if (n.id !== id) return n
      const updated = { ...n, favorited: !n.favorited }
      writeNoteUpdate(id, { favorited: updated.favorited })
      return updated
    }))
  }, [])

  const moveToTrash = useCallback((ids) => {
    const set = ids instanceof Set ? ids : new Set([ids])
    setNotes(prev => prev.map(n => {
      if (!set.has(n.id)) return n
      writeNoteUpdate(n.id, { trashed: true })
      return { ...n, trashed: true }
    }))
    setSelected(new Set())
  }, [])

  const restoreNote = useCallback((id) => {
    setNotes(prev => prev.map(n => {
      if (n.id !== id) return n
      writeNoteUpdate(id, { trashed: false })
      return { ...n, trashed: false }
    }))
  }, [])

  const restoreSelected = useCallback(() => {
    setNotes(prev => prev.map(n => {
      if (!selected.has(n.id)) return n
      writeNoteUpdate(n.id, { trashed: false })
      return { ...n, trashed: false }
    }))
    setSelected(new Set())
  }, [selected])

  const deleteForever = useCallback((ids) => {
    const set = ids instanceof Set ? ids : new Set([ids])
    set.forEach(id => removeNoteFromStorage(id))
    setNotes(prev => prev.filter(n => !set.has(n.id)))
    setSelected(new Set())
  }, [])

  const emptyTrash = useCallback(() => {
    const trashIds = new Set(notes.filter(n => n.trashed).map(n => n.id))
    deleteForever(trashIds)
  }, [notes, deleteForever])

  const assignToCollection = useCallback((noteId, colId) => {
    doAssignToCollection(noteId, colId)
    const col = collections.find(c => c.id === colId)
    setNotes(prev => prev.map(n =>
      n.id === noteId
        ? { ...n, collectionId: colId, collectionName: col?.name || '', collectionColor: col?.color || '#666' }
        : n
    ))
  }, [collections])

  /* ── Selection ───────────────────────────────────────────────────────────── */
  const toggleSelect   = useCallback(id => setSelected(p => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s }), [])
  const clearSelection = useCallback(() => setSelected(new Set()), [])

  /* ── Sidebar nav ─────────────────────────────────────────────────────────── */
  const handleNav = (key) => {
    if (key === 'home') { onGoHome(); return }
    setActiveView(key)
    setSearch('')
    setSelected(new Set())
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f2f5', fontFamily: 'Inter,system-ui,sans-serif' }}>

      {/* ════════════════════ SIDEBAR ════════════════════ */}
      <aside className="w-[230px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0 h-screen">

        {/* Logo */}
        <div className="px-5 pt-5 pb-4">
          <button onClick={onGoHome} className="flex items-center gap-2.5 cursor-pointer group">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow group-hover:bg-blue-700 transition-colors flex-shrink-0">
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
            { key: 'home',          icon: <HomeIcon />,              label: 'Home',          count: null          },
            { key: 'all',           icon: <LibraryIcon active={activeView==='all'} />, label: 'All Notes', count: totalCount },
            { key: 'favorites',     icon: <FavIcon active={activeView==='favorites'} />, label: 'Favorites',  count: favCount },
            { key: 'uncategorized', icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>, label: 'Uncategorized', count: uncategorizedCount },
            { key: 'trash',         icon: <TrashIcon />,             label: 'Trash',         count: trashCount    },
          ].map(({ key, icon, label, count }) => {
            const isActive = activeView === key
            const isTrashKey = key === 'trash'
            const isUncatKey = key === 'uncategorized'
            return (
              <button key={key} onClick={() => handleNav(key)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium w-full text-left cursor-pointer transition-all duration-150
                  ${isActive
                    ? isTrashKey  ? 'bg-red-50 text-red-600 font-semibold'
                    : isUncatKey  ? 'bg-orange-50 text-orange-600 font-semibold'
                    :               'bg-blue-50 text-blue-600 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                <span className={isActive
                  ? isTrashKey ? 'text-red-500' : isUncatKey ? 'text-orange-500' : 'text-blue-600'
                  : 'text-gray-400'}>{icon}</span>
                <span className="flex-1">{label}</span>
                {count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                    ${isActive
                      ? isTrashKey ? 'bg-red-500 text-white' : isUncatKey ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="mx-4 border-t border-gray-100 mb-3" />

        {/* Collections from localStorage */}
        <div className="px-3 flex-1 overflow-y-auto">
          <p className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Collections</p>
          {collections.length === 0 ? (
            <p className="px-2 text-[12px] text-gray-400 italic">No collections yet</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {collections.map(col => {
                const isActive = activeView === col.id
                const cnt = colCount(col.id)
                return (
                  <button key={col.id} onClick={() => handleNav(col.id)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] w-full text-left cursor-pointer transition-all duration-150
                      ${isActive ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
                    <span className="flex-1 truncate">{col.name}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                      ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {cnt}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Bottom */}
        <div className="px-4 pb-4 pt-3 border-t border-gray-100">
          <button onClick={onGoToUpload}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white text-[13px] font-bold
                       rounded-xl hover:bg-blue-700 transition-colors cursor-pointer mb-3 shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            New Upload
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>AR</div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-gray-900 leading-none truncate">Alex Rivera</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">Free Plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ════════════════════ MAIN ════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <div className="flex-1 relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search notes by title or tag..."
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full text-[13px] text-gray-700
                         placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30
                         focus:bg-white border border-transparent focus:border-blue-400/40 transition-all" />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View toggle */}
            <div className="flex items-center p-1 bg-white border border-gray-200 rounded-xl shadow-sm">
              {[
                { m: 'grid', icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
                { m: 'list', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
              ].map(({ m, icon }) => (
                <button key={m} onClick={() => setViewMode(m)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer
                    ${viewMode === m ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-700'}`}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 pt-7 pb-4">

            {/* Heading */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  {activeCol && <span className="w-4 h-4 rounded-full" style={{ background: activeCol.color }} />}
                  <h1 className="text-[28px] font-extrabold text-gray-900 leading-tight">{heading.title}</h1>
                </div>
                <p className="text-[13px] text-gray-500">{heading.sub}</p>
              </div>

              <div className="flex items-center gap-2 mt-1 flex-shrink-0">
                {isTrash && trashCount > 0 && (
                  <button onClick={emptyTrash}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold
                               bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Empty Trash
                  </button>
                )}
              </div>
            </div>

            {/* Uncategorized info banner */}
            {activeView === 'uncategorized' && uncategorizedCount > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl mb-5">
                <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[12px] text-orange-700 font-medium">
                  These notes haven't been assigned to a collection yet. Click <strong>Assign</strong> on any note to move it.
                </p>
              </div>
            )}

            {/* Empty states */}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                {isTrash ? (
                  <>
                    <div className="w-14 h-14 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center mb-4">
                      <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </div>
                    <p className="text-[16px] font-bold text-gray-600 mb-1">Trash is empty</p>
                    <p className="text-[13px] text-gray-400">Deleted notes will appear here.</p>
                  </>
                ) : activeView === 'favorites' ? (
                  <>
                    <div className="text-4xl mb-4">⭐</div>
                    <p className="text-[16px] font-bold text-gray-600 mb-1">No favorites yet</p>
                    <p className="text-[13px] text-gray-400">Tap the ♡ on any note to add it here.</p>
                  </>
                ) : activeView === 'uncategorized' ? (
                  <>
                    <div className="text-4xl mb-4">✅</div>
                    <p className="text-[16px] font-bold text-gray-600 mb-1">All notes are organized!</p>
                    <p className="text-[13px] text-gray-400">Every note has been assigned to a collection.</p>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center mb-4">
                      <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-[16px] font-bold text-gray-600 mb-1">
                      {search ? `No results for "${search}"` : 'No notes here yet'}
                    </p>
                    <p className="text-[13px] text-gray-400 mb-4">
                      {search ? 'Try a different search term.' : 'Upload images to create notes.'}
                    </p>
                    {search
                      ? <button onClick={() => setSearch('')} className="text-sm font-semibold text-blue-600 hover:underline cursor-pointer">Clear search</button>
                      : <button onClick={onGoToUpload} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-[13px] font-bold rounded-full shadow hover:bg-blue-700 transition-colors cursor-pointer">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          Upload Images
                        </button>
                    }
                  </>
                )}
              </div>
            )}

            {/* Grid */}
            {viewMode === 'grid' && filtered.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map(note => (
                  <NoteCard key={note.id} note={note} selected={selected.has(note.id)} isTrashed={isTrash}
                    collections={collections}
                    onToggleSelect={toggleSelect}
                    onToggleFavorite={toggleFavorite}
                    onRestore={restoreNote}
                    onAssign={assignToCollection}
                  />
                ))}
              </div>
            )}

            {/* List */}
            {viewMode === 'list' && filtered.length > 0 && (
              <div className="flex flex-col gap-2">
                {filtered.map(note => (
                  <NoteRow key={note.id} note={note} selected={selected.has(note.id)} isTrashed={isTrash}
                    collections={collections}
                    onToggleSelect={toggleSelect}
                    onToggleFavorite={toggleFavorite}
                    onRestore={restoreNote}
                    onAssign={assignToCollection}
                  />
                ))}
              </div>
            )}

          </div>
          <div className="h-24" />
        </div>

        {/* ════ BOTTOM ACTION BAR ════ */}
        <div className="absolute bottom-0 left-[230px] right-0 pb-5 px-8 pointer-events-none">
          <div className="bg-gray-900 text-white rounded-2xl px-6 py-3.5 flex items-center gap-4 shadow-2xl pointer-events-auto">
            <span className="text-[13px] text-gray-400 font-medium flex-shrink-0">
              Selected: <span className={`font-bold ${selected.size > 0 ? 'text-white' : 'text-gray-500'}`}>{selected.size}</span>
            </span>
            <div className="w-px h-5 bg-gray-700 flex-shrink-0" />
            <div className="flex items-center gap-0.5 flex-1">
              {isTrash ? (
                <>
                  <button onClick={restoreSelected} disabled={selected.size === 0}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors
                      ${selected.size > 0 ? 'text-emerald-400 hover:bg-emerald-900/30 cursor-pointer' : 'text-gray-600 cursor-default'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Restore
                  </button>
                  <div className="w-px h-5 bg-gray-700 mx-1" />
                  <button onClick={() => deleteForever(selected)} disabled={selected.size === 0}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors
                      ${selected.size > 0 ? 'text-red-400 hover:bg-red-900/30 cursor-pointer' : 'text-gray-600 cursor-default'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Delete Forever
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => moveToTrash(selected)} disabled={selected.size === 0}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors
                      ${selected.size > 0 ? 'text-red-400 hover:bg-red-900/30 cursor-pointer' : 'text-gray-600 cursor-default'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Delete
                  </button>
                </>
              )}
            </div>
            {selected.size > 0 && (
              <button onClick={clearSelection}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-800 hover:text-white transition-colors cursor-pointer flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
