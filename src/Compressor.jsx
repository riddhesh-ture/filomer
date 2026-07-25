// ══════════════════════════════════════════════════════════════
//  DevSuite — Compressor.jsx (MUI v9 — no popups, auto-download)
//
//  Layout restructured to match FileConverter:
//  Hero → DropZone (main component) → Target Panel → Features
// ══════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { Target, RefreshCw, Download, Crosshair, Lock, Zap, Ruler } from 'lucide-react'
import { compressToTarget, getCategory } from './compressionEngine.js'
import { MAX_FILE_SIZE } from './conversionEngine.js'
import { useInstallPrompt } from './hooks/usePWA.js'
import { useToasts } from './components/Toast.jsx'
import Layout from './components/Layout.jsx'
import DropZone from './components/DropZone.jsx'
import CompressCard from './components/CompressCard.jsx'
import ActionBar from './components/ActionBar.jsx'

// ─── PRESETS ──────────────────────────────────────────────────
const PRESETS = [
  { label: 'WhatsApp', mb: 16, emoji: '💬', desc: 'Media limit' },
  { label: 'Email', mb: 25, emoji: '📧', desc: 'Attachment' },
  { label: 'Govt form', mb: 5, emoji: '🏛️', desc: 'Portal limit' },
  { label: 'College', mb: 2, emoji: '🎓', desc: 'Submission' },
  { label: '1 MB', mb: 1, emoji: '📦', desc: 'Tight limit' },
]

const MODES = [
  { id: 'smart', label: 'Smart', desc: 'Best quality that hits the target' },
  { id: 'lossless', label: 'Lossless', desc: 'No quality loss — may not hit target' },
  { id: 'aggressive', label: 'Aggressive', desc: 'Maximum compression, lowest quality' },
]

// ─── Feature cards (icons, matching converter style) ──────────
const FEATURES = [
  { Icon: Crosshair, color: '#10B981', label: 'Binary search', desc: 'Finds exact quality to hit target' },
  { Icon: Lock,      color: '#2563EB', label: '100% local',    desc: 'Files never leave your device' },
  { Icon: Zap,       color: '#06B6D4', label: 'All file types', desc: 'Image, video, audio, PDF' },
  { Icon: Ruler,     color: '#A855F7', label: 'Custom limits', desc: 'Set any size you need' },
]

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ─── MAIN ─────────────────────────────────────────────────────
export default function Compressor() {
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [isDropHovered, setIsDropHovered] = useState(false)
  const [targetMB, setTargetMB] = useState(5)
  const [customMB, setCustomMB] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [mode, setMode] = useState('smart')
  const [isRunning, setIsRunning] = useState(false)

  const { toasts, addToast } = useToasts()
  const { isInstallable, isInstalled, install } = useInstallPrompt()

  const effectiveTargetMB = useCustom && customMB ? parseFloat(customMB) : targetMB
  const effectiveTargetBytes = effectiveTargetMB * 1024 * 1024

  // ── file helpers ────────────────────────────────────────────
  const patchFile = (id, patch) =>
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))

  const addFiles = useCallback(list => {
    const arr = Array.from(list)
    const accepted = []
    let sizeRejected = 0

    for (const file of arr) {
      if (file.size > MAX_FILE_SIZE) {
        sizeRejected++
        continue
      }
      accepted.push(file)
    }

    if (sizeRejected > 0) {
      addToast(`${sizeRejected} file(s) skipped — exceeds ${formatSize(MAX_FILE_SIZE)} limit`, 'warning')
    }

    const entries = accepted.map(file => {
      const cat = getCategory(file)
      return {
        id: Math.random().toString(36).slice(2),
        file, category: cat,
        originalSize: file.size,
        finalSize: null,
        targetBytes: effectiveTargetBytes,
        status: 'idle',
        progress: 0,
        blob: null,
        note: undefined,
        warning: undefined,
      }
    })
    if (entries.length > 0) setFiles(prev => [...prev, ...entries])
  }, [effectiveTargetBytes, addToast])

  const removeFile = id => setFiles(prev => prev.filter(f => f.id !== id))
  const clearAll = () => setFiles([])

  // ── download helper ─────────────────────────────────────────
  const downloadFile = item => {
    if (!item.blob) return
    const url = URL.createObjectURL(item.blob)
    const a = document.createElement('a')
    const base = item.file.name.replace(/\.[^.]+$/, '')
    const ext = item.category === 'image' ? 'webp'
      : item.category === 'audio' ? 'mp3'
        : item.category === 'video' ? 'mp4'
          : item.category === 'pdf' ? 'pdf'
            : item.file.name.split('.').pop()
    a.href = url
    a.download = `${base}_compressed.${ext}`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── compress — auto-downloads each file ─────────────────────
  const compressAll = async () => {
    if (isRunning) return
    setIsRunning(true)
    const queue = files.filter(f => f.status === 'idle')

    for (const item of queue) {
      patchFile(item.id, { status: 'compressing', progress: 0, targetBytes: effectiveTargetBytes })
      try {
        const result = await compressToTarget(
          item.file,
          effectiveTargetBytes,
          mode,
          pct => patchFile(item.id, { progress: pct }),
        )
        const doneItem = {
          ...item,
          status: 'done',
          progress: 100,
          blob: result.blob,
          finalSize: result.finalSize,
          note: result.note,
          warning: result.warning,
        }
        patchFile(item.id, {
          status: 'done',
          progress: 100,
          blob: result.blob,
          finalSize: result.finalSize,
          note: result.note,
          warning: result.warning,
        })
        if (!result.warning) addToast(`${item.file.name} compressed ✓`, 'success')
        else addToast(`${item.file.name} — ${result.warning}`, 'warn')

        // Auto-download immediately
        downloadFile(doneItem)
      } catch (err) {
        patchFile(item.id, { status: 'error' })
        addToast(`Failed: ${item.file.name}`, 'error')
      }
    }
    setIsRunning(false)
  }

  const downloadAll = () =>
    files.filter(f => f.status === 'done').forEach(downloadFile)

  // ── derived ─────────────────────────────────────────────────
  const readyCount = files.filter(f => f.status === 'idle').length
  const doneCount = files.filter(f => f.status === 'done').length
  const hasFiles = files.length > 0
  const isShifted = !hasFiles && (isDragging || isDropHovered)

  return (
    <Layout
      toasts={toasts}
      isInstallable={isInstallable}
      isInstalled={isInstalled}
      onInstall={async () => { const ok = await install(); if (ok) addToast('DevSuite installed! 🎉', 'success') }}
    >
      {/* ── Hero (matches converter layout) ──────────────────── */}
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
            label="smart binary search · target-aware"
            size="small"
            color="success"
            variant="outlined"
            sx={{ mb: 2, fontWeight: 500, fontSize: '0.75rem', height: 28, borderRadius: 99 }}
          />
          <Typography variant="h2" sx={{ mb: 1, fontWeight: 800 }}>
            Compress any file.{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(135deg, #10B981, #06B6D4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Any size limit.
            </Box>
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Set a target size — DevSuite hits it. Govt portals, college uploads, email attachments.
          </Typography>
        </Box>
      )}

      {/* ── Drop zone (main hero component, same position as converter) ── */}
      <Box sx={{ animation: 'fadeInUp 0.6s ease 0.2s both', mb: hasFiles ? 0 : 3 }}>
        <DropZone
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          onFiles={addFiles}
          fileCount={files.length}
          doneCount={doneCount}
          variant="green"
          dropLabel={isDragging ? `Drop to compress to ${effectiveTargetMB} MB` : 'Drop files to compress'}
          dropSubtext={
            <>Target: <strong style={{ color: '#10B981' }}>{effectiveTargetMB} MB</strong> · Mode: <strong>{mode}</strong> · {formatSize(MAX_FILE_SIZE)} max</>
          }
          browseSubtext="or drag and drop"
          onHoverChange={setIsDropHovered}
        >
          {/* Action buttons shown in compact mode */}
          {readyCount > 0 && !isRunning && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<Target size={14} />}
              onClick={compressAll}
            >
              Compress {readyCount}
            </Button>
          )}
          {isRunning && (
            <Button
              variant="contained"
              color="success"
              size="small"
              disabled
              startIcon={<RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            >
              Running…
            </Button>
          )}
          {doneCount > 1 && (
            <Button variant="outlined" color="success" size="small" onClick={downloadAll}>
              Save all ({doneCount})
            </Button>
          )}
          <Button variant="text" size="small" onClick={clearAll} sx={{ color: 'text.secondary' }}>
            Clear
          </Button>
        </DropZone>
      </Box>

      {/* ── Target size panel (below drop zone) ──────────────── */}
      <Paper
        variant="outlined"
        className={`features-shift${isShifted ? ' shifted' : ''}`}
        sx={{
          p: { xs: 2.5, md: 3 },
          mb: 3,
          borderRadius: 4,
          animation: 'fadeInUp 0.6s ease 0.3s both',
        }}
      >
        {/* Number display */}
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ mb: 0.5, display: 'block' }}
          >
            Target Size Limit
          </Typography>
          <Typography
            sx={{
              fontSize: 'clamp(2rem, 6vw, 3.5rem)',
              fontWeight: 800,
              lineHeight: 1,
              background: 'linear-gradient(135deg, #10B981, #06B6D4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {useCustom && customMB ? parseFloat(customMB).toFixed(1) : effectiveTargetMB.toFixed(0)}
            <Box
              component="span"
              sx={{
                fontSize: '1.5rem',
                fontWeight: 600,
                ml: 0.5,
                WebkitTextFillColor: 'initial',
                color: 'text.secondary',
              }}
            >
              MB
            </Box>
          </Typography>
        </Box>

        {/* Preset chips */}
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          justifyContent="center"
          useFlexGap
          sx={{ mb: 3 }}
        >
          {PRESETS.map(p => (
            <Chip
              key={p.label}
              label={`${p.emoji} ${p.label} · ${p.mb} MB`}
              variant={!useCustom && targetMB === p.mb ? 'filled' : 'outlined'}
              color={!useCustom && targetMB === p.mb ? 'success' : 'default'}
              onClick={() => { setTargetMB(p.mb); setUseCustom(false) }}
              sx={{
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.8125rem',
                height: 36,
                borderRadius: 99,
                px: 1,
              }}
            />
          ))}
          {/* Custom input */}
          <Paper
            variant="outlined"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              height: 36,
              borderRadius: 99,
              borderColor: useCustom ? 'success.main' : 'divider',
              bgcolor: useCustom ? 'rgba(16,185,129,0.04)' : 'transparent',
            }}
          >
            <Box sx={{ fontSize: 14 }}>✏️</Box>
            <TextField
              variant="standard"
              type="number"
              placeholder="Custom"
              value={customMB}
              onFocus={() => setUseCustom(true)}
              onChange={e => { setCustomMB(e.target.value); setUseCustom(true) }}
              slotProps={{
                input: {
                  disableUnderline: true,
                  style: {
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    width: 60,
                  },
                },
                htmlInput: {
                  min: 0.1,
                  max: 500,
                  step: 0.5,
                },
              }}
            />
            <Typography variant="caption" color="text.secondary">
              MB
            </Typography>
          </Paper>
        </Stack>

        {/* Mode selector */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, val) => val && setMode(val)}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                px: { xs: 2, sm: 3 },
                py: 1,
                fontWeight: 600,
                borderRadius: '10px !important',
                fontSize: '0.8125rem',
              },
            }}
          >
            {MODES.map(m => (
              <ToggleButton key={m.id} value={m.id}>
                <Stack alignItems="center" spacing={0.25}>
                  <span>{m.label}</span>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      fontSize: '0.5625rem',
                      fontWeight: 400,
                      display: { xs: 'none', sm: 'block' },
                    }}
                  >
                    {m.desc}
                  </Typography>
                </Stack>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {/* ── File grid ───────────────────────────────────────── */}
      {hasFiles && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {files.map((item, i) => (
            <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <CompressCard
                item={item}
                index={i}
                onRemove={() => removeFile(item.id)}
                onDownload={() => downloadFile(item)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* ── Floating action bar ─────────────────────────────── */}
      {hasFiles && (
        <ActionBar
          readyCount={readyCount}
          doneCount={doneCount}
          isRunning={isRunning}
          variant="compressor"
          onConvert={compressAll}
          onDownloadAll={downloadAll}
          onClear={clearAll}
          isInstallable={isInstallable}
          isInstalled={isInstalled}
          onInstall={install}
        />
      )}

      {/* ── Features footer (matching converter style with icons) ── */}
      {!hasFiles && (
        <Grid
          container
          spacing={2}
          className={`features-shift${isShifted ? ' shifted' : ''}`}
          sx={{ mt: 2, animation: 'fadeInUp 0.6s ease 0.4s both' }}
        >
          {FEATURES.map(({ Icon, color, label, desc }) => (
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
                <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                  {label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {desc}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ── Minimal Footer ──────────────────────────────────── */}
      {!hasFiles && (
        <Box sx={{ textAlign: 'center', mt: 8, mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            DevSuite — Privacy-first file processing. No files ever leave your device.
          </Typography>
        </Box>
      )}
    </Layout>
  )
}
