// OptionsPanel.jsx — Right sidebar: global format + advanced settings + actions
import { useState } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Slider from '@mui/material/Slider'
import Stack from '@mui/material/Stack'
import Collapse from '@mui/material/Collapse'
import TextField from '@mui/material/TextField'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import { Zap, X, Download, ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { FORMAT_OPTIONS } from '../conversionEngine.js'

export default function OptionsPanel({
  category = 'image',
  outputFormat,
  onFormatChange,
  quality,
  onQualityChange,
  resizeW,
  resizeH,
  onResizeChange,
  readyCount = 0,
  doneCount = 0,
  isRunning = false,
  onConvert,
  onDownloadAll,
  onClear,
  totalCount = 0,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const formats = FORMAT_OPTIONS[category] || []
  const canResize = ['image', 'svg', 'heic'].includes(category)
  const showQuality =
    canResize && !['PNG', 'GIF', 'BMP', 'ICO', 'PDF'].includes(outputFormat)

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        borderRadius: 3,
        position: 'sticky',
        top: 80,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 220,
      }}
    >
      {/* ── Header ──────────────────────────────────── */}
      <Box>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ display: 'block', mb: 0.25, letterSpacing: '0.08em', fontSize: '0.65rem' }}
        >
          Convert options
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          Applies to all {totalCount} file{totalCount !== 1 ? 's' : ''}
        </Typography>
      </Box>

      <Divider />

      {/* ── Format picker ────────────────────────────── */}
      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            mb: 1,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontSize: '0.625rem',
          }}
        >
          Output Format
        </Typography>
        <Select
          value={outputFormat}
          onChange={e => onFormatChange(e.target.value)}
          size="small"
          fullWidth
          sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: '0.9rem' }}
        >
          {formats.map(f => (
            <MenuItem
              key={f}
              value={f}
              sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.875rem' }}
            >
              {f}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {/* ── Advanced toggle ──────────────────────────── */}
      <Box>
        <Button
          size="small"
          variant="text"
          onClick={() => setAdvancedOpen(o => !o)}
          endIcon={advancedOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          startIcon={<Settings2 size={13} />}
          sx={{
            color: advancedOpen ? 'primary.main' : 'text.secondary',
            p: 0,
            fontSize: '0.75rem',
            fontWeight: 600,
            minWidth: 'auto',
            '&:hover': { bgcolor: 'transparent', color: 'primary.main' },
            transition: 'color 0.2s',
          }}
        >
          Advanced
        </Button>

        <Collapse in={advancedOpen}>
          <Stack spacing={2} sx={{ mt: 2 }}>
            {/* Quality slider */}
            {showQuality && (
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: -0.5 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ textTransform: 'uppercase', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em' }}
                  >
                    Quality
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'primary.main', fontSize: '0.75rem' }}
                  >
                    {quality}%
                  </Typography>
                </Stack>
                <Slider
                  value={quality}
                  onChange={(_, v) => onQualityChange(v)}
                  min={10}
                  max={100}
                  step={5}
                  size="small"
                />
              </Box>
            )}

            {/* Resize */}
            {canResize && (
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: 'block',
                    mb: 1,
                    textTransform: 'uppercase',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                  }}
                >
                  Resize (px)
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="W"
                    type="number"
                    value={resizeW}
                    onChange={e => onResizeChange('w', e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                    slotProps={{ htmlInput: { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }, min: 1 } }}
                  />
                  <TextField
                    label="H"
                    type="number"
                    value={resizeH}
                    onChange={e => onResizeChange('h', e.target.value)}
                    size="small"
                    sx={{ flex: 1 }}
                    slotProps={{ htmlInput: { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }, min: 1 } }}
                  />
                </Stack>
              </Box>
            )}
          </Stack>
        </Collapse>
      </Box>

      <Divider />

      {/* ── Action buttons ───────────────────────────── */}
      <Stack spacing={1}>
        {readyCount > 0 && !isRunning && (
          <Button
            variant="contained"
            fullWidth
            startIcon={<Zap size={15} />}
            onClick={onConvert}
            sx={{ py: 1.25, borderRadius: 2, fontWeight: 700 }}
          >
            Convert {readyCount} file{readyCount !== 1 ? 's' : ''}
          </Button>
        )}

        {isRunning && (
          <Button
            variant="contained"
            fullWidth
            disabled
            startIcon={<CircularProgress size={14} thickness={4} sx={{ color: 'inherit' }} />}
            sx={{ py: 1.25, borderRadius: 2, fontWeight: 700 }}
          >
            Converting…
          </Button>
        )}

        {doneCount > 1 && (
          <Button
            variant="outlined"
            color="success"
            fullWidth
            startIcon={<Download size={15} />}
            onClick={onDownloadAll}
            sx={{ py: 1, borderRadius: 2, fontWeight: 600 }}
          >
            Download all ({doneCount})
          </Button>
        )}

        <Button
          variant="text"
          color="inherit"
          fullWidth
          startIcon={<X size={13} />}
          onClick={onClear}
          sx={{ color: 'text.secondary', py: 0.75, borderRadius: 2, fontSize: '0.8rem' }}
        >
          Clear all
        </Button>
      </Stack>
    </Paper>
  )
}
