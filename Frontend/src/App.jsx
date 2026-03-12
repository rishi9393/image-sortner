import { useState, useCallback, useRef } from 'react'
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
  const [step, setStep]               = useState('upload')
  const [files, setFiles]             = useState([])
  const [sessionId, setSessionId]     = useState(null)
  const [sortResults, setSortResults] = useState(null)
  const [phase, setPhase]             = useState(0)
  const [phaseLabel, setPhaseLabel]   = useState('Uploading files…')
  const [ocrProgress, setOcrProgress] = useState({ done: 0, total: 0 })
  const [error, setError]             = useState(null)
  const [toast, setToast]             = useState(null)
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
      // ── Step 0: Upload ──────────────────────────────────
      const uploadData = await uploadImages(files)

      // ── Steps 1-3: OCR + Detect + Sort via SSE ─────────
      // Phase transitions and per-image progress are driven by real
      // server events — no fake setTimeout needed.
      const processData = await processImagesWithProgress(
        uploadData.sessionId,
        // onProgress: real per-image updates from the server
        ({ done, total, filename }) => {
          setOcrProgress({ done, total })
          setPhase(1)
        },
        // onPhase: server tells us when to advance the step indicator
        (newPhase, label) => {
          setPhase(newPhase)
          setPhaseLabel(label)
        }
      )

      setPhase(4)
      setSessionId(uploadData.sessionId)
      setSortResults(processData)

      phaseTimerRef.current = setTimeout(() => {
        setStep('results')
        showToast(`✨ Sorted ${processData.images.length} images successfully!`)
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
            ocrProgress={ocrProgress}
          />
        )}

        {step === 'results' && sortResults && (
          <ResultsSection
            sortResults={sortResults}
            onDownloadPDF={handleDownloadPDF}
            onSortAgain={handleSortAgain}
          />
        )}
      </main>

      <Footer />

      {toast && <Toast message={toast} />}
    </div>
  )
}
