import { useState, useCallback, useRef } from 'react'
import LandingPage from './components/LandingPage.jsx'
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
  const [step, setStep]               = useState('landing')  // 'landing' | 'upload' | 'processing' | 'results'
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

  /* ── Get Started (landing → upload) ────────────────────── */
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
        ({ done, total }) => {
          setOcrProgress({ done, total })
          setPhase(1)
        },
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

  // Landing page is a standalone full-page (own nav + footer)
  if (step === 'landing') {
    return (
      <>
        <LandingPage onGetStarted={handleGetStarted} />
        {toast && <Toast message={toast} />}
      </>
    )
  }

  // App shell (upload / processing / results)
  return (
    <div className="min-h-screen bg-app-bg text-app-text font-sans flex flex-col">
      <Header onLogoClick={() => setStep('landing')} />

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
          />
        )}
      </main>

      <Footer />

      {toast && <Toast message={toast} />}
    </div>
  )
}
