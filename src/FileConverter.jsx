// FileConverter.jsx — iLoveIMG-style 2-column layout
// Left: thumbnail grid  |  Right: global options panel

import { useState, useCallback, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import { Zap, Shield, Smartphone, Globe } from 'lucide-react'
import {
  convertFile,
  NEEDS_ENGINE,
  getCategory, getDefaultOutput,
  loadFFmpeg, isFFmpegReady,
} from './conversionEngine.js'
import { useInstallPrompt, useFirstRun } from './hooks/usePWA.js'
import { useToasts } from './components/Toast.jsx'
import Layout from './components/Layout.jsx'
import DropZone from './components/DropZone.jsx'
import FileCard from './components/FileCard.jsx'
import OptionsPanel from './components/OptionsPanel.jsx'
import EngineBanner from './components/EngineBanner.jsx'
import FirstRunModal from './components/FirstRunModal.jsx'

function getOutputExt(fmt) { return fmt.toLowerCase() }

export default function FileConverter() {
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [isDropHovered, setIsDropHovered] = useState(false)
  const [engineState, setEngineState] = useState('idle')
  const [engineProgress, setEngineProgress] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  // Global format/quality/resize state
  const [lockedCategory, setLockedCategory] = useState(null)
  const [outputFormat, setOutputFormat] = useState('WEBP')
  const [quality, setQuality] = useState(85)
  const [resizeW, setResizeW] = useState('')
  const [resizeH, setResizeH] = useState('')

  const { toasts, addToast } = useToasts()
  const { isInstallable, isInstalled, install } = useInstallPrompt()
  const { isFirstRun, engineCached, dismiss: dismissFirst } = useFirstRun()

  useEffect(() => { if (isFFmpegReady()) setEngineState('ready') }, [])

  // When format changes, reset ready files back to idle
  const handleFormatChange = (fmt) => {
    setOutputFormat(fmt)
    setFiles(p => p.map(f => f.status === 'done' ? { ...f, status: 'idle', blob: null, progress: 0 } : f))
  }

  // File helpers
  const patchFile = (id, patch) =>
    setFiles(p => p.map(f => f.id === id ? { ...f, ...patch } : f))

  const addFiles = useCallback((list) => {
    const arr = Array.from(list)
    if (!arr.length) return

    // Determine category from first incoming file
    const firstCat = getCategory(arr[0].name)

    // If no files yet, lock to this category
    setLockedCategory(prev => {
      const activeCat = prev || firstCat

      const accepted = arr.filter(file => getCategory(file.name) === activeCat)
      const rejected = arr.length - accepted.length

      if (rejected > 0) {
        addToast(`${rejected} file(s) skipped — only ${activeCat} files accepted`, 'warning')
      }

      if (accepted.length === 0) return prev

      const entries = accepted.map(file => {
        const cat = getCategory(file.name)
        return {
          id: Math.random().toString(36).slice(2),
          file, category: cat,
          status: 'idle', progress: 0, blob: null,
          needsEngine: NEEDS_ENGINE.has(cat),
        }
      })

      // Set default output format when first files are added
      if (!prev) {
        const defaultFmt = getDefaultOutput(accepted[0].name)
        setOutputFormat(defaultFmt)
      }

      setFiles(p => [...p, ...entries])
      return activeCat
    })
  }, [addToast])

  const removeFile = id => {
    setFiles(p => {
      const next = p.filter(f => f.id !== id)
      if (next.length === 0) setLockedCategory(null)
      return next
    })
  }

  const clearAll = () => {
    setFiles([])
    setLockedCategory(null)
  }

  // Engine
  const handleInstallEngine = async () => {
    if (engineState === 'loading' || engineState === 'ready') return
    setEngineState('loading'); setEngineProgress(0)
    try {
      await loadFFmpeg(pct => setEngineProgress(pct))
      setEngineState('ready')
      setFiles(p => p.map(f => f.needsEngine ? { ...f, needsEngine: false } : f))
      addToast('Engine ready — audio, video & PDF unlocked!', 'success')
    } catch {
      setEngineState('error')
      addToast('Engine load failed. Check your connection.', 'error')
    }
  }

  // Convert all — uses global format, quality, resize
  const convertAll = async () => {
    const queue = files.filter(f => f.status === 'idle' && !f.needsEngine)
    if (!queue.length) return
    setIsRunning(true)
    for (const item of queue) {
      patchFile(item.id, { status: 'converting', progress: 0 })
      try {
        const blob = await convertFile(item.file, outputFormat, {
          quality,
          resizeW: resizeW ? Number(resizeW) : undefined,
          resizeH: resizeH ? Number(resizeH) : undefined,
          onProgress: pct => patchFile(item.id, { progress: pct }),
        })
        patchFile(item.id, { status: 'done', progress: 100, blob, outputFormat })
        addToast(`${item.file.name} converted ✓`, 'success')
      } catch (err) {
        console.error(err)
        patchFile(item.id, { status: 'error' })
        addToast(`Failed: ${item.file.name}`, 'error')
      }
    }
    setIsRunning(false)
  }

  // Download all done files as zip
  const handleDownloadAll = async () => {
    const done = files.filter(f => f.status === 'done' && f.blob)
    if (!done.length) return
    if (done.length === 1) {
      downloadFile(done[0])
      return
    }
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    done.forEach(item => {
      const base = item.file.name.replace(/\.[^.]+$/, '')
      zip.file(`${base}.${getOutputExt(item.outputFormat || outputFormat)}`, item.blob)
    })
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'converted_files.zip'; a.click()
    URL.revokeObjectURL(url)
    addToast(`${done.length} files zipped ✓`, 'success')
  }

  const downloadFile = item => {
    if (!item.blob) return
    const url = URL.createObjectURL(item.blob)
    const a = document.createElement('a')
    const base = item.file.name.replace(/\.[^.]+$/, '')
    a.href = url
    a.download = `${base}.${getOutputExt(item.outputFormat || outputFormat)}`
    a.click(); URL.revokeObjectURL(url)
  }

  // Derived
  const engineFiles = files.filter(f => f.needsEngine).length
  const readyCount  = files.filter(f => f.status === 'idle' && !f.needsEngine).length
  const doneCount   = files.filter(f => f.status === 'done').length

  const features = [
    { Icon: Shield,     color: '#2563EB', label: 'Zero uploads',   desc: 'Never touches a server'       },
    { Icon: Zap,        color: '#06B6D4', label: 'WebAssembly',    desc: 'ffmpeg compiled for browser'  },
    { Icon: Smartphone, color: '#A855F7', label: 'Works on mobile',desc: 'No app install needed'        },
    { Icon: Globe,      color: '#10B981', label: 'Works offline',  desc: 'After first engine load'      },
  ]

  const hasFiles = files.length > 0
  const isShifted = !hasFiles && (isDragging || isDropHovered)

  return (
    <Layout
      toasts={toasts}
      engineState={engineState}
      engineProgress={engineProgress}
      isInstallable={isInstallable}
      isInstalled={isInstalled}
      onInstall={async () => { const ok = await install(); if (ok) addToast('DevSuite installed! 🎉', 'success') }}
    >
      {/* First Run Modal */}
      {isFirstRun === true && (
        <FirstRunModal
          engineCached={engineCached}
          onComplete={({ engineInstalled }) => {
            if (engineInstalled) setEngineState('ready')
            dismissFirst()
          }}
        />
      )}

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
            label="30+ formats · HEIC · SVG · ICO · GIF"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ mb: 2, fontWeight: 500, fontSize: '0.75rem', height: 28, borderRadius: 99 }}
          />
          <Typography variant="h2" sx={{ mb: 1, fontWeight: 800 }}>
            Convert any file.{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(135deg, #2563EB, #06B6D4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Any format.
            </Box>
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            PNG, JPG, WEBP, GIF, PDF, MP4, MP3 and more — right in your browser.
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
          dropLabel={lockedCategory ? `Drop more ${lockedCategory} files` : 'Drop any files here'}
          dropSubtext="Images · Videos · Audio · PDFs — 30+ formats supported"
          browseSubtext="or drag and drop"
          onHoverChange={setIsDropHovered}
        />
      </Box>

      {/* ── Engine banner ──────────────────────────────────── */}
      {(engineFiles > 0 || engineState !== 'idle') && (
        <EngineBanner
          engineState={engineState}
          engineProgress={engineProgress}
          engineFiles={engineFiles}
          onInstall={handleInstallEngine}
        />
      )}

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
              isRunning={isRunning}
              onConvert={convertAll}
              onDownloadAll={handleDownloadAll}
              onClear={clearAll}
              totalCount={files.length}
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
              DevSuite — Privacy-first file processing. No files ever leave your device.
            </Typography>
          </Box>
        </>
      )}
    </Layout>
  )
}
