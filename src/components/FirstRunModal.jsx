// FirstRunModal.jsx — MUI Dialog for first-time setup
import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import { Zap, Download, Check } from 'lucide-react'
import { markEngineInstalled } from '../hooks/usePWA.js'

const FFMPEG_CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js'
const FFMPEG_WASM = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm'

const RESOURCES = [
  { icon: '🖥️', label: 'App shell', detail: 'The UI and all code', size: '< 1 MB', ready: true, required: true },
  { icon: '🖼️', label: 'Image converter', detail: 'PNG · JPG · WEBP · GIF — uses browser Canvas API', size: 'Instant', ready: true, required: true },
  { icon: '⚡', label: 'Conversion engine', detail: 'Audio · Video — powered by ffmpeg.wasm', size: '~30 MB', ready: false, required: false, isEngine: true },
]

export default function FirstRunModal({ engineCached, onComplete }) {
  const [phase, setPhase] = useState('prompt')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [downloadEngineSelected, setDownloadEngineSelected] = useState(!engineCached)

  const resources = RESOURCES.map(r => r.isEngine ? { ...r, ready: engineCached } : r)

  const handleSkip = () => onComplete({ engineInstalled: engineCached })

  const handleDownloadAndStart = async () => {
    if (engineCached) { onComplete({ engineInstalled: true }); return }
    setPhase('downloading'); setProgress(0); setError(null)
    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg')
      const { toBlobURL } = await import('@ffmpeg/util')
      const ff = new FFmpeg()
      ff.on('progress', ({ progress: p }) => setProgress(Math.min(99, Math.round(p * 100))))
      await ff.load({
        coreURL: await toBlobURL(FFMPEG_CORE, 'text/javascript'),
        wasmURL: await toBlobURL(FFMPEG_WASM, 'application/wasm'),
      })
      markEngineInstalled()
      setProgress(100); setPhase('done')
      setTimeout(() => onComplete({ engineInstalled: true }), 900)
    } catch (err) {
      console.error('Engine download failed:', err)
      setError('Download failed — check your connection.')
      setPhase('prompt')
    }
  }

  const handleRowClick = (r) => {
    if (r.isEngine && !engineCached && phase === 'prompt') setDownloadEngineSelected(!downloadEngineSelected)
  }

  return (
    <Dialog
      open
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 5,
          overflow: 'hidden',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          pb: 2,
          background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(6,182,212,0.04))',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={22} color="#fff" fill="#fff" />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} letterSpacing="-0.5px">
              Welcome to DevSuite
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                First-time setup
              </Typography>
              <Chip
                label="only happens once"
                size="small"
                color="primary"
                sx={{ height: 20, fontSize: '0.625rem', fontWeight: 700 }}
              />
            </Stack>
          </Box>
        </Stack>
        <Typography variant="body2" color="text.secondary" lineHeight={1.65}>
          DevSuite runs{' '}
          <Box component="strong" sx={{ color: 'primary.main' }}>100% in your browser</Box>.
          Nothing goes to any server.
        </Typography>
      </DialogTitle>

      {/* Resource list */}
      <DialogContent sx={{ py: 2.5 }}>
        <Stack spacing={1}>
          {resources.map((r, i) => {
            const selectable = r.isEngine && !engineCached && phase === 'prompt'
            const checked = r.ready || (r.isEngine && downloadEngineSelected)
            return (
              <Paper
                key={i}
                variant="outlined"
                onClick={() => handleRowClick(r)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  cursor: selectable ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  borderColor: selectable && downloadEngineSelected ? 'primary.main' : 'divider',
                  bgcolor: selectable && downloadEngineSelected
                    ? 'rgba(37,99,235,0.04)' : 'transparent',
                  '&:hover': selectable ? {
                    borderColor: 'primary.main',
                  } : {},
                }}
              >
                <Box sx={{ fontSize: 22, flexShrink: 0 }}>{r.icon}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
                    <Typography variant="body2" fontWeight={600}>{r.label}</Typography>
                    {!r.required && (
                      <Chip label="optional" size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: '0.5625rem' }} />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">{r.detail}</Typography>
                </Box>
                <Stack alignItems="flex-end" spacing={0.5} sx={{ flexShrink: 0 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 600,
                      color: checked ? 'success.main' : 'primary.main',
                    }}
                  >
                    {r.size}
                  </Typography>
                  <Box
                    sx={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: 2,
                      borderColor: checked ? 'success.main' : 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: checked ? 'success.main' : 'transparent',
                      transition: 'all 0.2s',
                    }}
                  >
                    {checked && <Check size={10} color="#fff" strokeWidth={3} />}
                  </Box>
                </Stack>
              </Paper>
            )
          })}
        </Stack>

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {/* Downloading progress */}
        {phase === 'downloading' && (
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Downloading engine…
              </Typography>
              <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'primary.main' }}>
                {progress}%
              </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontFamily: "'JetBrains Mono', monospace" }}>
              Cached in your browser after this
            </Typography>
          </Box>
        )}

        {/* Done */}
        {phase === 'done' && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Engine installed! Starting DevSuite…
            </Typography>
          </Alert>
        )}
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        {phase === 'prompt' && (
          <>
            {engineCached ? (
              <Button variant="contained" onClick={handleSkip} fullWidth>
                Start DevSuite →
              </Button>
            ) : (
              <>
                <Button variant="text" onClick={handleSkip} sx={{ color: 'text.secondary' }}>
                  Skip for now
                </Button>
                <Box sx={{ flex: 1 }} />
                {downloadEngineSelected ? (
                  <Button variant="contained" onClick={handleDownloadAndStart} startIcon={<Download size={14} />}>
                    Download & Start
                  </Button>
                ) : (
                  <Button variant="contained" onClick={handleSkip}>
                    Start Converter
                  </Button>
                )}
              </>
            )}
          </>
        )}

        {phase === 'downloading' && (
          <Button variant="contained" disabled fullWidth sx={{ opacity: 0.6 }}>
            Downloading…
          </Button>
        )}
      </DialogActions>

      {/* Privacy footer */}
      <Box
        sx={{
          px: 3,
          py: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Box sx={{ fontSize: 16 }}>🔒</Box>
        <Typography variant="caption" color="text.secondary" lineHeight={1.5}>
          No analytics, no tracking, no backend. Your files never leave your device.
        </Typography>
      </Box>
    </Dialog>
  )
}
