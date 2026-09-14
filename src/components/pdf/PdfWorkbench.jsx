// ══════════════════════════════════════════════════════════════
//  Filomer — PdfWorkbench.jsx
//  Interactive Visual PDF Studio (iLovePDF Benchmark)
//  • Visual Page Thumbnails with dynamic rotation
//  • Page reordering, individual & bulk 90°/180° rotation, page deletion
//  • Range-based splitting & single-page burst to ZIP
//  • Multi-PDF visual merge
//  • 100% In-Browser — Zero Server Cost, 100% Offline
// ══════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Checkbox from '@mui/material/Checkbox'
import {
  FileText, RotateCw, RotateCcw, Trash2, ArrowLeft, ArrowRight,
  Download, RefreshCw, Scissors, Layers, Split, Undo
} from 'lucide-react'
import Layout from '../Layout.jsx'
import DropZone from '../DropZone.jsx'
import { useToasts } from '../Toast.jsx'
import { useInstallPrompt } from '../../hooks/usePWA.js'
import {
  generateAllThumbnails, exportCustomPdf,
  splitPdfByRanges, burstPdfPages, mergeMultiplePdfs
} from '../../utils/pdfEngine.js'

function formatBytes(b) {
  if (!b) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(2)} MB`
}

export default function PdfWorkbench() {
  const [activeTab, setActiveTab] = useState(0) // 0: Organize/Rotate, 1: Split, 2: Merge
  const [pdfFile, setPdfFile] = useState(null)
  const [pages, setPages] = useState([])
  const [isRendering, setIsRendering] = useState(false)
  const [renderProgress, setRenderProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processProgress, setProcessProgress] = useState(0)

  // Split options
  const [splitMode, setSplitMode] = useState('selected') // 'selected', 'range', 'burst'
  const [customRange, setCustomRange] = useState('1-2, 3')

  // Merge options
  const [mergeFiles, setMergeFiles] = useState([])

  const { toasts, addToast } = useToasts()
  const { isInstallable, isInstalled, install } = useInstallPrompt()

  // ─── PDF File Upload & Thumbnail Generation ──────────────────
  const handlePdfLoaded = useCallback(async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      addToast('Please upload a valid PDF document', 'error')
      return
    }

    setPdfFile(file)
    setPages([])
    setIsRendering(true)
    setRenderProgress(0)

    try {
      const { pages: generatedPages } = await generateAllThumbnails(
        file,
        pct => setRenderProgress(pct),
        (pageItem) => {
          setPages(prev => [...prev, pageItem])
        }
      )
      addToast(`Loaded ${generatedPages.length} pages from ${file.name}`, 'success')
    } catch (err) {
      console.error('[filomer] PDF load error:', err)
      addToast('Failed to parse PDF document. It may be password-protected or corrupted.', 'error')
      setPdfFile(null)
    } finally {
      setIsRendering(false)
    }
  }, [addToast])

  // ─── Page Action Handlers ────────────────────────────────────
  const rotatePage = (index, delta = 90) => {
    setPages(prev => prev.map((p, i) => {
      if (i !== index) return p
      const newRotation = (p.rotation + delta + 360) % 360
      return { ...p, rotation: newRotation }
    }))
  }

  const rotateAllPages = (delta = 90) => {
    setPages(prev => prev.map(p => ({
      ...p,
      rotation: (p.rotation + delta + 360) % 360,
    })))
  }

  const toggleDeletePage = (index) => {
    setPages(prev => prev.map((p, i) => {
      if (i !== index) return p
      return { ...p, deleted: !p.deleted }
    }))
  }

  const toggleSelectPage = (index) => {
    setPages(prev => prev.map((p, i) => {
      if (i !== index) return p
      return { ...p, selected: !p.selected }
    }))
  }

  const movePage = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= pages.length) return
    setPages(prev => {
      const copy = [...prev]
      const [moved] = copy.splice(fromIndex, 1)
      copy.splice(toIndex, 0, moved)
      return copy
    })
  }

  const selectAllPages = (selected = true) => {
    setPages(prev => prev.map(p => ({ ...p, selected })))
  }

  const resetPages = () => {
    setPages(prev => prev.map(p => ({ ...p, rotation: 0, deleted: false, selected: true })))
  }

  // ─── Export & Action Triggers ────────────────────────────────
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  const handleExportOrganized = async () => {
    if (!pdfFile) return
    setIsProcessing(true)
    setProcessProgress(0)

    try {
      const blob = await exportCustomPdf(pdfFile, pages, pct => setProcessProgress(pct))
      const base = pdfFile.name.replace(/\.[^.]+$/, '')
      downloadBlob(blob, `${base}_organized.pdf`)
      addToast('Organized PDF exported successfully ✓', 'success')
    } catch (err) {
      console.error(err)
      addToast(err.message || 'Failed to export organized PDF', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExportSplit = async () => {
    if (!pdfFile) return
    setIsProcessing(true)
    setProcessProgress(0)

    try {
      const base = pdfFile.name.replace(/\.[^.]+$/, '')

      if (splitMode === 'selected') {
        const selectedPages = pages.filter(p => p.selected && !p.deleted)
        if (selectedPages.length === 0) {
          throw new Error('Please select at least one page to extract.')
        }
        const blob = await exportCustomPdf(pdfFile, selectedPages, pct => setProcessProgress(pct))
        downloadBlob(blob, `${base}_extracted.pdf`)
        addToast(`Extracted ${selectedPages.length} pages ✓`, 'success')
      } else if (splitMode === 'range') {
        const rangesList = customRange.split(';').map(r => ({ range: r.trim() })).filter(r => r.range)
        if (!rangesList.length) throw new Error('Please enter a valid page range (e.g., 1-3, 5)')
        const zipBlob = await splitPdfByRanges(pdfFile, rangesList, pct => setProcessProgress(pct))
        downloadBlob(zipBlob, `${base}_ranges.zip`)
        addToast('Split ranges exported to ZIP ✓', 'success')
      } else if (splitMode === 'burst') {
        const zipBlob = await burstPdfPages(pdfFile, pct => setProcessProgress(pct))
        downloadBlob(zipBlob, `${base}_all_pages.zip`)
        addToast('All pages burst to ZIP ✓', 'success')
      }
    } catch (err) {
      console.error(err)
      addToast(err.message || 'Failed to split PDF', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // ─── Merge Files Handlers ───────────────────────────────────
  const handleAddMergeFiles = (files) => {
    const list = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (!list.length) {
      addToast('Please upload valid PDF files for merging', 'warning')
      return
    }
    setMergeFiles(prev => [...prev, ...list])
    addToast(`Added ${list.length} PDF(s) to merge queue`, 'info')
  }

  const handleMergeAll = async () => {
    if (mergeFiles.length < 2) {
      addToast('Please add at least 2 PDF files to merge', 'warning')
      return
    }
    setIsProcessing(true)
    setProcessProgress(0)
    try {
      const mergedBlob = await mergeMultiplePdfs(mergeFiles, pct => setProcessProgress(pct))
      downloadBlob(mergedBlob, 'merged_document.pdf')
      addToast(`${mergeFiles.length} PDFs merged into single document ✓`, 'success')
    } catch (err) {
      console.error(err)
      addToast('Failed to merge PDF files', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const activePagesCount = pages.filter(p => !p.deleted).length

  return (
    <Layout
      toasts={toasts}
      isInstallable={isInstallable}
      isInstalled={isInstalled}
      onInstall={install}
    >
      <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 1, sm: 2 } }}>
        {/* ── Header ────────────────────────────────────────── */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #EF4444, #F43F5E)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)',
              }}
            >
              <FileText size={20} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              PDF Studio
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Visual page organizer, range splitter, and multi-document merge — 100% in your browser.
          </Typography>
        </Box>

        {/* ── Sub Navigation Tabs ───────────────────────────── */}
        <Paper
          variant="outlined"
          sx={{
            mb: 3,
            borderRadius: 3,
            bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
            centered
            sx={{
              '& .MuiTab-root': {
                fontWeight: 700,
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                textTransform: 'none',
                gap: 1,
              },
              '& .Mui-selected': {
                color: '#EF4444 !important',
              },
              '& .MuiTabs-indicator': {
                bgcolor: '#EF4444',
                height: 3,
                borderRadius: 2,
              },
            }}
          >
            <Tab icon={<Layers size={16} />} iconPosition="start" label="Organize & Rotate" />
            <Tab icon={<Scissors size={16} />} iconPosition="start" label="Split PDF" />
            <Tab icon={<Split size={16} />} iconPosition="start" label="Merge PDFs" />
          </Tabs>
        </Paper>

        {/* ── Tab 0 & 1: Single Document Operations (Organize & Split) ── */}
        {(activeTab === 0 || activeTab === 1) && (
          <>
            {!pdfFile ? (
              <Box sx={{ maxWidth: 650, mx: 'auto', mt: 2 }}>
                <DropZone
                  onFiles={files => files[0] && handlePdfLoaded(files[0])}
                  acceptTypes=".pdf,application/pdf"
                  dropLabel="Drop your PDF here"
                  dropSubtext="View page thumbnails, rotate, delete, or split into separate documents"
                  browseSubtext="Supports multi-page PDF documents up to 50MB"
                  infoChips={['Visual Thumbnails', 'Rotate 90°', 'Delete Pages', 'Custom Splitting']}
                  variant="indigo"
                />
              </Box>
            ) : (
              <Box>
                {/* File Metadata & Toolbar Bar */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    mb: 3,
                    borderRadius: 3,
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                  }}
                >
                  {/* Left: Document Info */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        bgcolor: 'rgba(239, 68, 68, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#EF4444',
                      }}
                    >
                      <FileText size={20} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {pdfFile.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {pages.length} total pages • {formatBytes(pdfFile.size)} • {activePagesCount} active
                      </Typography>
                    </Box>
                  </Box>

                  {/* Middle & Right: Actions depending on tab */}
                  <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                    {activeTab === 0 && (
                      <>
                        <Tooltip title="Rotate all pages 90° clockwise">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<RotateCw size={14} />}
                            onClick={() => rotateAllPages(90)}
                            sx={{ borderRadius: 2, textTransform: 'none' }}
                          >
                            Rotate All
                          </Button>
                        </Tooltip>

                        <Tooltip title="Reset all rotations and deletions">
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            startIcon={<RefreshCw size={14} />}
                            onClick={resetPages}
                            sx={{ borderRadius: 2, textTransform: 'none' }}
                          >
                            Reset
                          </Button>
                        </Tooltip>

                        <Button
                          variant="contained"
                          color="error"
                          disabled={isProcessing || isRendering || activePagesCount === 0}
                          startIcon={isProcessing ? <CircularProgress size={16} color="inherit" /> : <Download size={16} />}
                          onClick={handleExportOrganized}
                          sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 700,
                            bgcolor: '#EF4444',
                            '&:hover': { bgcolor: '#DC2626' },
                          }}
                        >
                          {isProcessing ? `Exporting (${processProgress}%)` : `Export PDF (${activePagesCount} pgs)`}
                        </Button>
                      </>
                    )}

                    {activeTab === 1 && (
                      <>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => selectAllPages(true)}
                          sx={{ borderRadius: 2, textTransform: 'none' }}
                        >
                          Select All
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => selectAllPages(false)}
                          sx={{ borderRadius: 2, textTransform: 'none' }}
                        >
                          Deselect All
                        </Button>
                        <Button
                          variant="contained"
                          color="error"
                          disabled={isProcessing || isRendering}
                          startIcon={isProcessing ? <CircularProgress size={16} color="inherit" /> : <Scissors size={16} />}
                          onClick={handleExportSplit}
                          sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 700,
                            bgcolor: '#EF4444',
                            '&:hover': { bgcolor: '#DC2626' },
                          }}
                        >
                          {isProcessing ? `Splitting (${processProgress}%)` : 'Extract & Download'}
                        </Button>
                      </>
                    )}

                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => { setPdfFile(null); setPages([]) }}
                      sx={{ textTransform: 'none' }}
                    >
                      Change File
                    </Button>
                  </Stack>
                </Paper>

                {/* Split Configuration Bar (Shown only in Split Tab) */}
                {activeTab === 1 && (
                  <Paper
                    variant="outlined"
                    sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: 'background.paper' }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                      Split Configuration
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                      <Button
                        variant={splitMode === 'selected' ? 'contained' : 'outlined'}
                        color="error"
                        size="small"
                        onClick={() => setSplitMode('selected')}
                        sx={{ borderRadius: 2, textTransform: 'none' }}
                      >
                        Extract Selected Checkboxes
                      </Button>
                      <Button
                        variant={splitMode === 'range' ? 'contained' : 'outlined'}
                        color="error"
                        size="small"
                        onClick={() => setSplitMode('range')}
                        sx={{ borderRadius: 2, textTransform: 'none' }}
                      >
                        Custom Page Ranges
                      </Button>
                      <Button
                        variant={splitMode === 'burst' ? 'contained' : 'outlined'}
                        color="error"
                        size="small"
                        onClick={() => setSplitMode('burst')}
                        sx={{ borderRadius: 2, textTransform: 'none' }}
                      >
                        Burst (Every Page to Single PDF)
                      </Button>
                    </Stack>

                    {splitMode === 'range' && (
                      <Box sx={{ mt: 2 }}>
                        <TextField
                          size="small"
                          fullWidth
                          label="Enter Page Ranges (e.g. 1-3, 5; 6-8)"
                          helperText="Use comma or semicolon to separate multiple parts. Each part will be created as its own PDF."
                          value={customRange}
                          onChange={e => setCustomRange(e.target.value)}
                        />
                      </Box>
                    )}
                  </Paper>
                )}

                {/* Rendering Progress Banner */}
                {isRendering && (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      mb: 3,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      bgcolor: 'rgba(239, 68, 68, 0.05)',
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    <CircularProgress size={20} color="error" />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Rendering page thumbnails... {renderProgress}%
                    </Typography>
                  </Paper>
                )}

                {/* ── Page Grid ─────────────────────────────────── */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(auto-fill, minmax(140px, 1fr))',
                      sm: 'repeat(auto-fill, minmax(180px, 1fr))',
                      md: 'repeat(auto-fill, minmax(210px, 1fr))',
                    },
                    gap: 2.5,
                  }}
                >
                  {pages.map((page, index) => {
                    const isDeleted = page.deleted
                    return (
                      <Paper
                        key={`${page.originalIndex}-${index}`}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 3,
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          opacity: isDeleted ? 0.35 : 1,
                          filter: isDeleted ? 'grayscale(1)' : 'none',
                          borderColor: page.selected && activeTab === 1 ? '#EF4444' : 'divider',
                          transition: 'all 0.25s ease',
                          bgcolor: 'background.paper',
                          '&:hover': {
                            borderColor: '#EF4444',
                            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.12)',
                          },
                        }}
                      >
                        {/* Page Header (Number & Checkbox) */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                          <Chip
                            label={`Page ${page.pageNumber}`}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              height: 22,
                              bgcolor: 'action.hover',
                            }}
                          />
                          {activeTab === 1 && (
                            <Checkbox
                              size="small"
                              checked={page.selected}
                              onChange={() => toggleSelectPage(index)}
                              sx={{ p: 0, color: '#EF4444', '&.Mui-checked': { color: '#EF4444' } }}
                            />
                          )}
                        </Box>

                        {/* Thumbnail Card with CSS Rotation */}
                        <Box
                          sx={{
                            width: '100%',
                            paddingTop: '135%', // Standard Portrait Aspect
                            position: 'relative',
                            borderRadius: 1.5,
                            overflow: 'hidden',
                            bgcolor: (t) => t.palette.mode === 'dark' ? '#1E293B' : '#F1F5F9',
                            border: '1px solid',
                            borderColor: 'divider',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Box
                            component="img"
                            src={page.dataUrl}
                            alt={`Page ${page.pageNumber}`}
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'contain',
                              transform: `rotate(${page.rotation}deg)`,
                              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                          />
                        </Box>

                        {/* Page Action Controls */}
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          sx={{ mt: 1.25, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}
                        >
                          {/* Reorder Buttons */}
                          <Box sx={{ display: 'flex', gap: 0.25 }}>
                            <Tooltip title="Move Left">
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={index === 0}
                                  onClick={() => movePage(index, index - 1)}
                                  sx={{ width: 26, height: 26 }}
                                >
                                  <ArrowLeft size={13} />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Move Right">
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={index === pages.length - 1}
                                  onClick={() => movePage(index, index + 1)}
                                  sx={{ width: 26, height: 26 }}
                                >
                                  <ArrowRight size={13} />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>

                          {/* Rotate & Delete */}
                          <Box sx={{ display: 'flex', gap: 0.25 }}>
                            <Tooltip title="Rotate Left 90°">
                              <IconButton
                                size="small"
                                onClick={() => rotatePage(index, -90)}
                                sx={{ width: 26, height: 26, color: '#EF4444' }}
                              >
                                <RotateCcw size={13} />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Rotate Right 90°">
                              <IconButton
                                size="small"
                                onClick={() => rotatePage(index, 90)}
                                sx={{ width: 26, height: 26, color: '#EF4444' }}
                              >
                                <RotateCw size={13} />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title={isDeleted ? 'Restore page' : 'Delete page'}>
                              <IconButton
                                size="small"
                                onClick={() => toggleDeletePage(index)}
                                sx={{
                                  width: 26,
                                  height: 26,
                                  color: isDeleted ? 'success.main' : 'error.main',
                                }}
                              >
                                {isDeleted ? <Undo size={13} /> : <Trash2 size={13} />}
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Stack>
                      </Paper>
                    )
                  })}
                </Box>
              </Box>
            )}
          </>
        )}

        {/* ── Tab 2: Multi-PDF Merge ────────────────────────── */}
        {activeTab === 2 && (
          <Box sx={{ maxWidth: 750, mx: 'auto' }}>
            <DropZone
              onFiles={handleAddMergeFiles}
              acceptTypes=".pdf,application/pdf"
              dropLabel="Drop PDFs to merge together"
              dropSubtext="Select multiple PDF documents to combine into one"
              browseSubtext="Supports multiple files"
              infoChips={['Fast In-Browser Merge', 'Reorder Documents', 'No File Limits']}
              variant="indigo"
            />

            {mergeFiles.length > 0 && (
              <Paper variant="outlined" sx={{ mt: 3, p: 2.5, borderRadius: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Merge Queue ({mergeFiles.length} files)
                  </Typography>
                  <Button
                    variant="contained"
                    color="error"
                    disabled={mergeFiles.length < 2 || isProcessing}
                    startIcon={isProcessing ? <CircularProgress size={16} color="inherit" /> : <Download size={16} />}
                    onClick={handleMergeAll}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 700,
                      bgcolor: '#EF4444',
                      '&:hover': { bgcolor: '#DC2626' },
                    }}
                  >
                    {isProcessing ? `Merging (${processProgress}%)` : `Merge ${mergeFiles.length} PDFs`}
                  </Button>
                </Box>

                <Stack spacing={1.5}>
                  {mergeFiles.map((file, i) => (
                    <Paper
                      key={`${file.name}-${i}`}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, width: 24 }}>
                          #{i + 1}
                        </Typography>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {file.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatBytes(file.size)}
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          disabled={i === 0}
                          onClick={() => {
                            setMergeFiles(prev => {
                              const copy = [...prev]
                              const [moved] = copy.splice(i, 1)
                              copy.splice(i - 1, 0, moved)
                              return copy
                            })
                          }}
                        >
                          <ArrowLeft size={14} style={{ transform: 'rotate(90deg)' }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={i === mergeFiles.length - 1}
                          onClick={() => {
                            setMergeFiles(prev => {
                              const copy = [...prev]
                              const [moved] = copy.splice(i, 1)
                              copy.splice(i + 1, 0, moved)
                              return copy
                            })
                          }}
                        >
                          <ArrowRight size={14} style={{ transform: 'rotate(90deg)' }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setMergeFiles(prev => prev.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            )}
          </Box>
        )}
      </Box>
    </Layout>
  )
}
