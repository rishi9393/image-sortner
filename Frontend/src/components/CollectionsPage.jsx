import { useState, useCallback } from 'react'

/* ── Mock collections ──────────────────────────────────────────────────────── */
const INIT_COLLECTIONS = [
  {
    id: 1, name: 'Mathematics', notes: 42, lastUpdated: '2h ago', active: true,
    img: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&q=80',
    color: '#2563eb',
  },
  {
    id: 2, name: 'History', notes: 28, lastUpdated: '5h ago', active: false,
    img: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80',
    color: '#d97706',
  },
  {
    id: 3, name: 'Physics', notes: 15, lastUpdated: '1d ago', active: false,
    img: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80',
    color: '#7c3aed',
  },
  {
    id: 4, name: 'Chemistry', notes: 34, lastUpdated: '3d ago', active: false,
    img: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&q=80',
    color: '#059669',
  },
  {
    id: 5, name: 'Art History', notes: 12, lastUpdated: '1w ago', active: false,
    img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    color: '#db2777',
  },
  {
    id: 6, name: 'Biology', notes: 50, lastUpdated: '2w ago', active: false,
    img: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f3?w=600&q=80',
    color: '#16a34a',
  },
]

/* ── Sidebar icons ─────────────────────────────────────────────────────────── */
const MyNotesIcon   = () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
const CollectIcon   = ({ active }) => <svg className="w-[18px] h-[18px]" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
const FavoritesIcon = () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
const TrashIcon     = () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
const SettingsIcon  = () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
const ClockIcon     = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>

/* ── Create / Edit Collection Modal ────────────────────────────────────────── */
function CollectionModal({ existing, onSave, onClose }) {
  const [name,  setName]  = useState(existing?.name  || '')
  const [color, setColor] = useState(existing?.color || '#2563eb')

  const PRESET_COLORS = ['#2563eb','#7c3aed','#db2777','#d97706','#059669','#16a34a','#dc2626','#0891b2']

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), color })
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {existing ? 'Edit Collection' : 'Create New Collection'}
          </h2>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {existing ? 'Update collection details.' : 'Group your notes into a focused folder.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-5">
          {/* Name */}
          <div>
            <label className="block text-[12px] font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
              Collection Name
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Mathematics, Work Notes…"
              maxLength={40}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
                         placeholder-gray-400 transition-all"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-[12px] font-bold text-gray-700 mb-2 uppercase tracking-wide">
              Colour
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all cursor-pointer border-2
                    ${color === c ? 'scale-125 border-gray-400' : 'border-transparent hover:scale-110'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim()}
              className="px-5 py-2 rounded-xl text-[13px] font-bold text-white bg-blue-600
                         hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-sm"
              style={{ background: color }}>
              {existing ? 'Save Changes' : 'Create Collection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Delete confirm modal ──────────────────────────────────────────────────── */
function DeleteModal({ name, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-[16px] font-bold text-gray-900 mb-1">Delete "{name}"?</h3>
        <p className="text-[13px] text-gray-500 mb-5">This collection will be removed. Notes inside won't be deleted.</p>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer">
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Collection card ───────────────────────────────────────────────────────── */
function CollectionCard({ col, onOpen, onEdit, onDelete, onToggleActive }) {
  const [imgErr, setImgErr] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer group"
      onClick={() => onOpen(col)}
    >
      {/* Cover image */}
      <div className="relative" style={{ height: '180px' }}>
        {!imgErr ? (
          <img src={col.img} alt={col.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgErr(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: `${col.color}18` }}>
            <svg className="w-12 h-12" fill="none" stroke={col.color} viewBox="0 0 24 24" style={{ opacity: 0.4 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
          </div>
        )}

        {/* 3-dot menu */}
        <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}>
          <div className="w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow border border-white/60 hover:bg-white transition-colors cursor-pointer">
            <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </div>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={e => { e.stopPropagation(); setMenuOpen(false) }} />
              <div className="absolute top-10 right-0 z-20 bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-40 overflow-hidden">
                <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(col) }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </button>
                <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onToggleActive(col.id) }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {col.active ? 'Mark Inactive' : 'Mark Active'}
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(col) }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>

        {/* Colour accent bar at bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: col.color }} />
      </div>

      {/* Body */}
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-[15px] font-bold text-gray-900 truncate flex-1">{col.name}</h3>
          {col.active && (
            <span className="flex-shrink-0 px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded-full border border-blue-200 uppercase tracking-wide">
              Active
            </span>
          )}
        </div>

        <p className="text-[13px] text-gray-500 mb-2.5">
          {col.notes} Note{col.notes !== 1 ? 's' : ''}
        </p>

        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <ClockIcon />
          <span>Last updated {col.lastUpdated}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Add Collection card ───────────────────────────────────────────────────── */
function AddCard({ onCreate }) {
  return (
    <button onClick={onCreate}
      className="bg-white rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/30
                 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-3 group"
      style={{ minHeight: '280px' }}>
      <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 group-hover:border-blue-400
                      flex items-center justify-center transition-colors">
        <svg className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <p className="text-[14px] font-semibold text-gray-500 group-hover:text-blue-600 transition-colors">
        Add Collection
      </p>
    </button>
  )
}

/* ── Collection Detail view ────────────────────────────────────────────────── */
const DETAIL_NOTES = [
  { id: 1, title: 'Chapter 1 — Algebra',     date: 'Added May 10, 2024', tags: ['#algebra', '#equations'],  img: 'https://images.unsplash.com/photo-1509228627152-72ae9ae6848d?w=300&q=80' },
  { id: 2, title: 'Calculus Practice Set 3', date: 'Added May 8, 2024',  tags: ['#calculus', '#practice'],  img: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&q=80' },
  { id: 3, title: 'Trigonometry Notes',       date: 'Modified 3d ago',    tags: ['#trig'],                   img: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=300&q=80' },
  { id: 4, title: 'Statistics Summary',       date: 'Added Apr 28, 2024', tags: ['#stats', '#probability'], img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300&q=80' },
]

function CollectionDetail({ col, onBack, onGoToUpload }) {
  const [imgErrors, setImgErrors] = useState({})

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 pt-7 pb-4">

        {/* Breadcrumb + title */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack}
            className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Collections</p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: col.color }} />
              <h1 className="text-[24px] font-extrabold text-gray-900">{col.name}</h1>
              {col.active && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded-full border border-blue-200 uppercase tracking-wide">
                  Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-6">
          {[
            { label: 'Total Notes', value: col.notes, icon: '📄' },
            { label: 'Last Updated', value: col.lastUpdated, icon: '🕐' },
            { label: 'Status', value: col.active ? 'Active' : 'Inactive', icon: '📍' },
          ].map(s => (
            <div key={s.label} className="flex-1 bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">{s.label}</p>
              <p className="text-[15px] font-bold text-gray-900">{s.icon} {s.value}</p>
            </div>
          ))}
          <button onClick={onGoToUpload}
            className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold
                       rounded-xl shadow-sm transition-colors cursor-pointer flex-shrink-0"
            style={{ background: col.color }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Add Notes
          </button>
        </div>

        {/* Notes grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {DETAIL_NOTES.map(note => (
            <div key={note.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group">
              <div style={{ height: '140px' }} className="overflow-hidden bg-gray-100">
                {!imgErrors[note.id] ? (
                  <img src={note.img} alt={note.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={() => setImgErrors(p => ({ ...p, [note.id]: true }))} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="px-3.5 pt-3 pb-3.5">
                <p className="text-[13px] font-bold text-gray-900 mb-1 line-clamp-1">{note.title}</p>
                <p className="text-[11px] text-gray-400 mb-2">{note.date}</p>
                <div className="flex flex-wrap gap-1">
                  {note.tags.map(t => (
                    <span key={t} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-500 border border-gray-200">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════════════ */
export default function CollectionsPage({ onGoToNotes, onGoHome, onGoToUpload }) {
  const [collections, setCollections] = useState(INIT_COLLECTIONS)
  const [search,      setSearch]      = useState('')
  const [modal,       setModal]       = useState(null)   // null | 'create' | { col } (edit)
  const [deleteTarget, setDeleteTarget] = useState(null) // null | col
  const [openCol,     setOpenCol]     = useState(null)   // null | col — detail view

  /* ── CRUD ─────────────────────────────────────────────────────────────────── */
  const handleCreate = useCallback(({ name, color }) => {
    setCollections(p => [...p, {
      id: Date.now(), name, color, notes: 0,
      lastUpdated: 'just now', active: false,
      img: `https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=600&q=80`,
    }])
    setModal(null)
  }, [])

  const handleEdit = useCallback(({ name, color }) => {
    setCollections(p => p.map(c => c.id === modal.col.id ? { ...c, name, color } : c))
    setModal(null)
  }, [modal])

  const handleDelete = useCallback(() => {
    setCollections(p => p.filter(c => c.id !== deleteTarget.id))
    setDeleteTarget(null)
  }, [deleteTarget])

  const handleToggleActive = useCallback(id => {
    setCollections(p => p.map(c => c.id === id ? { ...c, active: !c.active } : c))
  }, [])

  /* ── Filtered list ─────────────────────────────────────────────────────────── */
  const filtered = search.trim()
    ? collections.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : collections

  const NAV = [
    { key: 'notes',       label: 'My Notes',    icon: <MyNotesIcon />,         onClick: onGoToNotes   },
    { key: 'collections', label: 'Collections', icon: <CollectIcon active />,  onClick: () => {}      },
    { key: 'favorites',   label: 'Favorites',   icon: <FavoritesIcon />,        onClick: () => {}      },
    { key: 'trash',       label: 'Trash',       icon: <TrashIcon />,            onClick: () => {}      },
    { key: 'settings',    label: 'Settings',    icon: <SettingsIcon />,         onClick: () => {}      },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-white" style={{ fontFamily: 'Inter,system-ui,sans-serif' }}>

      {/* ══════════════════════════════════
          SIDEBAR
         ══════════════════════════════════ */}
      <aside className="w-[230px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0 h-screen">

        {/* Logo */}
        <div className="px-5 pt-5 pb-5 border-b border-gray-100">
          <button onClick={onGoHome} className="flex items-center gap-2.5 cursor-pointer group">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow group-hover:bg-blue-700 transition-colors flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
            </div>
            <div className="text-left">
              <p className="text-[14px] font-bold text-gray-900 leading-none">Smart Notes</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">Image Sorter</p>
            </div>
          </button>
        </div>

        {/* Nav */}
        <nav className="px-3 py-4 flex flex-col gap-0.5 flex-1">
          {NAV.map(({ key, label, icon, onClick }) => {
            const active = key === 'collections'
            return (
              <button key={key} onClick={onClick}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium w-full text-left cursor-pointer transition-all duration-150
                  ${active ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                <span className={active ? 'text-blue-600' : 'text-gray-400'}>{icon}</span>
                {label}
              </button>
            )
          })}
        </nav>

        {/* Upgrade Plan card */}
        <div className="mx-3 mb-4 px-4 py-4 bg-blue-50 rounded-2xl border border-blue-100">
          <p className="text-[13px] font-bold text-gray-900 mb-1">Upgrade Plan</p>
          <p className="text-[11px] text-gray-500 mb-3 leading-snug">Get advanced OCR and unlimited storage.</p>
          <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-xl transition-colors cursor-pointer">
            Go Pro
          </button>
        </div>

      </aside>

      {/* ══════════════════════════════════
          MAIN
         ══════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
          {/* Search */}
          <div className="flex-1 relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search across all collections..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-full text-[13px] text-gray-700
                         placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30
                         focus:bg-white border border-transparent focus:border-blue-400/40 transition-all" />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Bell */}
            <button className="relative w-9 h-9 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>

            {/* User */}
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="text-right">
                <p className="text-[12px] font-bold text-gray-900 leading-none">Alex Rivera</p>
                <p className="text-[10px] text-gray-400 leading-none mt-0.5 uppercase tracking-wide">Free Plan</p>
              </div>
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 pt-7 pb-24">

            {/* Page header */}
            {!openCol && (
              <div className="flex items-start justify-between mb-7">
                <div>
                  <h1 className="text-[32px] font-extrabold text-gray-900 leading-tight">Collections</h1>
                  <p className="text-[14px] text-gray-500 mt-1">Organize your visual notes into logical folders.</p>
                </div>
                <button onClick={() => setModal('create')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold
                             rounded-full shadow transition-colors cursor-pointer flex-shrink-0 mt-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Create New Collection
                </button>
              </div>
            )}

            {/* Detail view */}
            {openCol ? (
              <CollectionDetail col={openCol} onBack={() => setOpenCol(null)} onGoToUpload={onGoToUpload} />
            ) : (
              <>
                {/* Empty search */}
                {filtered.length === 0 && search && (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-base font-bold text-gray-600 mb-1">No collections match "{search}"</p>
                    <button onClick={() => setSearch('')}
                      className="text-sm font-semibold text-blue-600 hover:underline cursor-pointer mt-2">
                      Clear search
                    </button>
                  </div>
                )}

                {/* Grid */}
                {!(filtered.length === 0 && search) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                    {/* Add card — always first */}
                    <AddCard onCreate={() => setModal('create')} />

                    {filtered.map(col => (
                      <CollectionCard
                        key={col.id}
                        col={col}
                        onOpen={c  => setOpenCol(c)}
                        onEdit={c  => setModal({ col: c })}
                        onDelete={c => setDeleteTarget(c)}
                        onToggleActive={handleToggleActive}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Floating + button (bottom right) */}
        {!openCol && (
          <button onClick={() => setModal('create')}
            className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full
                       shadow-xl flex items-center justify-center transition-all hover:scale-110 cursor-pointer z-40">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {modal === 'create' && (
        <CollectionModal onSave={handleCreate} onClose={() => setModal(null)} />
      )}
      {modal && modal.col && (
        <CollectionModal existing={modal.col} onSave={handleEdit} onClose={() => setModal(null)} />
      )}
      {deleteTarget && (
        <DeleteModal name={deleteTarget.name} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
      )}

    </div>
  )
}
