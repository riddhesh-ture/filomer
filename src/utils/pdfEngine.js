// ══════════════════════════════════════════════════════════════
//  Filomer — pdfEngine.js
//  Client-side PDF manipulation engine powered by pdfjs-dist & pdf-lib
//  • 100% In-Browser — Zero server uploads
//  • Visual Page Thumbnails Rendering
//  • Page-level Rotation, Reordering, Deletion
//  • Range Splitting & Page Burst to ZIP
//  • Multi-document Merging
// ══════════════════════════════════════════════════════════════

let _pdfjs = null

async function getPdfJs() {
  if (_pdfjs) return _pdfjs
  const pdfjsLib = await import('pdfjs-dist')
  // Configure worker
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).href
  }
  _pdfjs = pdfjsLib
  return _pdfjs
}

/**
 * Loads a PDF document using pdfjs-dist
 */
export async function loadPdfJsDocument(file) {
  const pdfjsLib = await getPdfJs()
  const buffer = await file.arrayBuffer()
  return await pdfjsLib.getDocument({ data: buffer }).promise
}

/**
 * Renders a single page to a thumbnail data URL (JPEG format for low memory footprint)
 */
export async function renderPageThumbnail(pdfJsDoc, pageNumber, targetWidth = 260) {
  const page = await pdfJsDoc.getPage(pageNumber)
  const unscaledViewport = page.getViewport({ scale: 1 })
  const scale = targetWidth / unscaledViewport.width
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d')

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

  // Clean canvas memory immediately
  canvas.width = 0
  canvas.height = 0

  return {
    dataUrl,
    width: unscaledViewport.width,
    height: unscaledViewport.height,
    aspectRatio: unscaledViewport.width / unscaledViewport.height,
  }
}

/**
 * Generates thumbnails for all pages of a PDF progressively
 */
export async function generateAllThumbnails(file, onProgress, onPageReady) {
  const pdfJsDoc = await loadPdfJsDocument(file)
  const totalPages = pdfJsDoc.numPages
  const pages = []

  for (let i = 1; i <= totalPages; i++) {
    const thumb = await renderPageThumbnail(pdfJsDoc, i)
    const pageItem = {
      pageNumber: i,
      originalIndex: i - 1,
      rotation: 0, // In increments of 90 (0, 90, 180, 270)
      deleted: false,
      selected: true,
      dataUrl: thumb.dataUrl,
      aspectRatio: thumb.aspectRatio,
    }
    pages.push(pageItem)
    onPageReady?.(pageItem, i, totalPages)
    onProgress?.(Math.round((i / totalPages) * 100))
  }

  return { totalPages, pages }
}

/**
 * Exports a modified PDF with custom page order, rotation, and deletions
 */
export async function exportCustomPdf(originalFile, pageItems, onProgress) {
  const { PDFDocument, degrees } = await import('pdf-lib')
  const srcBytes = await originalFile.arrayBuffer()
  const srcDoc = await PDFDocument.load(srcBytes)
  const newDoc = await PDFDocument.create()

  // Filter out deleted pages
  const activePages = pageItems.filter(p => !p.deleted)
  if (activePages.length === 0) {
    throw new Error('All pages have been deleted. At least one page is required.')
  }

  const total = activePages.length
  for (let i = 0; i < total; i++) {
    const item = activePages[i]
    // Copy the single page from srcDoc
    const [copiedPage] = await newDoc.copyPages(srcDoc, [item.originalIndex])

    // Apply cumulative rotation
    if (item.rotation) {
      const existingRotation = copiedPage.getRotation().angle || 0
      const newAngle = (existingRotation + item.rotation) % 360
      copiedPage.setRotation(degrees(newAngle))
    }

    newDoc.addPage(copiedPage)
    onProgress?.(Math.round(((i + 1) / total) * 90))
  }

  const pdfBytes = await newDoc.save()
  onProgress?.(100)
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

/**
 * Parses user range strings such as "1-3, 5, 8-10" into 0-indexed arrays
 */
export function parsePageRange(rangeStr, maxPages) {
  if (!rangeStr || !rangeStr.trim()) return []
  const parts = rangeStr.split(',').map(s => s.trim()).filter(Boolean)
  const indices = new Set()

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map(s => parseInt(s.trim(), 10))
      if (!isNaN(startStr) && !isNaN(endStr)) {
        const lo = Math.max(1, Math.min(startStr, endStr))
        const hi = Math.min(maxPages, Math.max(startStr, endStr))
        for (let i = lo; i <= hi; i++) {
          indices.add(i - 1)
        }
      }
    } else {
      const num = parseInt(part, 10)
      if (!isNaN(num) && num >= 1 && num <= maxPages) {
        indices.add(num - 1)
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b)
}

/**
 * Extracts specific page ranges into separate PDF documents bundled in a ZIP
 */
export async function splitPdfByRanges(originalFile, rangesList, onProgress) {
  const { PDFDocument } = await import('pdf-lib')
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  const srcBytes = await originalFile.arrayBuffer()
  const srcDoc = await PDFDocument.load(srcBytes)
  const maxPages = srcDoc.getPageCount()
  const baseName = originalFile.name.replace(/\.[^.]+$/, '')

  const total = rangesList.length
  for (let idx = 0; idx < total; idx++) {
    const rangeObj = rangesList[idx]
    const indices = parsePageRange(rangeObj.range, maxPages)
    if (indices.length === 0) continue

    const newDoc = await PDFDocument.create()
    const copiedPages = await newDoc.copyPages(srcDoc, indices)
    copiedPages.forEach(p => newDoc.addPage(p))

    const pdfBytes = await newDoc.save()
    const fileName = `${baseName}_part_${idx + 1}_(pages_${rangeObj.range.replace(/\s+/g, '')}).pdf`
    zip.file(fileName, pdfBytes)

    onProgress?.(Math.round(((idx + 1) / total) * 90))
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  onProgress?.(100)
  return zipBlob
}

/**
 * Bursts every page of a PDF into individual 1-page PDF files bundled in a ZIP
 */
export async function burstPdfPages(originalFile, onProgress) {
  const { PDFDocument } = await import('pdf-lib')
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  const srcBytes = await originalFile.arrayBuffer()
  const srcDoc = await PDFDocument.load(srcBytes)
  const numPages = srcDoc.getPageCount()
  const baseName = originalFile.name.replace(/\.[^.]+$/, '')

  for (let p = 0; p < numPages; p++) {
    const newDoc = await PDFDocument.create()
    const [copiedPage] = await newDoc.copyPages(srcDoc, [p])
    newDoc.addPage(copiedPage)

    const pdfBytes = await newDoc.save()
    const pageNumStr = String(p + 1).padStart(3, '0')
    zip.file(`${baseName}_page_${pageNumStr}.pdf`, pdfBytes)

    onProgress?.(Math.round(((p + 1) / numPages) * 90))
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  onProgress?.(100)
  return zipBlob
}

/**
 * Merges multiple PDF files in the specified order
 */
export async function mergeMultiplePdfs(files, onProgress) {
  const { PDFDocument } = await import('pdf-lib')
  const mergedPdf = await PDFDocument.create()
  const total = files.length

  for (let i = 0; i < total; i++) {
    const file = files[i]
    const buffer = await file.arrayBuffer()
    const doc = await PDFDocument.load(buffer)
    const pageIndices = doc.getPageIndices()
    const copiedPages = await mergedPdf.copyPages(doc, pageIndices)
    copiedPages.forEach(page => mergedPdf.addPage(page))
    onProgress?.(Math.round(((i + 1) / total) * 90))
  }

  const pdfBytes = await mergedPdf.save()
  onProgress?.(100)
  return new Blob([pdfBytes], { type: 'application/pdf' })
}
