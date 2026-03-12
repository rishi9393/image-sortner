import { useState, useCallback, useRef } from 'react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import UploadSection from './components/UploadSection.jsx'
import ProcessingSection from './components/ProcessingSection.jsx'
import ResultsSection from './components/ResultsSection.jsx'
import Lightbox from './components/Lightbox.jsx'
import Toast from './components/Toast.jsx'
import { uploadImages, processImages, getExportUrl } from './api.js'

const PROCESSING_STEPS = [
  { id: 'upload', label: 'Uploading images' },
  { id: 'ocr',    label: 'Running OCR (reading text)' },
  { id: 'detect', label: 'Detecting page numbers & signals' },
  { id: 'sort',   label: 'Sorting into correct order' },
]

// phase: 0=upload active, 1=ocr active, 2=detect active, 3=sort active, 4=all done
// step with index < phase is 'done', index === phase is 'active', > phase is 'pending'

export default function App() {
  const [step, setStep]           = useState('upload')  // 'upload' | 'processing' | 'results'
  const [files, setFiles]         = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [sortResults, setSortResults] = useState(null)
  const [phase, setPhase]         = useState(0)
  const [phaseLabel, setPhaseLabel] = useState('Uploading files…')
  const [error, setError]         = useState(null)
  const [toast, setToast]         = useState(null)
  const [lightbox, setLightbox]   = useState({ open: false, index: 0 })
  const timersRef = useRef([])

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

  /* ── Sort ───────────────────────────────────────────────── */
  const handleSort = useCallback(async () => {
    if (files.length === 0) return

    // clear previous timers
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    setStep('processing')
    setPhase(0)
    setPhaseLabel('Uploading files…')
    setError(null)

    try {
      // ── Step 0: Upload ──────────────────────────────────
      const uploadResult = await uploadImages(files)

      // ── Step 1: OCR (while process API runs) ───────────
      setPhase(1)
      setPhaseLabel('Running OCR on each image…')

      // Schedule fake step advances for user feedback
      timersRef.current.push(
        setTimeout(() => {
          setPhase(2)
          setPhaseLabel('Detecting page numbers & signals…')
        }, 2500),
        setTimeout(() => {
          setPhase(3)
          setPhaseLabel('Sorting into correct order…')
        }, 5000),
      )

      // ── Process API ─────────────────────────────────────
      const processResult = await processImages(uploadResult.sessionId)

      // Clear timers & mark all done
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []

      setPhase(4)
      setSessionId(uploadResult.sessionId)
      setSortResults(processResult)

      setTimeout(() => {
        setStep('results')
        showToast(`✨ Sorted ${processResult.images.length} images successfully!`)
      }, 500)
    } catch (err) {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
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

  /* ── Reset ──────────────────────────────────────────────── */
  const handleSortAgain = useCallback(() => {
    setStep('upload')
    setFiles([])
    setSessionId(null)
    setSortResults(null)
    setError(null)
    setPhase(0)
  }, [])

  /* ── Lightbox ───────────────────────────────────────────── */
  const handleOpenLightbox  = useCallback((index) => setLightbox({ open: true, index }), [])
  const handleCloseLightbox = useCallback(() => setLightbox((p) => ({ ...p, open: false })), [])
  const handleLightboxNav   = useCallback((dir) => {
    if (!sortResults) return
    setLightbox((p) => ({
      ...p,
      index: (p.index + dir + sortResults.images.length) % sortResults.images.length,
    }))
  }, [sortResults])

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-app-bg text-app-text font-sans flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10">
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
          />
        )}

        {step === 'results' && sortResults && (
          <ResultsSection
            sortResults={sortResults}
            onDownloadPDF={handleDownloadPDF}
            onSortAgain={handleSortAgain}
            onOpenLightbox={handleOpenLightbox}
          />
        )}
      </main>

      <Footer />

      {lightbox.open && sortResults && (
        <Lightbox
          images={sortResults.images}
          currentIndex={lightbox.index}
          onClose={handleCloseLightbox}
          onPrev={() => handleLightboxNav(-1)}
          onNext={() => handleLightboxNav(1)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  )
}
