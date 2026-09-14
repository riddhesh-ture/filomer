// FileConverter.jsx — Clean, no-popup converter with auto-download
// Left: thumbnail grid  |  Right: global options panel

import { useState, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import { Zap, Smartphone, Globe, CloudOff } from 'lucide-react'
import {
  convertFile,
  getCategory, getDefaultOutput,
  MAX_FILE_SIZE, needsHeavyEngine,
  ACCEPT_STRING,
  imagesToPDF,
  mergePDFs,
  isAnimatedGIF,
} from './conversionEngine.js'
import { useInstallPrompt } from './hooks/usePWA.js'
import { useToasts } from './components/Toast.jsx'
import Layout from './components/Layout.jsx'
import DropZone from './components/DropZone.jsx'
import FileCard from './components/FileCard.jsx'
import OptionsPanel from './components/OptionsPanel.jsx'

function getOutputExt(fmt) { return fmt.toLowerCase() }

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default function FileConverter() {
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [isDropHovered, setIsDropHovered] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  // Global format/quality/resize state
  const [lockedCategory, setLockedCategory] = useState(null)
  const [outputFormat, setOutputFormat] = useState('WEBP')
  const [quality, setQuality] = useState(85)
  const [resizeW, setResizeW] = useState('')
  const [resizeH, setResizeH] = useState('')
  // Batch modes
  const [combineImages, setCombineImages] = useState(false)
  const [isMerging,     setIsMerging]     = useState(false)
  // Issue #5: run-cancellation counter — incremented by clearAll to stop stale downloads
  const runIdRef = useRef(0)

  const { toasts, addToast } = useToasts()
  const { isInstallable, isInstalled, install } = useInstallPrompt()

  // When format changes, reset ready files back to idle and turn off combine mode
  const handleFormatChange = (fmt) => {
    setOutputFormat(fmt)
    if (fmt !== 'PDF') setCombineImages(false)
    setFiles(p => p.map(f => f.status === 'done' ? { ...f, status: 'idle', blob: null, progress: 0 } : f))
  }

  // File helpers
  const patchFile = (id, patch) =>
    setFiles(p => p.map(f => f.id === id ? { ...f, ...patch } : f))

  const addFiles = useCallback((list) => {
    const arr = Array.from(list)
    if (!arr.length) return

    // BUG-0: read lockedCategory from the closure (not from a state updater) so
    // that setFiles is called *outside* the setLockedCategory updater, preventing
    // React 18 Strict Mode from double-invoking the updater and adding each file twice.
    //
    // Issue #2: anchor to the first *supported* file's category so that
    // unsupported files at the front of the selection don't lock the queue.
    const firstSupportedCat = arr
      .map(f => getCategory(f.name))
      .find(c => c !== 'unknown')

    const activeCat = lockedCategory || firstSupportedCat || 'unknown'

    // Filter by category, support, and size
    const accepted = []
    let catRejected = 0
    let sizeRejected = 0
    const unsupportedNames = []

    for (const file of arr) {
      const fileCat = getCategory(file.name)
      if (fileCat === 'unknown') {
        unsupportedNames.push(file.name)
        continue
      }
      if (fileCat !== activeCat) {
        catRejected++
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        sizeRejected++
        continue
      }
      accepted.push(file)
    }

    if (unsupportedNames.length > 0) {
      const names = unsupportedNames.length <= 3
        ? unsupportedNames.join(', ')
        : `${unsupportedNames.slice(0, 2).join(', ')} +${unsupportedNames.length - 2} more`
      addToast(`Unsupported format: ${names}`, 'error')
    }
    if (catRejected > 0) {
      addToast(`${catRejected} file(s) skipped — queue is locked to ${activeCat} files`, 'warning')
    }
    if (sizeRejected > 0) {
      addToast(`${sizeRejected} file(s) skipped — exceeds ${formatSize(MAX_FILE_SIZE)} limit`, 'warning')
    }

    if (accepted.length === 0) return

    const entries = accepted.map(file => {
      const cat = getCategory(file.name)
      return {
        id: Math.random().toString(36).slice(2),
        file, category: cat,
        status: 'idle', progress: 0, blob: null,
        isHeavy: needsHeavyEngine(cat),
      }
    })

    // BUG-29: only reset the format when this is the very first batch of files
    if (!lockedCategory) {
      const defaultFmt = getDefaultOutput(accepted[0].name)
      setOutputFormat(defaultFmt)
      setLockedCategory(activeCat)   // plain value set, NOT inside an updater
    }

    // All setFiles calls are now outside any other state updater — safe in Strict Mode
    setFiles(p => [...p, ...entries])

    // Issue #9: async animated-GIF detection — warn for any animated GIF
    arr
      .filter(f => f.name.toLowerCase().endsWith('.gif'))
      .forEach(async f => {
        if (await isAnimatedGIF(f)) {
          addToast(`“${f.name}” is animated — only the first frame will be exported`, 'warning')
        }
      })
  }, [addToast, lockedCategory])

  const removeFile = id => {
    setFiles(p => {
      const next = p.filter(f => f.id !== id)
      if (next.length === 0) setLockedCategory(null)
      return next
    })
  }

  // Issue #5: increment runIdRef to invalidate any in-progress convertAll loop
  const clearAll = () => {
    runIdRef.current++
    setFiles([])
    setLockedCategory(null)
    setCombineImages(false)
  }

  // Issue #3: reset all error-state files to idle so they re-enter the queue
  const retryFailed = () => {
    setFiles(p => p.map(f =>
      f.status === 'error' ? { ...f, status: 'idle', progress: 0, blob: null } : f
    ))
  }

  // Download helper — respects blob._actualExt (Fixes #3, #4) so
  // fallback WEBP blobs aren't saved as .avif/.gif and multi-page PDF
  // ZIPs aren't saved with an image extension.
  const downloadFile = (item) => {
    if (!item.blob) return
    const url = URL.createObjectURL(item.blob)
    const a = document.createElement('a')
    const base = item.file.name.replace(/\.[^.]+$/, '')
    // Use _actualExt if the engine signalled a format change (GIF→WEBP, AVIF→WEBP, PDF→ZIP)
    const finalExt = item.blob._actualExt || getOutputExt(item.outputFormat || outputFormat)
    a.href = url
    a.download = `${base}.${finalExt}`
    a.click()
    // BUG-14: delay revocation — revoke synchronously can race the browser's
    // download agent on Firefox / large files. 10 s is more than enough.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  // Convert all — auto-downloads each file when done
  const convertAll = async () => {
    const queue = files.filter(f => f.status === 'idle')
    if (!queue.length) return

    // Issue #6: snapshot settings NOW so that mid-run UI changes don't affect
    // the current batch. Each iteration uses these frozen values.
    const fmt  = outputFormat
    const qual = quality
    // BUG-9: clamp resize inputs — reject 0/negative, cap at 16384 px per side
    const clampDim = v => v ? Math.max(1, Math.min(16_384, Math.round(Number(v)))) : undefined
    const rw   = clampDim(resizeW)
    const rh   = clampDim(resizeH)

    // Issue #5: mark this run so clearAll can cancel it
    const runId = ++runIdRef.current
    setIsRunning(true)

    // Combine-mode: merge all images into a single PDF
    if (lockedCategory === 'image' && fmt === 'PDF' && combineImages && queue.length > 1) {
      queue.forEach(item => patchFile(item.id, { status: 'converting', progress: 0 }))
      try {
        const blob = await imagesToPDF(
          queue.map(item => item.file),
          pct => queue.forEach(item => patchFile(item.id, { status: 'converting', progress: pct }))
        )
        if (runIdRef.current !== runId) { setIsRunning(false); return }
        queue.forEach(item => patchFile(item.id, { status: 'done', progress: 100, blob, outputFormat: fmt }))
        addToast(`${queue.length} images combined into one PDF ✓`, 'success')
        const base = queue[0].file.name.replace(/\.[^.]+$/, '')
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href = url; a.download = `${base}_combined.pdf`; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      } catch (err) {
        console.error(err)
        queue.forEach(item => patchFile(item.id, { status: 'error' }))
        addToast('Failed to combine images into PDF', 'error')
      }
      setIsRunning(false)
      return
    }

    for (const item of queue) {
      // Issue #5: stop if the run was cancelled (user cleared the queue)
      if (runIdRef.current !== runId) break

      patchFile(item.id, {
        status: item.isHeavy ? 'preparing' : 'converting',
        progress: 0,
      })
      try {
        const blob = await convertFile(item.file, fmt, {
          quality:   qual,
          resizeW:   rw,
          resizeH:   rh,
          onProgress: pct => patchFile(item.id, { status: 'converting', progress: pct }),
          onEngineProgress: p => {
            if (!p.fromCache && p.percent < 100) {
              patchFile(item.id, {
                status: 'preparing',
                engineProgress: p.percent,
                engineLoaded: p.loaded,
                engineTotal: p.total,
              })
            }
          },
        })

        if (runIdRef.current !== runId) break  // cancelled while awaiting

        const doneItem = { ...item, status: 'done', progress: 100, blob, outputFormat: fmt }
        patchFile(item.id, { status: 'done', progress: 100, blob, outputFormat: fmt })
        if (blob._actualExt && blob._actualExt !== fmt.toLowerCase()) {
          addToast(`${item.file.name} saved as .${blob._actualExt} (browser limitation) ✓`, 'info')
        } else {
          addToast(`${item.file.name} converted ✓`, 'success')
        }
        downloadFile(doneItem)
      } catch (err) {
        if (runIdRef.current !== runId) break
        console.error(err)
        patchFile(item.id, { status: 'error' })
        // BUG-12: show the actual error message so the user knows what went wrong
        addToast(`Failed: ${item.file.name} — ${err.message}`, 'error')
      }
    }
    setIsRunning(false)
  }

  // Fix #6: merge all loaded PDFs into one
  const mergePDFsAll = async () => {
    const pdfFiles = files.filter(f => f.category === 'pdf')
    if (pdfFiles.length < 2) return
    setIsMerging(true)
    pdfFiles.forEach(item => patchFile(item.id, { status: 'converting', progress: 0 }))
    try {
      const blob = await mergePDFs(
        pdfFiles.map(item => item.file),
        pct => pdfFiles.forEach(item => patchFile(item.id, { status: 'converting', progress: pct }))
      )
      pdfFiles.forEach(item => patchFile(item.id, { status: 'done', progress: 100, blob, outputFormat: 'PDF' }))
      addToast(`${pdfFiles.length} PDFs merged ✓`, 'success')
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href = url; a.download = 'merged.pdf'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (err) {
      console.error(err)
      pdfFiles.forEach(item => patchFile(item.id, { status: 'error' }))
      addToast('Failed to merge PDFs', 'error')
    }
    setIsMerging(false)
  }

  // Download all done files
  // BUG-D: blobs that are already ZIPs (multi-page PDF results) must not be
  // nested inside another ZIP — download them individually instead.
  // BUG-15: deduplicate filenames to prevent JSZip last-write-wins collisions.
  const handleDownloadAll = async () => {
    const done = files.filter(f => f.status === 'done' && f.blob)
    if (!done.length) return
    if (done.length === 1) { downloadFile(done[0]); return }

    // Separate already-ZIP items from regular blobs
    const alreadyZip  = done.filter(item => item.blob._actualExt === 'zip')
    const regularDone = done.filter(item => item.blob._actualExt !== 'zip')

    // Download each already-ZIP item directly (no double-nesting)
    alreadyZip.forEach(item => downloadFile(item))

    if (regularDone.length === 0) return
    if (regularDone.length === 1) { downloadFile(regularDone[0]); return }

    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    // BUG-15: track seen filenames and append a counter to avoid collisions
    const seenNames = new Map()
    regularDone.forEach(item => {
      const base = item.file.name.replace(/\.[^.]+$/, '')
      const finalExt = item.blob._actualExt || getOutputExt(item.outputFormat || outputFormat)
      let filename = `${base}.${finalExt}`
      const count = seenNames.get(filename) || 0
      seenNames.set(filename, count + 1)
      if (count > 0) filename = `${base} (${count}).${finalExt}`
      zip.file(filename, item.blob)
    })
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'converted_files.zip'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    addToast(`${regularDone.length} files zipped ✓`, 'success')
  }

  // Derived
  const readyCount  = files.filter(f => f.status === 'idle').length
  const doneCount   = files.filter(f => f.status === 'done').length
  const errorCount  = files.filter(f => f.status === 'error').length

  const features = [
    { Icon: Zap,        color: '#06B6D4', label: 'Instant',         desc: 'Images convert in milliseconds' },
    { Icon: CloudOff,   color: '#2563EB', label: '100% local',      desc: 'Files never leave your device'  },
    { Icon: Smartphone, color: '#A855F7', label: 'Works on mobile', desc: 'No app install needed'          },
    { Icon: Globe,      color: '#10B981', label: 'Works offline',   desc: 'Install as app for offline use' },
  ]

  const hasFiles = files.length > 0
  const isShifted = !hasFiles && (isDragging || isDropHovered)

  return (
    <Layout
      toasts={toasts}
      isInstallable={isInstallable}
      isInstalled={isInstalled}
      onInstall={async () => { const ok = await install(); if (ok) addToast('Filomer installed! 🎉', 'success') }}
    >
      {/* ── Compact hero (empty state only) ─────────── */}
      {!hasFiles && (
        <Box
          sx={{
            textAlign: 'center',
            pt: { xs: 3, md: 5 },
            pb: 2,
            animation: 'fadeInUp 0.5s ease',
          }}
        >
          <Chip
            label="Images · Videos · Audio · PDFs — 30+ formats · HEIC · SVG · ICO"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ mb: 2, fontWeight: 500, fontSize: '0.75rem', height: 28, borderRadius: 99 }}
          />
          <Typography variant="h2" sx={{ mb: 1, fontWeight: 800 }}>
            Convert your files.{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(135deg, #2563EB, #06B6D4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              30+ formats.
            </Box>
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Images, SVG, HEIC, PDF, video and audio — right in your browser. No upload, no account.
          </Typography>
        </Box>
      )}

      {/* ── Drop zone ──────────────────────────────── */}
      <Box sx={{ animation: 'fadeInUp 0.6s ease 0.2s both', mb: hasFiles ? 0 : 3 }}>
        <DropZone
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          onFiles={addFiles}
          fileCount={files.length}
          doneCount={doneCount}
          dropLabel={lockedCategory ? `Drop more ${lockedCategory} files` : 'Drop files here'}
          dropSubtext={`Images · Videos · Audio · PDFs · SVG · HEIC — ${formatSize(MAX_FILE_SIZE)} max per file`}
          browseSubtext="or drag and drop"
          onHoverChange={setIsDropHovered}
          acceptTypes={ACCEPT_STRING}
        />
      </Box>

      {/* ── Main content: 2-column when files loaded ──────── */}
      {hasFiles ? (
        <Grid container spacing={3} sx={{ mt: 0 }}>
          {/* Left: thumbnail grid */}
          <Grid size={{ xs: 12, md: 9 }}>
            <Grid container spacing={2} sx={{ px: 1 }}>
              {files.map((item, i) => (
                <Grid key={item.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                  <FileCard
                    item={item}
                    index={i}
                    onRemove={() => removeFile(item.id)}
                    onDownload={() => downloadFile(item)}
                    onRetry={() => patchFile(item.id, { status: 'idle', progress: 0, blob: null })}
                  />
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Right: options panel */}
          <Grid size={{ xs: 12, md: 3 }}>
            <OptionsPanel
              category={lockedCategory || 'image'}
              outputFormat={outputFormat}
              onFormatChange={handleFormatChange}
              quality={quality}
              onQualityChange={setQuality}
              resizeW={resizeW}
              resizeH={resizeH}
              onResizeChange={(dim, val) => dim === 'w' ? setResizeW(val) : setResizeH(val)}
              readyCount={readyCount}
              doneCount={doneCount}
              errorCount={errorCount}
              isRunning={isRunning}
              onConvert={convertAll}
              onDownloadAll={handleDownloadAll}
              onClear={clearAll}
              onRetryFailed={retryFailed}
              totalCount={files.length}
              isInstallable={isInstallable}
              isInstalled={isInstalled}
              onInstall={install}
              combineImages={combineImages}
              onCombineImages={setCombineImages}
              isMerging={isMerging}
              onMergePDFs={mergePDFsAll}
            />
          </Grid>
        </Grid>
      ) : (
        /* ── Empty state: hero + feature cards ─────────── */
        <>

          <Grid
            container
            spacing={2}
            className={`features-shift${isShifted ? ' shifted' : ''}`}
            sx={{ mt: 2, animation: 'fadeInUp 0.6s ease 0.3s both' }}
          >
            {features.map(({ Icon, color, label, desc }) => (
              <Grid key={label} size={{ xs: 6, md: 3 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    transition: 'box-shadow 0.2s, border-color 0.2s',
                    '&:hover': {
                      borderColor: `${color}60`,
                      boxShadow: `0 6px 20px ${color}18`,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 48, height: 48, borderRadius: 3,
                      bgcolor: `${color}10`,
                      border: `1px solid ${color}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      mx: 'auto', mb: 2,
                    }}
                  >
                    <Icon size={22} color={color} strokeWidth={1.5} />
                  </Box>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>{label}</Typography>
                  <Typography variant="caption" color="text.secondary">{desc}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ textAlign: 'center', mt: 8, mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Filomer — Privacy-first file processing. No files ever leave your device.
            </Typography>
          </Box>
        </>
      )}
    </Layout>
  )
}
