// EngineBanner.jsx — MUI Alert-based engine install/status banner
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import { Download, RefreshCw } from 'lucide-react'

export default function EngineBanner({
  engineState,
  engineProgress = 0,
  engineFiles = 0,
  onInstall,
}) {
  const engineReady = engineState === 'ready'
  if (engineFiles === 0 && engineState === 'idle') return null

  if (engineReady) {
    return (
      <Alert
        severity="success"
        variant="outlined"
        sx={{
          mb: 3,
          borderRadius: 3,
          animation: 'fadeInUp 0.3s ease',
        }}
      >
        <Typography variant="body2" fontWeight={700}>
          Engine ready 🎉
        </Typography>
      </Alert>
    )
  }

  if (engineState === 'error') {
    return (
      <Alert
        severity="error"
        variant="outlined"
        action={
          <Button color="error" size="small" onClick={onInstall} startIcon={<RefreshCw size={14} />}>
            Retry
          </Button>
        }
        sx={{ mb: 3, borderRadius: 3, animation: 'fadeInUp 0.3s ease' }}
      >
        <Typography variant="body2" fontWeight={700}>
          Engine load failed. Check your connection.
        </Typography>
      </Alert>
    )
  }

  if (engineState === 'loading') {
    return (
      <Alert
        severity="info"
        variant="outlined"
        icon={<span style={{ animation: 'spin 1s linear infinite', display: 'inline-flex' }}>⚡</span>}
        sx={{ mb: 3, borderRadius: 3, animation: 'fadeInUp 0.3s ease' }}
      >
        <Stack spacing={1} sx={{ width: '100%' }}>
          <Typography variant="body2" fontWeight={700}>
            Installing engine… {engineProgress}%
          </Typography>
          <LinearProgress variant="determinate" value={engineProgress} />
        </Stack>
      </Alert>
    )
  }

  // idle — needs install
  return (
    <Alert
      severity="warning"
      variant="outlined"
      icon="⚡"
      action={
        <Button
          variant="contained"
          size="small"
          onClick={onInstall}
          startIcon={<Download size={14} />}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Install Engine
        </Button>
      }
      sx={{ mb: 3, borderRadius: 3, animation: 'fadeInUp 0.3s ease' }}
    >
      <Box>
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.25 }}>
          {engineFiles} file{engineFiles > 1 ? 's' : ''} need the conversion engine
        </Typography>
        <Typography variant="caption" color="text.secondary">
          One-time ~30 MB download. Runs in your browser, cached offline after.
        </Typography>
      </Box>
    </Alert>
  )
}
