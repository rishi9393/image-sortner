import { useState, useCallback, useRef } from 'react'

/* ── Mock collections ──────────────────────────────────────────────────────── */
const INIT_COLLECTIONS = [
  {
    id: 1, name: 'Mathematics', notes: 42, lastUpdated: '2h ago', active: true,
    img: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&q=80',
    color: '#2563eb', favorited: false, trashed: false,
  },
  {
    id: 2, name: 'History', notes: 28, lastUpdated: '5h ago', active: false,
    img: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80',
    color: '#d97706', favorited: false, trashed: false,
  },
  {
    id: 3, name: 'Physics', notes: 15, lastUpdated: '1d ago', active: false,
    img: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80',
    color: '#7c3aed', favorited: false, trashed: false,
  },
  {
    id: 4, name: 'Chemistry', notes: 34, lastUpdated: '3d ago', active: false,
    img: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&q=80',
    color: '#059669', favorited: false, trashed: false,
  },
  {
    id: 5, name: 'Art History', notes: 12, lastUpdated: '1w ago', active: false,
    img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    color: '#db2777', favorited: false, trashed: false,
  },
  {
    id: 6, name: 'Biology', notes: 50, lastUpdated: '2w ago', active: false,
    img: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f3?w=600&q=80',
    color: '#16a34a', favorited: false, trashed: false,
  },
]

/* ── Preset cover photos ───────────────────────────────────────────────────── */
const PRESET_COVERS = [
  { id: 'p1', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80', label: 'Portrait'   },
  { id: 'p2', url: 'https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=600&q=80', label: 'Abstract'  },
  { id: 'p3', url: 'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=600&q=80', label: 'Minimal'   },
  { id: 'p4', url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=600&q=80', label: 'Office'    },
  { id: 'p5', url: 'https://images.unsplash.com/photo-1483546416237-76fd26bbcdd1?w=600&q=80', label: 'Tech'      },
  { id: 'p6', url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', label: 'Workspace' },
  { id: 'p7', url: 'https://images.unsplash.com/photo-1477346611705-65d1883cee1e?w=600&q=80', label: 'Nature'   },
  { id: 'p8', url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&q=80', label: 'Study'    },
]

/* ── Icons ─────────────────────────────────────────────────────────────────── */
const MyNotesIcon   = () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
const CollectIcon   = ({ active }) => <svg className="w-[18px] h-[18px]" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
const FavoritesIcon = ({ filled }) => <svg className="w-[18px] h-[18px]" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
const TrashIcon     = () => <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
const ClockIcon     = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
const HeartIcon     = ({ filled }) => (
  <svg className="w-4 h-4" fill={filled ? '#ef4444' : 'none'} stroke={filled ? '#ef4444' : 'currentColor'} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
)
const RestoreIcon   = () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>

/* ══════════════════════════════════════════════════════════════════════════════
   CREATE / EDIT MODAL
   ══════════════════════════════════════════════════════════════════════════════ */
function CollectionModal({ existing, onSave, onClose }) {
  const [name,       setName]       = useState(existing?.name  || '')
  const [color,      setColor]      = useState(existing?.color || '#2563eb')
  const [img,        setImg]        = useState(existing?.img   || null)
  const [tab,        setTab]        = useState('upload')
  const [dragOver,   setDragOver]   = useState(false)
  const [previewErr, setPreviewErr] = useState(false)
  const fileRef = useRef()

  const PRESET_COLORS = ['#2563eb','#7c3aed','#db2777','#d97706','#059669','#16a34a','#dc2626','#0891b2']

  const loadFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => { setImg(e.target.result); setPreviewErr(false) }
    reader.readAsDataURL(file)
  }

  const handleFilePick = (e) => loadFile(e.target.files[0])
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); loadFile(e.dataTransfer.files[0]) }
  const handleSubmit = (e) => { e.preventDefault(); if (!name.trim()) return; onSave({ name: name.trim(), color, img }) }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        style={{ maxHeight: '92vh', overflowY: 'auto' }}>

        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-gray-900">
              {existing ? 'Edit Collection' : 'Create New Collection'}
            </h2>
            <p className="text-[13px] text-gray-400 mt-0.5">
              {existing ? 'Update name, colour or cover photo.' : 'Give it a name, colour and a cover photo.'}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer mt-0.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-5">
          {/* Cover */}
          <div>
            <label className="block text-[12px] font-bold text-gray-700 mb-2 uppercase tracking-wide">Cover Photo</label>
            <div className="flex items-center p-1 bg-gray-100 rounded-xl mb-3 w-fit gap-1">
              {[['upload','Upload Photo'],['presets','Choose Preset']].map(([t, lbl]) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer
                    ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {lbl}
                </button>
              ))}
            </div>

            {tab === 'upload' && (
              <div onClick={() => fileRef.current.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`relative w-full rounded-xl border-2 transition-all cursor-pointer overflow-hidden
                  ${dragOver ? 'border-blue-400 bg-blue-50' : img ? 'border-gray-200' : 'border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'}`}
                style={{ height: '160px' }}>
                {img && !previewErr ? (
                  <>
                    <img src={img} alt="cover" className="w-full h-full object-cover" onError={() => setPreviewErr(true)} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-3 py-1.5 bg-white/90 rounded-lg text-[12px] font-bold text-gray-800">📷 Change Photo</span>
                    </div>
                    <button type="button" onClick={e => { e.stopPropagation(); setImg(null); setPreviewErr(false) }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors cursor-pointer">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-2 select-none">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${dragOver ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <svg className={`w-6 h-6 transition-colors ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className={`text-[13px] font-semibold transition-colors ${dragOver ? 'text-blue-600' : 'text-gray-500'}`}>
                      {dragOver ? 'Drop to set as cover' : 'Click or drag a photo here'}
                    </p>
                    <p className="text-[11px] text-gray-400">PNG, JPG, WEBP — any size</p>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFilePick} />
              </div>
            )}

            {tab === 'presets' && (
              <div className="grid grid-cols-4 gap-2">
                {PRESET_COVERS.map(preset => (
                  <button key={preset.id} type="button" onClick={() => { setImg(preset.url); setPreviewErr(false) }}
                    className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-105
                      ${img === preset.url ? 'border-blue-500 ring-2 ring-blue-300' : 'border-transparent hover:border-gray-300'}`}
                    style={{ height: '70px' }}>
                    <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                    {img === preset.url && (
                      <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/40 py-0.5 text-center">
                      <span className="text-[9px] text-white font-semibold">{preset.label}</span>
                    </div>
                  </button>
                ))}
                <button type="button" onClick={() => setImg(null)}
                  className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-105 flex flex-col items-center justify-center gap-1
                    ${!img ? 'border-blue-500 ring-2 ring-blue-300 bg-blue-50' : 'border-dashed border-gray-300 hover:border-gray-400 bg-gray-50'}`}
                  style={{ height: '70px' }}>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <span className="text-[9px] text-gray-500 font-semibold">No Cover</span>
                </button>
              </div>
            )}

            {!img && (
              <p className="mt-2 text-[11px] text-gray-400">No cover selected — the card will show a colour background instead.</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-[12px] font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Collection Name</label>
            <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Mathematics, Work Notes…" maxLength={40}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-900
                         focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500
                         placeholder-gray-400 transition-all" />
          </div>

          {/* Colour */}
          <div>
            <label className="block text-[12px] font-bold text-gray-700 mb-2 uppercase tracking-wide">Accent Colour</label>
            <div className="flex items-center gap-2 flex-wrap">
              {['#2563eb','#7c3aed','#db2777','#d97706','#059669','#16a34a','#dc2626','#0891b2'].map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all cursor-pointer border-[3px] shadow-sm
                    ${color === c ? 'scale-125 border-white ring-2 ring-offset-1' : 'border-transparent hover:scale-110'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 py-2 bg-gray-50 border-b border-gray-100">Card Preview</p>
            <div className="flex items-center gap-3 p-3">
              <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100"
                style={{ background: img ? undefined : `${color}22` }}>
                {img
                  ? <img src={img} alt="preview" className="w-full h-full object-cover" onError={() => {}} />
                  : <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke={color} viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                      </svg>
                    </div>
                }
              </div>
              <div>
                <p className="text-[14px] font-bold text-gray-900">{name || 'Collection Name'}</p>
                <p className="text-[12px] text-gray-500">0 Notes</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                  <span className="text-[10px] text-gray-400">Accent colour</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim()}
              className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm hover:opacity-90 active:scale-95"
              style={{ background: color }}>
              {existing ? 'Save Changes' : 'Create Collection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Permanent delete confirm modal ────────────────────────────────────────── */
function DeleteModal({ name, onConfirm, onClose, permanent }) {
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
        <h3 className="text-[16px] font-bold text-gray-900 mb-1">
          {permanent ? `Permanently delete "${name}"?` : `Move "${name}" to Trash?`}
        </h3>
        <p className="text-[13px] text-gray-500 mb-5">
          {permanent
            ? 'This cannot be undone. Notes inside will not be deleted.'
            : 'You can restore it from Trash later. Notes inside won\'t be affected.'}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer">
            {permanent ? 'Delete Forever' : 'Move to Trash'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Collection card ───────────────────────────────────────────────────────── */
function CollectionCard({ col, onOpen, onEdit, onDelete, onToggleActive, onToggleFavorite }) {
  const [imgErr,   setImgErr]   = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer group"
      onClick={() => onOpen(col)}>

      {/* Cover */}
      <div className="relative" style={{ height: '180px' }}>
        {col.img && !imgErr ? (
          <img src={col.img} alt={col.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgErr(true)} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2"
            style={{ background: `${col.color}18` }}>
            <svg className="w-12 h-12" fill="none" stroke={col.color} viewBox="0 0 24 24" style={{ opacity: 0.45 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
            <span className="text-[11px] font-semibold" style={{ color: col.color, opacity: 0.6 }}>No cover</span>
          </div>
        )}

        {/* Favorite button — always visible when favorited, else on hover */}
        <button
          onClick={e => { e.stopPropagation(); onToggleFavorite(col.id) }}
          className={`absolute top-2.5 left-2.5 w-8 h-8 rounded-full flex items-center justify-center
            shadow border transition-all cursor-pointer
            ${col.favorited
              ? 'bg-white border-red-200 opacity-100'
              : 'bg-white/90 backdrop-blur-sm border-white/60 opacity-0 group-hover:opacity-100'}
            hover:scale-110`}
          title={col.favorited ? 'Remove from Favorites' : 'Add to Favorites'}>
          <HeartIcon filled={col.favorited} />
        </button>

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
              <div className="absolute top-10 right-0 z-20 bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-44 overflow-hidden">
                <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(col) }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit
                </button>
                <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onToggleFavorite(col.id) }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
                  <HeartIcon filled={col.favorited} />
                  {col.favorited ? 'Remove Favorite' : 'Add to Favorites'}
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
                  Move to Trash
                </button>
              </div>
            </>
          )}
        </div>

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
        <p className="text-[13px] text-gray-500 mb-2.5">{col.notes} Note{col.notes !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <ClockIcon />
          <span>Last updated {col.lastUpdated}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Trash card ────────────────────────────────────────────────────────────── */
function TrashCard({ col, onRestore, onDeleteForever }) {
  const [imgErr, setImgErr] = useState(false)
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm opacity-75 hover:opacity-100 transition-opacity group">
      <div className="relative" style={{ height: '160px' }}>
        {col.img && !imgErr ? (
          <img src={col.img} alt={col.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
            onError={() => setImgErr(true)} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: `${col.color}10` }}>
            <svg className="w-10 h-10" fill="none" stroke={col.color} viewBox="0 0 24 24" style={{ opacity: 0.3 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
          </div>
        )}
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        {/* Trash badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-red-100 rounded-full border border-red-200">
          <TrashIcon />
          <span className="text-[10px] text-red-500 font-bold">Trashed</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: col.color }} />
      </div>
      <div className="px-4 py-3">
        <h3 className="text-[14px] font-bold text-gray-700 truncate mb-1">{col.name}</h3>
        <p className="text-[12px] text-gray-400 mb-3">{col.notes} Note{col.notes !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <button onClick={() => onRestore(col.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-bold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer border border-blue-100">
            <RestoreIcon />
            Restore
          </button>
          <button onClick={() => onDeleteForever(col)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-bold rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors cursor-pointer border border-red-100">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
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
      <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 group-hover:border-blue-400 flex items-center justify-center transition-colors">
        <svg className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <p className="text-[14px] font-semibold text-gray-500 group-hover:text-blue-600 transition-colors">Add Collection</p>
    </button>
  )
}

/* ── Collection Detail ─────────────────────────────────────────────────────── */
const DETAIL_NOTES = [
  { id: 1, title: 'Chapter 1 — Algebra',     date: 'Added May 10, 2024', tags: ['#algebra', '#equations'], img: 'https://images.unsplash.com/photo-1509228627152-72ae9ae6848d?w=300&q=80' },
  { id: 2, title: 'Calculus Practice Set 3', date: 'Added May 8, 2024',  tags: ['#calculus'],              img: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=300&q=80' },
  { id: 3, title: 'Trigonometry Notes',       date: 'Modified 3d ago',    tags: ['#trig'],                  img: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=300&q=80' },
  { id: 4, title: 'Statistics Summary',       date: 'Added Apr 28, 2024', tags: ['#stats'],                 img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300&q=80' },
]

function CollectionDetail({ col, onBack, onGoToUpload }) {
  const [imgErrors, setImgErrors] = useState({})
  return (
    <div>
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
              <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded-full border border-blue-200 uppercase">Active</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        {[{ label:'Total Notes', value: col.notes, icon:'📄' },{ label:'Last Updated', value: col.lastUpdated, icon:'🕐' },{ label:'Status', value: col.active ? 'Active':'Inactive', icon:'📍' }].map(s => (
          <div key={s.label} className="flex-1 bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">{s.label}</p>
            <p className="text-[15px] font-bold text-gray-900">{s.icon} {s.value}</p>
          </div>
        ))}
        <button onClick={onGoToUpload}
          className="flex items-center gap-2 px-4 py-3 text-white text-[13px] font-bold rounded-xl shadow-sm transition-colors cursor-pointer flex-shrink-0 hover:opacity-90"
          style={{ background: col.color }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Add Notes
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {DETAIL_NOTES.map(note => (
          <div key={note.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group">
            <div style={{ height: '140px' }} className="overflow-hidden bg-gray-100">
              {!imgErrors[note.id]
                ? <img src={note.img} alt={note.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={() => setImgErrors(p => ({ ...p, [note.id]: true }))} />
                : <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
              }
            </div>
            <div className="px-3.5 pt-3 pb-3.5">
              <p className="text-[13px] font-bold text-gray-900 mb-1 line-clamp-1">{note.title}</p>
              <p className="text-[11px] text-gray-400 mb-2">{note.date}</p>
              <div className="flex flex-wrap gap-1">
                {note.tags.map(t => <span key={t} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-500 border border-gray-200">{t}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Empty state ───────────────────────────────────────────────────────────── */
function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <p className="text-[17px] font-bold text-gray-700 mb-1">{title}</p>
      <p className="text-[13px] text-gray-400 mb-4 max-w-xs">{subtitle}</p>
      {action}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════════════ */
export default function CollectionsPage({ onGoToNotes, onGoHome, onGoToUpload }) {
  const [collections,   setCollections]  = useState(INIT_COLLECTIONS)
  const [search,        setSearch]       = useState('')
  const [modal,         setModal]        = useState(null)
  const [deleteTarget,  setDeleteTarget] = useState(null)   // { col, permanent }
  const [openCol,       setOpenCol]      = useState(null)
  const [activeView,    setActiveView]   = useState('collections') // 'collections' | 'favorites' | 'trash'

  /* ── Computed ─────────────────────────────────────────────────────────────── */
  const active    = collections.filter(c => !c.trashed)
  const trashed   = collections.filter(c => c.trashed)
  const favorited = active.filter(c => c.favorited)

  const viewList = activeView === 'trash'
    ? trashed
    : activeView === 'favorites'
      ? favorited
      : active

  const filtered = search.trim()
    ? viewList.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : viewList

  /* ── Handlers ─────────────────────────────────────────────────────────────── */
  const handleCreate = useCallback(({ name, color, img }) => {
    setCollections(prev => [...prev, { id: Date.now(), name, color, img: img || null, notes: 0, lastUpdated: 'just now', active: false, favorited: false, trashed: false }])
    setModal(null)
  }, [])

  const handleEdit = useCallback(({ name, color, img }) => {
    setCollections(prev => prev.map(c => c.id === modal.col.id ? { ...c, name, color, img: img ?? null } : c))
    setModal(null)
  }, [modal])

  // Move to trash (soft delete)
  const handleMoveToTrash = useCallback(() => {
    setCollections(prev => prev.map(c => c.id === deleteTarget.col.id ? { ...c, trashed: true, favorited: false } : c))
    setDeleteTarget(null)
    if (openCol?.id === deleteTarget.col.id) setOpenCol(null)
  }, [deleteTarget, openCol])

  // Permanently delete
  const handleDeleteForever = useCallback(() => {
    setCollections(prev => prev.filter(c => c.id !== deleteTarget.col.id))
    setDeleteTarget(null)
  }, [deleteTarget])

  const handleRestore = useCallback((id) => {
    setCollections(prev => prev.map(c => c.id === id ? { ...c, trashed: false } : c))
  }, [])

  const handleToggleActive = useCallback(id => {
    setCollections(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c))
  }, [])

  const handleToggleFavorite = useCallback(id => {
    setCollections(prev => prev.map(c => c.id === id ? { ...c, favorited: !c.favorited } : c))
  }, [])

  /* ── Nav items (Settings removed) ─────────────────────────────────────────── */
  const NAV = [
    { key: 'notes',       label: 'My Notes',    icon: <MyNotesIcon />,                           onClick: onGoToNotes },
    { key: 'collections', label: 'Collections', icon: <CollectIcon active={activeView === 'collections'} />, onClick: () => { setActiveView('collections'); setOpenCol(null) } },
    { key: 'favorites',   label: 'Favorites',   icon: <FavoritesIcon filled={activeView === 'favorites'} />, onClick: () => { setActiveView('favorites'); setOpenCol(null) } },
    { key: 'trash',       label: 'Trash',        icon: <TrashIcon />,                             onClick: () => { setActiveView('trash'); setOpenCol(null) } },
  ]

  const viewLabels = {
    collections: { title: 'Collections',  subtitle: 'Organize your visual notes into logical folders.' },
    favorites:   { title: 'Favorites',    subtitle: 'Collections you\'ve starred for quick access.' },
    trash:       { title: 'Trash',        subtitle: 'Deleted collections. Restore or permanently remove them.' },
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white" style={{ fontFamily: 'Inter,system-ui,sans-serif' }}>

      {/* ══════════════════════════════════ SIDEBAR ══════════════════════════ */}
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
            const isActive = key === activeView || (key === 'notes' && false)
            const isNavActive = key === activeView
            return (
              <button key={key} onClick={onClick}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium w-full text-left cursor-pointer transition-all duration-150
                  ${isNavActive
                    ? key === 'trash'
                      ? 'bg-red-50 text-red-600 font-semibold'
                      : key === 'favorites'
                        ? 'bg-yellow-50 text-yellow-600 font-semibold'
                        : 'bg-blue-50 text-blue-600 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                <span className={
                  isNavActive
                    ? key === 'trash' ? 'text-red-500' : key === 'favorites' ? 'text-yellow-500' : 'text-blue-600'
                    : 'text-gray-400'
                }>{icon}</span>
                {label}
                {/* Badge for trash count */}
                {key === 'trash' && trashed.length > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {trashed.length}
                  </span>
                )}
                {/* Badge for favorites count */}
                {key === 'favorites' && favorited.length > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-yellow-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {favorited.length}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Upgrade card */}
        <div className="mx-3 mb-4 px-4 py-4 bg-blue-50 rounded-2xl border border-blue-100">
          <p className="text-[13px] font-bold text-gray-900 mb-1">Upgrade Plan</p>
          <p className="text-[11px] text-gray-500 mb-3 leading-snug">Get advanced OCR and unlimited storage.</p>
          <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-xl transition-colors cursor-pointer">
            Go Pro
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════ MAIN ═════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <div className="flex-1 relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${viewLabels[activeView].title.toLowerCase()}...`}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-full text-[13px] text-gray-700
                         placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30
                         focus:bg-white border border-transparent focus:border-blue-400/40 transition-all" />
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button className="relative w-9 h-9 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="text-right">
                <p className="text-[12px] font-bold text-gray-900 leading-none">Alex Rivera</p>
                <p className="text-[10px] text-gray-400 leading-none mt-0.5 uppercase tracking-wide">Free Plan</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-gray-200 border-2 border-gray-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 pt-7 pb-24">

            {/* Header row */}
            {!openCol && (
              <div className="flex items-start justify-between mb-7">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    {activeView === 'favorites' && <span className="text-2xl">⭐</span>}
                    {activeView === 'trash'     && <span className="text-2xl">🗑️</span>}
                    <h1 className="text-[32px] font-extrabold text-gray-900 leading-tight">
                      {viewLabels[activeView].title}
                    </h1>
                  </div>
                  <p className="text-[14px] text-gray-500 mt-1">{viewLabels[activeView].subtitle}</p>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  {/* Empty trash button */}
                  {activeView === 'trash' && trashed.length > 0 && (
                    <button
                      onClick={() => setCollections(prev => prev.filter(c => !c.trashed))}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-[13px] font-bold rounded-full border border-red-200 transition-colors cursor-pointer">
                      <TrashIcon />
                      Empty Trash
                    </button>
                  )}
                  {/* Create button only in collections view */}
                  {activeView === 'collections' && (
                    <button onClick={() => setModal('create')}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-full shadow transition-colors cursor-pointer flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      Create New Collection
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Detail view */}
            {openCol ? (
              <CollectionDetail col={openCol} onBack={() => setOpenCol(null)} onGoToUpload={onGoToUpload} />
            ) : activeView === 'trash' ? (
              /* ── Trash view ─────────────────────────────────────────────── */
              trashed.length === 0 ? (
                <EmptyState
                  icon="🗑️"
                  title="Trash is empty"
                  subtitle="Collections you delete will appear here. You can restore them or remove them forever."
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                  {filtered.map(col => (
                    <TrashCard
                      key={col.id}
                      col={col}
                      onRestore={handleRestore}
                      onDeleteForever={c => setDeleteTarget({ col: c, permanent: true })}
                    />
                  ))}
                </div>
              )
            ) : activeView === 'favorites' ? (
              /* ── Favorites view ─────────────────────────────────────────── */
              favorited.length === 0 ? (
                <EmptyState
                  icon="⭐"
                  title="No favorites yet"
                  subtitle="Click the heart icon on any collection card to add it here for quick access."
                  action={
                    <button onClick={() => setActiveView('collections')}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-full shadow transition-colors cursor-pointer">
                      Browse Collections
                    </button>
                  }
                />
              ) : (
                <>
                  {filtered.length === 0 && search && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <p className="text-base font-bold text-gray-600 mb-1">No favorites match "{search}"</p>
                      <button onClick={() => setSearch('')} className="text-sm font-semibold text-blue-600 hover:underline cursor-pointer mt-2">Clear search</button>
                    </div>
                  )}
                  {!(filtered.length === 0 && search) && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                      {filtered.map(col => (
                        <CollectionCard
                          key={col.id}
                          col={col}
                          onOpen={c => setOpenCol(c)}
                          onEdit={c => setModal({ col: c })}
                          onDelete={c => setDeleteTarget({ col: c, permanent: false })}
                          onToggleActive={handleToggleActive}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      ))}
                    </div>
                  )}
                </>
              )
            ) : (
              /* ── Collections view ───────────────────────────────────────── */
              <>
                {filtered.length === 0 && search && (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-base font-bold text-gray-600 mb-1">No collections match "{search}"</p>
                    <button onClick={() => setSearch('')} className="text-sm font-semibold text-blue-600 hover:underline cursor-pointer mt-2">Clear search</button>
                  </div>
                )}
                {!(filtered.length === 0 && search) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                    <AddCard onCreate={() => setModal('create')} />
                    {filtered.map(col => (
                      <CollectionCard
                        key={col.id}
                        col={col}
                        onOpen={c => setOpenCol(c)}
                        onEdit={c => setModal({ col: c })}
                        onDelete={c => setDeleteTarget({ col: c, permanent: false })}
                        onToggleActive={handleToggleActive}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* FAB — only in collections view */}
        {!openCol && activeView === 'collections' && (
          <button onClick={() => setModal('create')}
            className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full
                       shadow-xl flex items-center justify-center transition-all hover:scale-110 cursor-pointer z-40">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      {/* Modals */}
      {modal === 'create' && (
        <CollectionModal onSave={handleCreate} onClose={() => setModal(null)} />
      )}
      {modal && modal.col && (
        <CollectionModal existing={modal.col} onSave={handleEdit} onClose={() => setModal(null)} />
      )}
      {deleteTarget && (
        <DeleteModal
          name={deleteTarget.col.name}
          permanent={deleteTarget.permanent}
          onConfirm={deleteTarget.permanent ? handleDeleteForever : handleMoveToTrash}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
