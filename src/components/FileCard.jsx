// FileCard.jsx — compact thumbnail card (iLoveIMG style)
import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import { X, Check, AlertCircle, Image as ImageIcon, Film, Music, FileText, Download } from 'lucide-react'
import { categoryColors } from '../theme.js'

// Category config
const CAT_CONFIG = {
  image:   { Icon: ImageIcon, color: categoryColors.image,   label: 'Image' },
  svg:     { Icon: ImageIcon, color: categoryColors.svg,     label: 'SVG'   },
  heic:    { Icon: ImageIcon, color: categoryColors.heic,    label: 'HEIC'  },
  pdf:     { Icon: FileText,  color: categoryColors.pdf,     label: 'PDF'   },
  video:   { Icon: Film,      color: categoryColors.video,   label: 'Video' },
  audio:   { Icon: Music,     color: categoryColors.audio,   label: 'Audio' },
  unknown: { Icon: FileText,  color: categoryColors.unknown, label: 'File'  },
}

function formatBytes(b) {
  if (!b || b < 0) return '—'
  if (b < 1024)    return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(2)} MB`
}

export default function FileCard({ item, onRemove, onDownload, index = 0 }) {
  const [preview, setPreview] = useState(null)
  const [hovered, setHovered] = useState(false)

  const cat    = item.category
  const config = CAT_CONFIG[cat] || CAT_CONFIG.unknown
  const isDone = item.status === 'done'
  const isConv = item.status === 'converting'
  const isErr  = item.status === 'error'
  const locked = item.needsEngine

  useEffect(() => {
    if (!['image', 'svg', 'heic'].includes(cat)) return
    const url = URL.createObjectURL(item.file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [item.file, cat])

  const reduction = isDone && item.blob
    ? Math.round((1 - item.blob.size / item.file.size) * 100)
    : null

  return (
    <Box
      sx={{
        position: 'relative',
        animation: 'fadeInUp 0.3s ease both',
        animationDelay: `${Math.min(index * 0.04, 0.3)}s`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Corner X button — top-right "ear" */}
      <Tooltip title="Remove file">
        <IconButton
          size="small"
          onClick={e => { e.stopPropagation(); onRemove() }}
          sx={{
            position: 'absolute',
            top: -9,
            right: -9,
            zIndex: 10,
            width: 24,
            height: 24,
            bgcolor: hovered ? 'error.main' : 'action.hover',
            color: hovered ? '#fff' : 'text.secondary',
            border: '2px solid',
            borderColor: 'background.default',
            opacity: hovered ? 1 : 0.7,
            transition: 'all 0.18s ease',
            '&:hover': { bgcolor: 'error.dark', color: '#fff', transform: 'scale(1.15)' },
          }}
        >
          <X size={11} strokeWidth={3} />
        </IconButton>
      </Tooltip>

      {/* Thumbnail area */}
      <Box
        onClick={isDone ? onDownload : undefined}
        sx={{
          width: '100%',
          paddingTop: '75%',
          position: 'relative',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: isDone ? 'rgba(16,185,129,0.06)' : `${config.color}0D`,
          border: '1.5px solid',
          borderColor: isDone ? 'success.main' : isErr ? 'error.main' : hovered ? `${config.color}80` : 'divider',
          cursor: isDone ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          '&:hover': isDone ? { boxShadow: '0 4px 20px rgba(16,185,129,0.2)' } : {},
        }}
      >
        {preview && (
          <Box
            component="img"
            src={preview}
            alt=""
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}

        {!preview && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <config.Icon size={36} color={config.color} strokeWidth={1.2} style={{ opacity: 0.45 }} />
          </Box>
        )}

        {/* Converting */}
        {isConv && (
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
            <CircularProgress variant="determinate" value={item.progress} size={36} thickness={4} sx={{ color: 'primary.light' }} />
            <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem' }}>
              {item.progress}%
            </Typography>
          </Box>
        )}

        {/* Done */}
        {isDone && (
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: hovered ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s' }}>
            {hovered ? (
              <Box sx={{ textAlign: 'center' }}>
                <Download size={22} color="#fff" />
                <Typography variant="caption" sx={{ display: 'block', color: '#fff', fontWeight: 700, fontSize: '0.65rem', mt: 0.25 }}>Save</Typography>
              </Box>
            ) : (
              <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={18} color="#fff" strokeWidth={3} />
              </Box>
            )}
          </Box>
        )}

        {/* Error */}
        {isErr && (
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={28} color="#EF4444" />
          </Box>
        )}

        {/* Locked */}
        {locked && !isConv && !isDone && (
          <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontSize: '0.6rem', textAlign: 'center', px: 1, lineHeight: 1.4 }}>
              🔒 Engine needed
            </Typography>
          </Box>
        )}

        {/* Size reduction badge */}
        {reduction !== null && (
          <Chip
            label={reduction > 0 ? `-${reduction}%` : `+${Math.abs(reduction)}%`}
            size="small"
            color={reduction > 0 ? 'success' : 'warning'}
            sx={{ position: 'absolute', bottom: 5, right: 5, height: 18, fontSize: '0.575rem', fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
          />
        )}
      </Box>

      {/* File name + size */}
      <Box sx={{ mt: 0.75, px: 0.25 }}>
        <Tooltip title={item.file.name} placement="bottom">
          <Typography
            variant="caption"
            noWrap
            sx={{ display: 'block', fontWeight: 600, fontSize: '0.68rem', lineHeight: 1.3, color: isDone ? 'success.main' : isErr ? 'error.main' : 'text.primary' }}
          >
            {item.file.name}
          </Typography>
        </Tooltip>
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem' }}>
          {isDone && item.blob ? formatBytes(item.blob.size) : formatBytes(item.file.size)}
        </Typography>
      </Box>
    </Box>
  )
}
