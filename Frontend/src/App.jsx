import { useState, useCallback, useRef } from 'react'
import LandingPage from './components/LandingPage.jsx'
import MyNotesPage from './components/MyNotesPage.jsx'
import CollectionsPage from './components/CollectionsPage.jsx'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import UploadSection from './components/UploadSection.jsx'
import ProcessingSection from './components/ProcessingSection.jsx'
import ResultsSection from './components/ResultsSection.jsx'
import Toast from './components/Toast.jsx'
import { uploadImages, processImagesWithProgress, getExportUrl } from './api.js'

const PROCESSING_STEPS = [
  { id: 'upload', label: 'Uploading images' },
  { id: 'ocr',    label: 'Running OCR (reading text)' },
  { id: 'detect', label: 'Detecting page numbers & signals' },
  { id: 'sort',   label: 'Sorting into correct order' },
]

export default function App() {
  const [step, setStep]               = useState('landing')
  const [files, setFiles]             = useState([])
  const [sessionId, setSessionId]     = useState(null)
  const [sortResults, setSortResults] = useState(null)
  const [phase, setPhase]             = useState(0)
  const [phaseLabel, setPhaseLabel]   = useState('Uploading files…')
  const [ocrProgress, setOcrProgress] = useState({ done: 0, total: 0 })
  const [error, setError]             = useState(null)
  const [toast, setToast]             = useState(null)
  // Which collection "Add Notes" was clicked from (null = not from a collection)
  const [targetCollection, setTargetCollection] = useState(null) // { id, name }
  const phaseTimerRef = useRef(null)

  /* ── Toast ─────────────────────────────────────────────── */
  const showToast = useCallback((message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3200)
  }, [])

  /* ── File selection ─────────────────────────────────────── */
  const handleFilesSelected = useCallback((selectedFiles) => {
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name))
      const fresh = selectedFiles.filter((f) => !existingNames.has(f.name))
      return [...prev, ...fresh].slice(0, 50)
    })
    setError(null)
  }, [])

  const handleClear = useCallback(() => {
    setFiles([])
    setError(null)
  }, [])

  /* ── Get Started ────────────────────────────────────────── */
  const handleGetStarted = useCallback(() => {
    setStep('upload')
  }, [])

  /* ── Sort ───────────────────────────────────────────────── */
  const handleSort = useCallback(async () => {
    if (files.length === 0) return
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current)
    setStep('processing')
    setPhase(0)
    setPhaseLabel('Uploading files…')
    setOcrProgress({ done: 0, total: 0 })
    setError(null)
    try {
      const uploadData = await uploadImages(files)
      const processData = await processImagesWithProgress(
        uploadData.sessionId,
        ({ done, total }) => { setOcrProgress({ done, total }); setPhase(1) },
        (newPhase, label) => { setPhase(newPhase); setPhaseLabel(label) }
      )
      setPhase(4)
      setSessionId(uploadData.sessionId)
      setSortResults(processData)
      phaseTimerRef.current = setTimeout(() => {
        setStep('results')
        showToast(`✅ Sorted ${processData.images.length} images successfully!`)
      }, 400)
    } catch (err) {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current)
      setStep('upload')
      setError(err.message || 'Something went wrong. Please try again.')
    }
  }, [files, showToast])

  /* ── Download PDF ───────────────────────────────────────── */
  const handleDownloadPDF = useCallback(() => {
    if (!sessionId) return
    const a = document.createElement('a')
    a.href = getExportUrl(sessionId)
    a.download = 'sorted-notes.pdf'
    a.click()
    showToast('📥 PDF download started!')
  }, [sessionId, showToast])

  /* ── Save processed notes into a collection or uncategorized ───────────── */
  const handleSaveNotes = useCallback((images) => {
    const now     = new Date()
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    const newNotes = images.map((img, idx) => ({
      id:    Date.now() + idx,
      title: img.originalName ? img.originalName.replace(/\.[^.]+$/, '') : `Page ${idx + 1}`,
      date:  `Added ${dateStr}`,
      tags:  ['#sorted'],
      img:   img.url || null,
    }))

    if (targetCollection) {
      // Save into specific collection
      try {
        const cols    = JSON.parse(localStorage.getItem('collections') || '[]')
        const updated = cols.map(c =>
          c.id === targetCollection.id
            ? { ...c, notesList: [...(c.notesList || []), ...newNotes], lastUpdated: 'just now' }
            : c
        )
        localStorage.setItem('collections', JSON.stringify(updated))
        showToast(`✅ ${newNotes.length} note${newNotes.length !== 1 ? 's' : ''} saved to "${targetCollection.name}"!`)
      } catch { showToast('❌ Could not save to collection.') }
      setTargetCollection(null)
      setStep('collections')
    } else {
      // Save as uncategorized
      try {
        const existing = JSON.parse(localStorage.getItem('uncategorized_notes') || '[]')
        localStorage.setItem('uncategorized_notes', JSON.stringify([...existing, ...newNotes]))
        showToast(`✅ ${newNotes.length} note${newNotes.length !== 1 ? 's' : ''} saved to My Notes!`)
      } catch { showToast('❌ Could not save notes.') }
      setStep('notes')
    }
  }, [targetCollection, showToast])

  /* ── Reset ──────────────────────────────────────────────── */
  const handleSortAgain = useCallback(() => {
    setStep('upload')
    setFiles([])
    setSessionId(null)
    setSortResults(null)
    setError(null)
    setPhase(0)
    setOcrProgress({ done: 0, total: 0 })
  }, [])

  /* ── Render ─────────────────────────────────────────────── */
  if (step === 'landing') {
    return (
      <>
        <LandingPage onGetStarted={handleGetStarted} />
        {toast && <Toast message={toast} />}
      </>
    )
  }

  if (step === 'notes') {
    return (
      <>
        <MyNotesPage
          onGoHome={() => setStep('landing')}
          onGoToUpload={() => setStep('upload')}
        />
        {toast && <Toast message={toast} />}
      </>
    )
  }

  if (step === 'collections') {
    return (
      <>
        <CollectionsPage
          onGoHome={() => setStep('landing')}
          onGoToNotes={() => setStep('notes')}
          onGoToUpload={(colId, colName) => {
            setTargetCollection(colId ? { id: colId, name: colName } : null)
            setStep('upload')
          }}
        />
        {toast && <Toast message={toast} />}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-app-bg text-app-text font-sans flex flex-col">
      <Header
        onLogoClick={() => setStep('landing')}
        onNavigate={(key) => setStep(key)}
        activeStep={step}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {step === 'upload' && (
          <UploadSection
            files={files}
            error={error}
            onFilesSelected={handleFilesSelected}
            onClear={handleClear}
            onSort={handleSort}
          />
        )}

        {step === 'processing' && (
          <ProcessingSection
            steps={PROCESSING_STEPS}
            phase={phase}
            phaseLabel={phaseLabel}
            ocrProgress={ocrProgress}
          />
        )}

        {step === 'results' && sortResults && (
          <ResultsSection
            sortResults={sortResults}
            onDownloadPDF={handleDownloadPDF}
            onSortAgain={handleSortAgain}
            targetCollection={targetCollection}
            onSaveNotes={handleSaveNotes}
          />
        )}
      </main>

      <Footer />
      {toast && <Toast message={toast} />}
    </div>
  )
}
