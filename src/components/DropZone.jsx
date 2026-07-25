// DropZone.jsx — drag-and-drop zone with SVG marching-ants border on hover/drag
import { useRef, useState, useLayoutEffect } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import { Upload, Plus } from 'lucide-react'

const RADIUS_UNITS = 4 // same value passed to Paper's sx.borderRadius

export default function DropZone({
  isDragging,
  setIsDragging,
  onFiles,
  fileCount = 0,
  doneCount = 0,
  variant = 'indigo', // 'indigo' | 'green' — controls gradient stops
  children,
  dropLabel,
  dropSubtext,
  browseSubtext,
  infoChips,
  onHoverChange,
  acceptTypes, // optional accept string for <input type="file">
}) {
  const inputRef = useRef(null)
  const paperRef = useRef(null)
  const [isHovered, setIsHovered] = useState(false)
  const [radiusPx, setRadiusPx] = useState(16) // sensible fallback until measured
  const [dims, setDims] = useState({ w: 0, h: 0 })

  // Measure the Paper's real computed border-radius + size so the SVG rect's
  // `rx` matches exactly, and so we can compute a dash pattern that divides
  // evenly into the perimeter (avoids a visible seam/kink at the start point).
  useLayoutEffect(() => {
    const el = paperRef.current
    if (!el) return
    const measure = () => {
      const cs = getComputedStyle(el)
      const val = parseFloat(cs.borderTopLeftRadius) || 16
      setRadiusPx(val)
      setDims({ w: el.clientWidth, h: el.clientHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Perimeter of a rounded rect = 2*(w+h) - 8*r + 2*pi*r
  const r = Math.max(radiusPx - 1, 0)
  const perimeter = dims.w && dims.h
    ? 2 * (dims.w + dims.h) - 8 * r + 2 * Math.PI * r
    : 0
  // pathLength normalises the perimeter to PATH_LEN so all dash/offset
  // arithmetic is in unit-space and divides *exactly* — zero seam.
  const PATH_LEN = 1000
  const targetPeriod = 18
  const periods = perimeter ? Math.max(Math.round(perimeter / targetPeriod), 1) : 1
  const period = PATH_LEN / periods      // one full dash+gap cycle
  const dashLen = period * (10 / 18)
  const gapLen = period - dashLen
  // Shift the pattern so the path join (top-left corner area) falls
  // in the middle of a gap — completely invisible.
  const seamOffset = gapLen / 2

  const isGreen = variant === 'green'
  const hasFiles = fileCount > 0
  const colorKey = isGreen ? 'success' : 'primary'
  const accentRgb = isGreen ? '16,185,129' : '59,130,246'

  const gradientId = isGreen ? 'dzAntsGradientGreen' : 'dzAntsGradientBlue'
  const isAnimating = !hasFiles && (isDragging || isHovered)

  const updateHover = val => {
    setIsHovered(val)
    onHoverChange?.(val)
  }

  const handleDrop = e => {
    e.preventDefault()
    setIsDragging(false)
    updateHover(false)
    onFiles(e.dataTransfer.files)
  }

  const handleChange = e => {
    onFiles(e.target.files)
    e.target.value = ''
  }

  return (
    <>
      <Paper
        ref={paperRef}
        variant="outlined"
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !hasFiles && inputRef.current?.click()}
        onMouseEnter={() => { if (!hasFiles) updateHover(true) }}
        onMouseLeave={() => updateHover(false)}
        sx={{
          mb: 3,
          p: hasFiles ? 2 : { xs: 2.5, sm: 3, md: 4 },
          textAlign: hasFiles ? 'left' : 'center',
          // No `border` here — the SVG overlay draws the visible border.
          // Transparent border keeps MUI's outlined variant from adding its own.
          border: '2px solid transparent !important',
          bgcolor: isAnimating
            ? `rgba(${accentRgb}, 0.07)`
            : `rgba(${accentRgb}, 0.02)`,
          borderRadius: RADIUS_UNITS,
          transition: 'background-color 0.25s ease',
          cursor: hasFiles ? 'default' : 'pointer',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* ── Marching ants border overlay ────────────────────── */}
        {!hasFiles && (
          <Box
            component="svg"
            width="100%"
            height="100%"
            sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="dzAntsGradientBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
              <linearGradient id="dzAntsGradientGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
            <rect
              x="1"
              y="1"
              width="calc(100% - 2px)"
              height="calc(100% - 2px)"
              rx={r}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="2"
              pathLength={PATH_LEN}
              strokeDasharray={`${dashLen} ${gapLen}`}
              className={`dropzone-ants-rect${isAnimating ? ' marching' : ''}`}
              style={{
                '--seam-offset': seamOffset,
                '--march-target': seamOffset - period,
              }}
            />
          </Box>
        )}

        {!hasFiles ? (
          /* ── EMPTY STATE ───────────────────────────────── */
          <Stack spacing={2} sx={{ alignItems: 'center', py: { xs: 1.5, md: 2.5 }, position: 'relative' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ mb: 0.75, fontWeight: 700 }}>
                {isDragging ? '✦ Release to add files' : (dropLabel || 'Drop any files here')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, mx: 'auto', lineHeight: 1.6 }}>
                {dropSubtext || '30+ formats supported · HEIC · SVG · ICO · GIF · Extract audio · Merge PDFs'}
              </Typography>
            </Box>

            <Button
              variant="contained"
              color={colorKey}
              size="large"
              startIcon={<Upload size={18} />}
              onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
              sx={{
                px: 7, py: 1.25, borderRadius: 99, minWidth: 260,
                fontWeight: 700,
              }}
            >
              Select Files
            </Button>

            <Typography variant="caption" color="text.secondary">
              {browseSubtext || 'or drag and drop'}
            </Typography>

            {infoChips && (
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                {infoChips.map(t => (
                  <Chip key={t} label={t} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                ))}
              </Stack>
            )}
          </Stack>
        ) : (
          /* ── COMPACT STATE (has files) ─────────────────── */
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <IconButton
              size="small"
              onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
              sx={{
                bgcolor: `${colorKey}.main`,
                color: 'white',
                width: 38,
                height: 38,
                '&:hover': { bgcolor: `${colorKey}.dark` },
              }}
            >
              <Plus size={18} />
            </IconButton>

            <Box>
              <Typography variant="body2" fontWeight={700}>
                {isDragging ? 'Drop to add' : 'Add more files'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {fileCount} file{fileCount > 1 ? 's' : ''} queued · {doneCount} done
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} useFlexGap sx={{ ml: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {children}
            </Stack>
          </Stack>
        )}
      </Paper>

      <input ref={inputRef} type="file" multiple accept={acceptTypes} style={{ display: 'none' }} onChange={handleChange} />
    </>
  )
}