import { useState, useCallback, useRef } from 'react'
import ImageCard from './ImageCard.jsx'
import Lightbox  from './Lightbox.jsx'

const BADGE_STYLES = {
  filename_order:  'bg-purple-100 text-purple-600 border-purple-200',
  page_number:     'bg-app-success-bg text-app-success border-green-200',
  timestamp:       'bg-app-info-bg text-app-info border-blue-200',
  text_continuity: 'bg-app-warning-bg text-app-warning border-yellow-200',
  original_order:  'bg-app-bg text-app-text-muted border-app-border',
}

const BADGE_ICONS = {
  filename_order:  '🔢',
  page_number:     '📄',
  timestamp:       '🕐',
  text_continuity: '🔗',
  original_order:  '📋',
}

/* ── Drag-and-drop reorderable list ────────────────────────────────────────── */
function ReorderList({ images, onReorder, onRemove, onOpenLightbox }) {
  const dragIndexRef  = useRef(null)   // which row is being dragged
  const [dragOver, setDragOver] = useState(null) // which row is the drop target

  const handleDragStart = (e, idx) => {
    dragIndexRef.current = idx
    e.dataTransfer.effectAllowed = 'move'
    // Ghost image — tiny transparent pixel so native ghost doesn't show weirdly
    const ghost = document.createElement('div')
    ghost.style.cssText = 'position:fixed;top:-9999px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragIndexRef.current !== idx) setDragOver(idx)
  }

  const handleDrop = (e, idx) => {
    e.preventDefault()
    const from = dragIndexRef.current
    if (from === null || from === idx) { setDragOver(null); return }
    onReorder(from, idx)
    dragIndexRef.current = null
    setDragOver(null)
  }

  const handleDragEnd = () => {
    dragIndexRef.current = null
    setDragOver(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-app-border shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-app-border flex items-center justify-between">
        <h3 className="text-sm font-bold text-app-text">
          List View
          <span className="ml-2 text-app-text-muted font-normal">(Drag to Reorder)</span>
        </h3>
        <span className="text-xs text-app-text-muted">{images.length} pages</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-app-border">
        {images.map((img, idx) => (
          <div
            key={img.storedFilename || img.originalName || idx}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e)  => handleDragOver(e, idx)}
            onDrop={(e)      => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-4 px-5 py-3.5 transition-all duration-150 group select-none
              ${dragOver === idx
                ? 'bg-app-accent-light border-l-2 border-l-app-accent'
                : 'hover:bg-app-bg'}`}
          >
            {/* Drag handle */}
            <div className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-app-border transition-colors">
              <svg className="w-4 h-4 text-app-text-muted" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
              </svg>
            </div>

            {/* Thumbnail */}
            <div
              className="w-11 h-14 rounded-xl border border-app-border bg-app-bg flex-shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity shadow-card"
              onClick={() => onOpenLightbox(idx)}
            >
              {img.url ? (
                <img src={img.url} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-app-border" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-app-text">Page {idx + 1}</p>
              <p className="text-xs text-app-text-muted truncate">{img.originalName} · Modified just now</p>
            </div>

            {/* Remove */}
            <button
              onClick={() => onRemove(idx)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-app-text-muted
                         opacity-0 group-hover:opacity-100 hover:bg-app-error-bg hover:text-app-error
                         transition-all duration-150 cursor-pointer flex-shrink-0"
              aria-label="Remove"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function ResultsSection({ sortResults, onDownloadPDF, onSortAgain, targetCollection, onSaveToCollection }) {
  const { sortMethod, sortMethodDescription } = sortResults

  const [images,    setImages]    = useState(() => sortResults.images)
  const [lightbox,  setLightbox]  = useState({ open: false, index: 0 })
  const [activeTab, setActiveTab] = useState('gallery') // 'gallery' | 'reorder'
  const [savedToast, setSavedToast] = useState(false)

  /* ── Remove ──────────────────────────────────────────────────────────────── */
  const handleRemove = useCallback((targetIdx) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== targetIdx)
      return next.map((img, i) => ({ ...img, sortedIndex: i + 1 }))
    })
    setLightbox((lb) => {
      if (!lb.open) return lb
      if (targetIdx < lb.index) return { ...lb, index: lb.index - 1 }
      if (targetIdx === lb.index) return { open: false, index: 0 }
      return lb
    })
  }, [])

  /* ── Reorder (drag-and-drop) ─────────────────────────────────────────────── */
  const handleReorder = useCallback((fromIdx, toIdx) => {
    setImages((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next.map((img, i) => ({ ...img, sortedIndex: i + 1 }))
    })
    // Keep lightbox index in sync if open
    setLightbox((lb) => {
      if (!lb.open) return lb
      let newIdx = lb.index
      if (lb.index === fromIdx) newIdx = toIdx
      else if (fromIdx < lb.index && toIdx >= lb.index) newIdx = lb.index - 1
      else if (fromIdx > lb.index && toIdx <= lb.index) newIdx = lb.index + 1
      return { ...lb, index: newIdx }
    })
  }, [])

  /* ── Lightbox ─────────────────────────────────────────────────────────────── */
  const openLightbox  = useCallback((idx) => setLightbox({ open: true, index: idx }), [])
  const closeLightbox = useCallback(() => setLightbox((p) => ({ ...p, open: false })), [])
  const navLightbox   = useCallback((dir) => {
    setLightbox((p) => ({ ...p, index: (p.index + dir + images.length) % images.length }))
  }, [images.length])

  /* ── Save order ───────────────────────────────────────────────────────────── */
  const handleSaveOrder = useCallback(() => {
    onDownloadPDF()
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2500)
  }, [onDownloadPDF])

  const badgeClass = BADGE_STYLES[sortMethod] || BADGE_STYLES.original_order

  return (
    <section className="animate-fade-up">

      {/* ── Save to Collection banner ─────────────────────────────────────── */}
      {targetCollection && (
        <div className="flex items-center justify-between gap-4 mb-5 px-5 py-4 bg-blue-50 border border-blue-200 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-bold text-gray-900">
                Adding to <span className="text-blue-600">"{targetCollection.name}"</span>
              </p>
              <p className="text-[11px] text-gray-500">
                {images.length} page{images.length !== 1 ? 's' : ''} will be saved as notes in this collection.
              </p>
            </div>
          </div>
          <button
            onClick={() => onSaveToCollection(images)}
            disabled={images.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold
                       rounded-full shadow transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Save to Collection
          </button>
        </div>
      )}

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-app-accent rounded-xl flex items-center justify-center shadow-blue">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-app-text leading-none">Smart Notes</p>
            <p className="text-[10px] text-app-text-muted uppercase tracking-wide">Image Sorter</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onDownloadPDF}
            disabled={images.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-app-accent text-white text-sm font-semibold
                       rounded-full shadow-blue hover:bg-app-accent-h disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Download PDF
          </button>
          <button className="w-9 h-9 rounded-full border border-app-border bg-white flex items-center justify-center hover:bg-app-bg transition-colors cursor-pointer">
            <svg className="w-4 h-4 text-app-text-sec" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 border-b border-app-border mb-6">
        {[
          { key: 'gallery', label: 'Gallery View' },
          { key: 'reorder', label: 'Reorder Pages' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer
              ${activeTab === key
                ? 'border-app-accent text-app-accent'
                : 'border-transparent text-app-text-sec hover:text-app-text'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Page heading ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-app-text mb-1">Processed Pages</h2>
          <p className="text-app-text-sec text-sm">
            {images.length} handwritten note{images.length !== 1 ? 's' : ''} detected and organized.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wide ${badgeClass}`}>
            <span>{BADGE_ICONS[sortMethod] || '📋'}</span>
            {(sortMethod || 'original_order').replace(/_/g, ' ')}
          </span>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-app-border text-app-text-sec hover:bg-app-bg transition-colors cursor-pointer">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
            </svg>
            Sort
          </button>
          <button
            onClick={onSortAgain}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-app-error-bg border border-red-200 text-app-error hover:bg-red-100 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear All
          </button>
        </div>
      </div>

      {/* Sort description badge */}
      {sortMethodDescription && (
        <div className="mb-5 px-4 py-3 bg-app-accent-light rounded-xl border border-blue-200 text-sm text-app-text-sec">
          {sortMethodDescription}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────────── */}
      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-app-border shadow-card">
          <div className="w-16 h-16 bg-app-bg rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <p className="text-lg font-bold text-app-text mb-1">No images left</p>
          <p className="text-app-text-muted text-sm mb-6">You removed all images from the sorted list.</p>
          <button
            onClick={onSortAgain}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold
                       bg-app-accent text-white hover:bg-app-accent-h transition-colors shadow-blue cursor-pointer"
          >
            ↩ Start Over
          </button>
        </div>

      ) : activeTab === 'gallery' ? (
        /* ════════════════════════════════════════════════
           GALLERY VIEW  —  grid + list below (Figma exact)
           ════════════════════════════════════════════════ */
        <div className="flex flex-col gap-8">

          {/* Image grid */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
            {images.map((img, idx) => (
              <ImageCard
                key={img.storedFilename || img.originalName || idx}
                image={img}
                sortedIndex={idx + 1}
                onClick={() => openLightbox(idx)}
                onRemove={() => handleRemove(idx)}
              />
            ))}
          </div>

          {/* List view below gallery */}
          <div>
            <ReorderList
              images={images}
              onReorder={handleReorder}
              onRemove={handleRemove}
              onOpenLightbox={openLightbox}
            />
            <div className="flex justify-end mt-0 bg-white rounded-b-2xl border-x border-b border-app-border px-5 py-4">
              <button
                onClick={handleSaveOrder}
                disabled={images.length === 0}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                            transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                            ${savedToast
                              ? 'bg-app-success text-white border border-app-success'
                              : 'bg-app-accent-light text-app-accent border border-blue-200 hover:bg-app-accent hover:text-white'}`}
              >
                {savedToast ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save Order Configuration
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

      ) : (
        /* ════════════════════════════════════════════════
           REORDER PAGES  —  dedicated full drag-and-drop
           ════════════════════════════════════════════════ */
        <div className="flex flex-col gap-4">

          {/* Tip banner */}
          <div className="flex items-center gap-3 px-4 py-3 bg-app-accent-light rounded-xl border border-blue-200">
            <svg className="w-4 h-4 text-app-accent flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-app-text-sec">
              Drag the <strong className="text-app-text">⠿ handle</strong> on the left of each row to reorder pages. Changes apply instantly.
            </p>
          </div>

          {/* Reorder list */}
          <div className="bg-white rounded-2xl border border-app-border shadow-card overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-app-border flex items-center justify-between bg-app-bg">
              <h3 className="text-sm font-bold text-app-text flex items-center gap-2">
                <svg className="w-4 h-4 text-app-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Drag to Reorder Pages
              </h3>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-app-accent-light text-app-accent text-xs font-bold rounded-full border border-blue-200">
                  {images.length} pages
                </span>
              </div>
            </div>

            {/* Drag rows — larger thumbnails */}
            <DragReorderFull
              images={images}
              onReorder={handleReorder}
              onRemove={handleRemove}
              onOpenLightbox={openLightbox}
            />
          </div>

          {/* Save + start over */}
          <div className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-app-border shadow-card px-5 py-4">
            <button
              onClick={onSortAgain}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                         bg-white border border-app-border text-app-text-sec hover:bg-app-bg hover:text-app-text
                         transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Sort New Images
            </button>

            <button
              onClick={handleSaveOrder}
              disabled={images.length === 0}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                          transition-colors cursor-pointer shadow-blue disabled:opacity-40 disabled:cursor-not-allowed
                          ${savedToast
                            ? 'bg-app-success text-white'
                            : 'bg-app-accent text-white hover:bg-app-accent-h'}`}
            >
              {savedToast ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Order Saved!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </>
              )}
            </button>
          </div>

        </div>
      )}

      {/* ── Lightbox ─────────────────────────────────────────────────────────── */}
      {lightbox.open && images.length > 0 && (
        <Lightbox
          images={images}
          currentIndex={lightbox.index}
          onClose={closeLightbox}
          onPrev={() => navLightbox(-1)}
          onNext={() => navLightbox(1)}
        />
      )}

    </section>
  )
}

/* ── Full-width reorder rows (Reorder Pages tab) ────────────────────────────── */
function DragReorderFull({ images, onReorder, onRemove, onOpenLightbox }) {
  const dragIndexRef = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  const handleDragStart = (e, idx) => {
    dragIndexRef.current = idx
    e.dataTransfer.effectAllowed = 'move'
    const ghost = document.createElement('div')
    ghost.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragIndexRef.current !== idx) setDragOver(idx)
  }

  const handleDrop = (e, idx) => {
    e.preventDefault()
    const from = dragIndexRef.current
    if (from === null || from === idx) { setDragOver(null); return }
    onReorder(from, idx)
    dragIndexRef.current = null
    setDragOver(null)
  }

  const handleDragEnd = () => {
    dragIndexRef.current = null
    setDragOver(null)
  }

  return (
    <div className="divide-y divide-app-border">
      {images.map((img, idx) => (
        <div
          key={img.storedFilename || img.originalName || idx}
          draggable
          onDragStart={(e) => handleDragStart(e, idx)}
          onDragOver={(e)  => handleDragOver(e, idx)}
          onDrop={(e)      => handleDrop(e, idx)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-5 px-5 py-4 transition-all duration-150 group select-none
            ${dragOver === idx
              ? 'bg-app-accent-light border-l-4 border-l-app-accent scale-[1.01]'
              : 'hover:bg-app-bg border-l-4 border-l-transparent'}`}
        >
          {/* Page number badge */}
          <div className="w-8 h-8 rounded-lg bg-app-accent text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-blue">
            {idx + 1}
          </div>

          {/* Drag handle */}
          <div className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1.5 rounded-lg hover:bg-app-border transition-colors">
            <svg className="w-5 h-5 text-app-text-muted" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
            </svg>
          </div>

          {/* Large thumbnail */}
          <div
            className="w-14 h-18 rounded-xl border border-app-border bg-app-bg flex-shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity shadow-card"
            style={{ height: '4.5rem' }}
            onClick={() => onOpenLightbox(idx)}
          >
            {img.url ? (
              <img src={img.url} alt={`Page ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-5 h-5 text-app-border" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-app-text">Page {idx + 1}</p>
            <p className="text-sm text-app-text-muted truncate">{img.originalName}</p>
            {img.signals?.pageNumber && (
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-app-success-bg text-app-success border border-green-200">
                📄 Page {img.signals.pageNumber.value} detected
              </span>
            )}
          </div>

          {/* Drop indicator arrow */}
          {dragOver === idx && (
            <div className="flex-shrink-0 text-app-accent">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          )}

          {/* Remove */}
          <button
            onClick={() => onRemove(idx)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-app-text-muted
                       opacity-0 group-hover:opacity-100 hover:bg-app-error-bg hover:text-app-error
                       transition-all duration-150 cursor-pointer flex-shrink-0 border border-transparent hover:border-red-200"
            aria-label="Remove"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
