// ActionBar.jsx — MUI floating batch action bar
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Zoom from '@mui/material/Zoom'
import { Zap, Download, X, Target, RefreshCw } from 'lucide-react'

export default function ActionBar({
  readyCount = 0,
  doneCount = 0,
  imageCount = 0,
  pdfCount = 0,
  isRunning = false,
  variant = 'converter', // 'converter' | 'compressor'
  onConvert,
  onZipDone,
  onMergeImages,
  onMergePDFs,
  onDownloadAll,
  onClear,
}) {
  const isCompressor = variant === 'compressor'
  const hasActions = readyCount > 0 || doneCount > 0
  if (!hasActions) return null

  const colorKey = isCompressor ? 'success' : 'primary'

  return (
    <Zoom in>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          borderRadius: 99,
          px: 2,
          py: 1,
          zIndex: 1300,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
          whiteSpace: 'nowrap',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          {readyCount > 0 && !isRunning && (
            <Button
              variant="contained"
              color={colorKey}
              size="small"
              startIcon={isCompressor ? <Target size={14} /> : <Zap size={14} />}
              onClick={onConvert}
              sx={{ borderRadius: 99 }}
            >
              {isCompressor ? 'Compress' : 'Convert'} {readyCount}
            </Button>
          )}

          {isRunning && (
            <Button
              variant="contained"
              color={colorKey}
              size="small"
              disabled
              startIcon={
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
              }
              sx={{ borderRadius: 99 }}
            >
              Running…
            </Button>
          )}

          {doneCount > 1 && !isCompressor && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download size={14} />}
              onClick={onZipDone}
              sx={{ borderRadius: 99 }}
            >
              ZIP all ({doneCount})
            </Button>
          )}

          {doneCount > 1 && isCompressor && (
            <Button
              variant="outlined"
              color="success"
              size="small"
              startIcon={<Download size={14} />}
              onClick={onDownloadAll}
              sx={{ borderRadius: 99 }}
            >
              Save all ({doneCount})
            </Button>
          )}

          {imageCount >= 2 && !isCompressor && (
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              onClick={onMergeImages}
              sx={{ borderRadius: 99 }}
            >
              📄 Merge to PDF
            </Button>
          )}

          {pdfCount >= 2 && !isCompressor && (
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              onClick={onMergePDFs}
              sx={{ borderRadius: 99 }}
            >
              📎 Merge PDFs
            </Button>
          )}

          <Button
            variant="text"
            color="inherit"
            size="small"
            startIcon={<X size={14} />}
            onClick={onClear}
            sx={{ borderRadius: 99, color: 'text.secondary' }}
          >
            Clear
          </Button>
        </Stack>
      </Paper>
    </Zoom>
  )
}
