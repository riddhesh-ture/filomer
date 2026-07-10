// CompressCard.jsx — MUI Card for individual file compression
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import { X, Download, ArrowRight } from 'lucide-react'
import { categoryColors } from '../theme.js'

const CAT_META = {
  image:   { emoji: '🖼️', color: categoryColors.image },
  audio:   { emoji: '🎵', color: categoryColors.audio },
  video:   { emoji: '🎬', color: categoryColors.video },
  pdf:     { emoji: '📄', color: categoryColors.pdf },
  unknown: { emoji: '📁', color: categoryColors.unknown },
}

function formatBytes(b) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(2)} MB`
}

export default function CompressCard({ item, onRemove, onDownload, index = 0 }) {
  const meta = CAT_META[item.category] || CAT_META.unknown
  const isDone  = item.status === 'done'
  const isComp  = item.status === 'compressing'
  const isErr   = item.status === 'error'
  const locked  = item.needsEngine

  const reduction = isDone && item.finalSize
    ? Math.round((1 - item.finalSize / item.originalSize) * 100)
    : null

  const overTarget = isDone && item.finalSize && item.targetBytes
    ? item.finalSize > item.targetBytes
    : false

  return (
    <Card
      sx={{
        animation: 'fadeInUp 0.4s ease both',
        animationDelay: `${index * 0.05}s`,
        borderColor: isDone && !overTarget
          ? 'success.main'
          : isDone && overTarget ? 'warning.main'
          : isErr ? 'error.main'
          : 'divider',
      }}
    >
      {/* Top color band */}
      <Box
        sx={{
          height: 4,
          borderRadius: '16px 16px 0 0',
          background: isDone && !overTarget
            ? 'linear-gradient(90deg, #10B981, #34D399)'
            : isDone && overTarget
              ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
              : isErr
                ? 'linear-gradient(90deg, #EF4444, #F87171)'
                : `linear-gradient(90deg, ${meta.color}, ${meta.color}88)`,
        }}
      />

      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, '&:last-child': { pb: 2 } }}>
        {/* File header */}
        <Stack direction="row" alignItems="flex-start" spacing={1.5}>
          <Avatar
            sx={{
              width: 44,
              height: 44,
              borderRadius: 3,
              bgcolor: `${meta.color}15`,
              fontSize: 22,
            }}
          >
            {meta.emoji}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap title={item.file.name}>
              {item.file.name}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap" useFlexGap>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {formatBytes(item.file.size)}
              </Typography>
              {isDone && (
                <>
                  <ArrowRight size={10} color="#94A3B8" />
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                      color: overTarget ? 'warning.main' : 'success.main',
                    }}
                  >
                    {formatBytes(item.finalSize)}
                  </Typography>
                  {reduction !== null && (
                    <Chip
                      label={reduction > 0 ? `-${reduction}%` : `+${Math.abs(reduction)}%`}
                      size="small"
                      color={reduction > 0 ? 'success' : 'error'}
                      variant="filled"
                      sx={{ height: 18, fontSize: '0.625rem', fontWeight: 700 }}
                    />
                  )}
                </>
              )}
              {locked && (
                <Typography variant="caption" color="warning.main" sx={{ fontSize: '0.625rem' }}>
                  needs engine
                </Typography>
              )}
            </Stack>
          </Box>

          <IconButton
            size="small"
            onClick={onRemove}
            sx={{ border: 1, borderColor: 'divider', borderRadius: 2, width: 28, height: 28 }}
          >
            <X size={14} />
          </IconButton>
        </Stack>

        {/* Progress bar */}
        {isComp && (
          <Box>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Compressing…
              </Typography>
              <Typography variant="caption" sx={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'primary.main' }}>
                {item.progress}%
              </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={item.progress} />
          </Box>
        )}

        {/* Notes / warnings */}
        {isDone && item.note && (
          <Alert severity="info" variant="outlined" sx={{ py: 0, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
            {item.note}
          </Alert>
        )}
        {isDone && item.warning && (
          <Alert severity="warning" variant="outlined" sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
            {item.warning}
          </Alert>
        )}
        {isErr && (
          <Alert severity="error" variant="outlined" sx={{ py: 0, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
            Compression failed — try Aggressive mode or a larger target
          </Alert>
        )}

        {/* Size bar visualization */}
        {isDone && (
          <Box>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.5625rem' }}>
                Original
              </Typography>
              <Typography variant="overline" sx={{ fontSize: '0.5625rem', color: 'primary.main' }}>
                Target
              </Typography>
              <Typography variant="overline" sx={{ fontSize: '0.5625rem', color: overTarget ? 'warning.main' : 'success.main' }}>
                Result
              </Typography>
            </Stack>
            <Box
              sx={{
                position: 'relative',
                height: 8,
                borderRadius: 1,
                bgcolor: 'action.hover',
                overflow: 'visible',
              }}
            >
              {/* Target marker */}
              <Box
                sx={{
                  position: 'absolute',
                  left: `${Math.min(99, (item.targetBytes / item.file.size) * 100)}%`,
                  top: -2,
                  width: 2,
                  height: 12,
                  bgcolor: 'primary.main',
                  borderRadius: 1,
                  zIndex: 2,
                }}
              />
              {/* Result fill */}
              <Box
                sx={{
                  height: '100%',
                  borderRadius: 1,
                  width: `${Math.min(100, (item.finalSize / item.file.size) * 100)}%`,
                  bgcolor: overTarget ? 'warning.main' : 'success.main',
                  transition: 'width 0.3s ease',
                }}
              />
            </Box>
          </Box>
        )}

        {/* Download */}
        {isDone && (
          <Button
            variant="outlined"
            color={overTarget ? 'warning' : 'success'}
            size="small"
            startIcon={<Download size={14} />}
            onClick={onDownload}
            fullWidth
          >
            {overTarget ? 'Save anyway' : 'Save compressed file'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
