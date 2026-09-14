// ══════════════════════════════════════════════════════════════
//  Filomer — conversionEngine.js
//
//  Full format support:
//   Images  → PNG JPG WEBP GIF BMP ICO AVIF PDF  (Canvas API)
//   SVG     → PNG JPG WEBP PDF                    (Canvas API)
//   HEIC    → JPG PNG WEBP                        (heic2any)
//   PDF     → PNG JPG WEBP ZIP                    (pdfjs + pdf-lib)
//   Video   → MP4 WEBM AVI MOV GIF MP3 WAV AAC   (ffmpeg.wasm — auto-loaded)
//   Audio   → MP3 WAV OGG AAC FLAC M4A            (ffmpeg.wasm — auto-loaded)
//  Special:
//   Images[] → single PDF                         (pdf-lib)
//   PDFs[]  → merged PDF                          (pdf-lib)
//   Any[]   → ZIP bundle                          (jszip)
//
//  ffmpeg loads silently on demand — no popups, no banners.
// ══════════════════════════════════════════════════════════════
import { getFFmpeg } from './utils/ffmpegLoader.js'

// ─── FILE SIZE LIMIT ──────────────────────────────────────────
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

// ─── FORMAT CATEGORIES ───────────────────────────────────────
export const FILE_CATEGORIES = {
  image: ['jpg','jpeg','png','webp','gif','bmp','tiff','tif','avif','ico'],
  svg:   ['svg'],
  heic:  ['heic','heif'],
  pdf:   ['pdf'],
  video: ['mp4','mkv','mov','avi','webm','flv','3gp','ts','wmv','m4v','ogv'],
  audio: ['mp3','wav','ogg','aac','flac','m4a','opus','wma','aiff','aif'],
}

/** Flat set of every supported extension (lowercase, no dot) */
export const SUPPORTED_EXTENSIONS = new Set(
  Object.values(FILE_CATEGORIES).flat()
)

/** Pre-built `accept` attribute for <input type="file"> — only shows supported files in the picker */
export const ACCEPT_STRING = Object.values(FILE_CATEGORIES)
  .flat()
  .map(e => `.${e}`)
  .join(',')

export const FORMAT_OPTIONS = {
  image: ['PNG','JPG','WEBP','GIF','BMP','AVIF','ICO','PDF'],
  svg:   ['PNG','JPG','WEBP','PDF'],
  heic:  ['JPG','PNG','WEBP'],
  pdf:   ['PNG','JPG','WEBP','ZIP'],
  video: ['MP4','WEBM','AVI','MOV','GIF','MP3','WAV','AAC'],
  audio: ['MP3','WAV','OGG','AAC','FLAC','M4A'],
}

export const DEFAULT_OUTPUT = {
  image: 'WEBP', svg: 'PNG', heic: 'JPG',
  pdf: 'PNG', video: 'MP4', audio: 'MP3',
}

// Categories that require ffmpeg (loaded silently on demand)
const HEAVY_CATEGORIES = new Set(['video', 'audio'])

export function getCategory(filename) {
  const e = filename.split('.').pop().toLowerCase()
  for (const [cat, exts] of Object.entries(FILE_CATEGORIES)) {
    if (exts.includes(e)) return cat
  }
  return 'unknown'
}

export function getDefaultOutput(filename) {
  return DEFAULT_OUTPUT[getCategory(filename)] || 'PDF'
}

/** Returns true if this category needs ffmpeg (will be auto-loaded) */
export function needsHeavyEngine(category) {
  return HEAVY_CATEGORIES.has(category)
}

// ─── CONSTANTS ────────────────────────────────────────────────

const MIME = {
  PNG:'image/png', JPG:'image/jpeg', WEBP:'image/webp',
  GIF:'image/gif', BMP:'image/bmp', AVIF:'image/avif',
  ICO:'image/x-icon', PDF:'application/pdf',
  MP3:'audio/mpeg', WAV:'audio/wav', OGG:'audio/ogg',
  AAC:'audio/aac', FLAC:'audio/flac', M4A:'audio/mp4',
  MP4:'video/mp4', WEBM:'video/webm', AVI:'video/x-msvideo',
  MOV:'video/quicktime', ZIP:'application/zip',
}

// Issue #10: PDF rendering safety limits — no page cap (local-first), but each
// page is scaled to a sensible max width and capped at 16 MP to prevent OOM.
const MAX_CANVAS_PIXELS = 16_000_000
const PDF_MAX_OUT_WIDTH = { PNG: 4096, JPG: 2048, WEBP: 2048 }

const FFMPEG_PRESETS = {
  MP3:  ['-c:a','libmp3lame','-q:a','2'],
  WAV:  ['-c:a','pcm_s16le'],
  OGG:  ['-c:a','libvorbis','-q:a','5'],
  AAC:  ['-c:a','aac','-b:a','192k'],
  FLAC: ['-c:a','flac'],
  M4A:  ['-c:a','aac','-b:a','192k'],
  MP4:  ['-c:v','libx264','-crf','20','-preset','fast','-c:a','aac','-movflags','+faststart'],
  WEBM: ['-c:v','libvpx-vp9','-crf','28','-b:v','0','-c:a','libvorbis'],
  AVI:  ['-c:v','mpeg4','-q:v','5','-c:a','mp3'],
  MOV:  ['-c:v','libx264','-crf','20','-c:a','aac','-movflags','faststart'],
}

// ─── FFMPEG SINGLETON — loads silently on demand via ffmpegLoader ─────
/**
 * Silently load ffmpeg on demand. Uses CacheStorage + multi-CDN fallback.
 * Multiple callers get the same promise (deduped).
 */
async function getFF(onProgress, onEngineProgress) {
  return getFFmpeg({ onDownloadProgress: onEngineProgress, onProgress })
}

// ─── HELPERS ──────────────────────────────────────────────────
function ext(file) { return file.name.split('.').pop().toLowerCase() }

// ─── ANIMATED GIF DETECTOR ────────────────────────────────────
/**
 * Returns true if the file is an animated GIF (more than one
 * Graphic Control Extension block, magic: 0x21 0xF9).
 * Reads at most the first 64 KB for efficiency.
 */
export async function isAnimatedGIF(file) {
  const buffer = await file.slice(0, 65536).arrayBuffer()
  const bytes  = new Uint8Array(buffer)
  let gcCount  = 0
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9) {
      if (++gcCount > 1) return true
    }
  }
  return false
}

// ─── BMP ENCODER (pure JS) ────────────────────────────────────
// Canvas.toBlob does NOT support image/bmp in any major browser — it silently
// falls back to PNG. This minimal encoder writes a 24-bit BMP directly from
// the canvas ImageData, producing a valid BMP that opens in every viewer.
function canvasToBMPBlob(canvas) {
  const ctx  = canvas.getContext('2d')
  const idat = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const W = canvas.width, H = canvas.height

  // BMP rows are padded to a 4-byte boundary and stored bottom-up.
  const rowStride  = Math.ceil(W * 3 / 4) * 4
  const pixelBytes = rowStride * H
  const fileSize   = 54 + pixelBytes          // 14-byte file header + 40-byte DIB header

  const buf  = new ArrayBuffer(fileSize)
  const view = new DataView(buf)

  // ── File header ──────────────────────────────────────────────
  view.setUint16(0,  0x424D, false)            // 'BM' signature (big-endian)
  view.setUint32(2,  fileSize,   true)         // file size
  view.setUint32(6,  0,          true)         // reserved
  view.setUint32(10, 54,         true)         // pixel data offset

  // ── DIB header (BITMAPINFOHEADER, 40 bytes) ──────────────────
  view.setUint32(14, 40, true)                 // header size
  view.setInt32 (18, W,  true)                 // width
  view.setInt32 (22, -H, true)                 // negative height → top-down
  view.setUint16(26, 1,  true)                 // colour planes
  view.setUint16(28, 24, true)                 // bits per pixel (RGB24)
  view.setUint32(30, 0,  true)                 // compression (none)
  view.setUint32(34, pixelBytes, true)         // raw image size
  view.setInt32 (38, 2835, true)               // X pixels/metre (~72 dpi)
  view.setInt32 (42, 2835, true)               // Y pixels/metre
  view.setUint32(46, 0, true)                  // colours in table
  view.setUint32(50, 0, true)                  // important colours

  // ── Pixel data — RGB24, row-padded ──────────────────────────
  const bytes = new Uint8Array(buf)
  const src   = idat.data                      // RGBA source
  for (let y = 0; y < H; y++) {
    const rowOff = 54 + y * rowStride
    for (let x = 0; x < W; x++) {
      const si = (y * W + x) * 4
      const di = rowOff + x * 3
      bytes[di]     = src[si + 2]              // B
      bytes[di + 1] = src[si + 1]              // G
      bytes[di + 2] = src[si]                  // R
    }
  }

  return new Blob([buf], { type: 'image/bmp' })
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function imageToBlob(file, format, quality = 0.92, targetW, targetH) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const aspect = img.naturalWidth / img.naturalHeight
      let w = targetW || img.naturalWidth
      let h = targetH || img.naturalHeight
      if (targetW && !targetH) h = Math.round(targetW / aspect)
      if (targetH && !targetW) w = Math.round(targetH * aspect)

      // BUG-8/9: clamp dimensions — reject zero/negative values, cap per-side
      // at 16 384 px and proportionally reduce if total pixel count exceeds 50 MP.
      const MAX_DIM = 16_384
      const MAX_PIX = 50_000_000
      w = Math.max(1, Math.min(Math.round(w), MAX_DIM))
      h = Math.max(1, Math.min(Math.round(h), MAX_DIM))
      const totalPix = w * h
      if (totalPix > MAX_PIX) {
        const s = Math.sqrt(MAX_PIX / totalPix)
        w = Math.max(1, Math.round(w * s))
        h = Math.max(1, Math.round(h * s))
      }

      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      // BMP and JPG need an opaque white background (no alpha channel)
      if (format === 'JPG' || format === 'BMP') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
      }
      ctx.drawImage(img, 0, 0, w, h)

      URL.revokeObjectURL(url)

      // Fix #2: BMP — Canvas.toBlob ignores 'image/bmp' in all browsers and
      // silently produces PNG bytes. Use our pure-JS encoder instead.
      if (format === 'BMP') {
        resolve(canvasToBMPBlob(canvas))
        return
      }

      // Fix #3: AVIF — if the browser doesn't support AVIF encoding, toBlob
      // returns null (or a tiny broken blob). Fall back to WEBP and tag the
      // blob so the caller can set the correct download extension.
      if (format === 'AVIF') {
        canvas.toBlob(b => {
          if (b && b.size > 100) { resolve(b); return }
          // AVIF not supported — produce WEBP and signal the actual format.
          canvas.toBlob(fb => {
            if (fb) fb._actualExt = 'webp'
            resolve(fb)
          }, 'image/webp', 0.85)
        }, 'image/avif', 0.8)
        return
      }

      // Fix #2: GIF — Canvas.toBlob ignores 'image/gif' in all browsers and
      // silently produces PNG bytes. Fall back to WEBP and tag the blob so
      // the caller sets the right extension. (True animated GIF encoding from
      // video sources already works correctly via FFmpeg.)
      if (format === 'GIF') {
        canvas.toBlob(b => {
          // Detect PNG fallback: GIF magic bytes are 47 49 46 ('GIF');
          // PNG magic bytes start with 0x89 0x50 ('\x89PNG').
          if (b && b.size > 0) {
            const reader = new FileReader()
            reader.onload = ev => {
              const arr = new Uint8Array(ev.target.result)
              // If the browser actually produced a GIF, use it as-is.
              if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46) {
                resolve(b)
              } else {
                // Browser produced PNG bytes — fall back to WEBP
                canvas.toBlob(wb => {
                  if (wb) wb._actualExt = 'webp'
                  resolve(wb)
                }, 'image/webp', 0.85)
              }
            }
            reader.readAsArrayBuffer(b.slice(0, 4))
          } else {
            canvas.toBlob(wb => {
              if (wb) wb._actualExt = 'webp'
              resolve(wb)
            }, 'image/webp', 0.85)
          }
        }, 'image/gif')
        return
      }

      const mime = MIME[format] || 'image/png'
      const q = ['PNG', 'ICO'].includes(format) ? 1 : quality
      canvas.toBlob(b => {
        b ? resolve(b) : reject(new Error('Canvas toBlob failed'))
      }, mime, q)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

// ─── RASTER IMAGE CONVERSION ─────────────────────────────────
export async function convertImage(file, format, quality = 85, resizeW, resizeH) {
  if (format === 'ICO') return createICO(file)
  if (format === 'PDF') return singleImageToPDF(file)
  return imageToBlob(file, format, quality / 100, resizeW, resizeH)
}

// ─── SVG → RASTER ────────────────────────────────────────────
// Issue #8: quality and resize are now respected.
export async function convertSVG(file, format, quality = 92, resizeW, resizeH) {
  if (format === 'PDF') return singleImageToPDF(file)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const svgText = e.target.result
      const parser  = new DOMParser()
      const doc     = parser.parseFromString(svgText, 'image/svg+xml')
      const svgEl   = doc.querySelector('svg')
      const vb      = svgEl?.getAttribute('viewBox')?.split(/[\s,]/).map(Number)
      const naturalW = parseFloat(svgEl?.getAttribute('width'))  || (vb ? vb[2] : 800)
      const naturalH = parseFloat(svgEl?.getAttribute('height')) || (vb ? vb[3] : 600)

      // Apply resize if requested, preserving aspect ratio when only one dim given
      const aspect = naturalW / naturalH
      let w = resizeW || naturalW
      let h = resizeH || naturalH
      if (resizeW && !resizeH) h = Math.round(resizeW / aspect)
      if (resizeH && !resizeW) w = Math.round(resizeH * aspect)

      const blob = new Blob([svgText], { type:'image/svg+xml;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const img  = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(w, 1); canvas.height = Math.max(h, 1)
        const ctx = canvas.getContext('2d')
        if (format === 'JPG') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const mime = MIME[format] || 'image/png'
        const q    = format === 'PNG' ? 1 : quality / 100
        canvas.toBlob(b => {
          URL.revokeObjectURL(url)
          b ? resolve(b) : reject(new Error('SVG render failed'))
        }, mime, q)
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG load failed')) }
      img.src = url
    }
    reader.readAsText(file)
  })
}

// ─── HEIC → RASTER ───────────────────────────────────────────
// Issue #7: quality and resize are now respected.
export async function convertHEIC(file, format, quality = 92, resizeW, resizeH) {
  const heic2any = (await import('heic2any')).default
  const mime     = MIME[format] || 'image/jpeg'
  const result   = await heic2any({ blob: file, toType: mime, quality: quality / 100 })
  const blob     = Array.isArray(result) ? result[0] : result
  // Apply resize by piping the decoded blob through imageToBlob at target dims
  if (resizeW || resizeH) {
    return imageToBlob(blob, format, quality / 100, resizeW, resizeH)
  }
  return blob
}

// ─── ICO GENERATION ──────────────────────────────────────────
// BUG-E: accepts an optional resizeW to produce a custom-size ICO (e.g. 256px
// for app icons) instead of always generating the fixed 16/32/48/64 set.
export async function createICO(file, resizeW) {
  // If the user specified a target width, use only that size; otherwise the
  // standard favicon set. Clamp to the ICO maximum of 256 px.
  const SIZES = resizeW
    ? [Math.max(1, Math.min(256, Math.round(resizeW)))]
    : [16, 32, 48, 64]
  const pngData = []

  for (const size of SIZES) {
    const blob = await imageToBlob(file, 'PNG', 1, size, size)
    pngData.push(new Uint8Array(await blob.arrayBuffer()))
  }

  const count = SIZES.length
  const headerSize = 6 + count * 16
  let totalSize = headerSize
  pngData.forEach(p => totalSize += p.length)

  const buf = new ArrayBuffer(totalSize)
  const view = new DataView(buf)
  view.setUint16(0, 0, true)
  view.setUint16(2, 1, true)
  view.setUint16(4, count, true)

  let offset = headerSize
  pngData.forEach((png, i) => {
    const size = SIZES[i]
    const e = 6 + i * 16
    view.setUint8(e, size === 256 ? 0 : size)
    view.setUint8(e + 1, size === 256 ? 0 : size)
    view.setUint8(e + 2, 0)
    view.setUint8(e + 3, 0)
    view.setUint16(e + 4, 1, true)
    view.setUint16(e + 6, 32, true)
    view.setUint32(e + 8, png.length, true)
    view.setUint32(e + 12, offset, true)
    new Uint8Array(buf, offset, png.length).set(png)
    offset += png.length
  })

  return new Blob([buf], { type: 'image/x-icon' })
}

// ─── SINGLE IMAGE → PDF ──────────────────────────────────────
export async function singleImageToPDF(file) {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  let imgBytes, imgType
  const fileExt = ext(file)
  if (['jpg','jpeg'].includes(fileExt)) {
    imgBytes = new Uint8Array(await file.arrayBuffer()); imgType = 'jpg'
  } else {
    const blob = await imageToBlob(file, 'PNG', 1)
    imgBytes = new Uint8Array(await blob.arrayBuffer()); imgType = 'png'
  }
  const embImg = imgType === 'jpg' ? await doc.embedJpg(imgBytes) : await doc.embedPng(imgBytes)
  const page = doc.addPage([embImg.width, embImg.height])
  page.drawImage(embImg, { x:0, y:0, width:embImg.width, height:embImg.height })
  const bytes = await doc.save()
  return new Blob([bytes], { type:'application/pdf' })
}

// ─── MULTIPLE IMAGES → SINGLE PDF ────────────────────────────
// BUG-A: HEIC files cannot be drawn to a canvas directly — they must be
// decoded through heic2any before being embedded in the PDF.
export async function imagesToPDF(files, onProgress) {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const fileExt = ext(file)
    let imgBytes, imgType
    if (['jpg','jpeg'].includes(fileExt)) {
      imgBytes = new Uint8Array(await file.arrayBuffer()); imgType = 'jpg'
    } else if (['heic','heif'].includes(fileExt)) {
      // Decode HEIC via heic2any; embed result as JPEG
      const heic2any = (await import('heic2any')).default
      const decoded  = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
      const decoded0 = Array.isArray(decoded) ? decoded[0] : decoded
      imgBytes = new Uint8Array(await decoded0.arrayBuffer()); imgType = 'jpg'
    } else {
      const blob = await imageToBlob(file, 'PNG', 1)
      if (!blob) throw new Error(`Failed to decode ${file.name} for PDF`)
      imgBytes = new Uint8Array(await blob.arrayBuffer()); imgType = 'png'
    }
    const embImg = imgType === 'jpg' ? await doc.embedJpg(imgBytes) : await doc.embedPng(imgBytes)
    const page = doc.addPage([embImg.width, embImg.height])
    page.drawImage(embImg, { x:0, y:0, width:embImg.width, height:embImg.height })
    onProgress?.(Math.round(((i + 1) / files.length) * 100))
  }
  const bytes = await doc.save()
  return new Blob([bytes], { type:'application/pdf' })
}

// ─── PDF → IMAGES ────────────────────────────────────────────
export async function pdfToImages(file, format, onProgress) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href

  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const blobs = []
  const mime = format === 'JPG' ? 'image/jpeg' : format === 'WEBP' ? 'image/webp' : 'image/png'
  const q = format === 'JPG' ? 0.92 : format === 'WEBP' ? 0.85 : 1

  // Adaptive scale — target a sensible max width, clamp to 16 MP
  const maxW = PDF_MAX_OUT_WIDTH[format] || 2048

  for (let p = 1; p <= pdf.numPages; p++) {
    const page      = await pdf.getPage(p)
    const naturalVp = page.getViewport({ scale: 1.0 })
    let   scale     = Math.min(maxW / naturalVp.width, 4.0)
    const projW = naturalVp.width  * scale
    const projH = naturalVp.height * scale
    if (projW * projH > MAX_CANVAS_PIXELS) {
      scale *= Math.sqrt(MAX_CANVAS_PIXELS / (projW * projH))
    }
    const viewport = page.getViewport({ scale })
    const canvas   = document.createElement('canvas')
    canvas.width   = Math.round(viewport.width)
    canvas.height  = Math.round(viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    // BUG-10: guard against toBlob returning null under memory pressure
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(new Error(`Page ${p} render failed`)), mime, q)
    )
    blobs.push(blob)
    // BUG-F: free canvas backing buffer immediately after extracting the blob
    canvas.width = 0; canvas.height = 0
    onProgress?.(Math.round((p / pdf.numPages) * 100))
  }
  if (blobs.length === 1) return blobs[0]
  // Multi-page result: pack into ZIP and tag so caller uses .zip extension
  // BUG-16: pass source file's basename so pages are named <doc>_001.png, not file_001.png
  const base = file.name.replace(/\.[^.]+$/, '')
  const zipResult = await zipBlobs(blobs, format.toLowerCase(), base)
  zipResult._actualExt = 'zip'
  return zipResult
}

// ─── MERGE PDFs ──────────────────────────────────────────────
export async function mergePDFs(files, onProgress) {
  const { PDFDocument } = await import('pdf-lib')
  const merged = await PDFDocument.create()
  for (let i = 0; i < files.length; i++) {
    const bytes = new Uint8Array(await files[i].arrayBuffer())
    const srcDoc = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(srcDoc, srcDoc.getPageIndices())
    pages.forEach(p => merged.addPage(p))
    onProgress?.(Math.round(((i + 1) / files.length) * 95))
  }
  const bytes = await merged.save()
  onProgress?.(100)
  return new Blob([bytes], { type:'application/pdf' })
}

// ─── PDF → ZIP ───────────────────────────────────────────────
export async function pdfToZip(file, format, onProgress) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href

  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const mime = format === 'JPG' ? 'image/jpeg' : 'image/png'
  const q = format === 'JPG' ? 0.92 : 1
  const extStr = format.toLowerCase()
  const base = file.name.replace(/\.[^.]+$/, '')

  const maxW = PDF_MAX_OUT_WIDTH[format] || 2048

  for (let p = 1; p <= pdf.numPages; p++) {
    const page      = await pdf.getPage(p)
    const naturalVp = page.getViewport({ scale: 1.0 })
    let   scale     = Math.min(maxW / naturalVp.width, 4.0)
    const projW = naturalVp.width  * scale
    const projH = naturalVp.height * scale
    if (projW * projH > MAX_CANVAS_PIXELS) {
      scale *= Math.sqrt(MAX_CANVAS_PIXELS / (projW * projH))
    }
    const viewport = page.getViewport({ scale })
    const canvas   = document.createElement('canvas')
    canvas.width   = Math.round(viewport.width)
    canvas.height  = Math.round(viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    // BUG-10: guard null toBlob
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(new Error(`Page ${p} render failed`)), mime, q)
    )
    zip.file(`${base}_page${String(p).padStart(3,'0')}.${extStr}`, blob)
    // BUG-F: free canvas memory immediately
    canvas.width = 0; canvas.height = 0
    onProgress?.(Math.round((p / pdf.numPages) * 90))
  }
  const zipBlob = await zip.generateAsync({ type:'blob', compression:'DEFLATE' })
  // BUG-I: tag so callers know this is a ZIP regardless of the format requested
  zipBlob._actualExt = 'zip'
  onProgress?.(100)
  return zipBlob
}

// ─── VIDEO / AUDIO (ffmpeg — auto-loaded silently) ───────────
// BUG-11: all three AV functions use try/finally so the progress listener
// and temp files are always cleaned up, even when an error is thrown.
// BUG-C: filenames include a timestamp so concurrent calls don't collide.
export async function convertAV(file, format, onProgress, onEngineProgress) {
  const ff = await getFF(onProgress, onEngineProgress)
  const { fetchFile } = await import('@ffmpeg/util')
  const ts    = Date.now()
  const inExt = ext(file)
  const outExt = format.toLowerCase()
  const inFile = `src_${ts}.${inExt}`, outFile = `out_${ts}.${outExt}`

  const ph = ({ progress: p }) => onProgress?.(Math.min(99, Math.round(p * 100)))
  ff.on('progress', ph)
  try {
    await ff.writeFile(inFile, await fetchFile(file))
    await ff.exec(['-i', inFile, ...(FFMPEG_PRESETS[format] || []), '-y', outFile])
    const data = await ff.readFile(outFile)
    onProgress?.(100)
    return new Blob([data.buffer], { type: MIME[format] || 'application/octet-stream' })
  } finally {
    ff.off('progress', ph)
    await ff.deleteFile(inFile).catch(() => {})
    await ff.deleteFile(outFile).catch(() => {})
  }
}

// ─── VIDEO → GIF ─────────────────────────────────────────────
export async function videoToGIF(file, quality = 'medium', onProgress, onEngineProgress) {
  const ff = await getFF(onProgress, onEngineProgress)
  const { fetchFile } = await import('@ffmpeg/util')
  const fps   = { low:6, medium:12, high:20 }[quality] || 12
  const scale = { low:320, medium:480, high:640 }[quality] || 480
  const ts    = Date.now()
  const inExt = ext(file)
  const inFile  = `gifin_${ts}.${inExt}`
  const palette = `pal_${ts}.png`
  const outFile = `gif_${ts}.gif`

  const ph = ({ progress: p }) => onProgress?.(Math.min(95, Math.round(p * 100)))
  ff.on('progress', ph)
  try {
    await ff.writeFile(inFile, await fetchFile(file))
    await ff.exec(['-i', inFile, '-vf', `fps=${fps},scale=${scale}:-1:flags=lanczos,palettegen=stats_mode=diff`, '-y', palette])
    await ff.exec(['-i', inFile, '-i', palette, '-lavfi', `fps=${fps},scale=${scale}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer`, '-y', outFile])
    const data = await ff.readFile(outFile)
    onProgress?.(100)
    return new Blob([data.buffer], { type:'image/gif' })
  } finally {
    ff.off('progress', ph)
    await ff.deleteFile(inFile).catch(() => {})
    await ff.deleteFile(outFile).catch(() => {})
    await ff.deleteFile(palette).catch(() => {})
  }
}

// ─── EXTRACT AUDIO FROM VIDEO ────────────────────────────────
export async function extractAudio(file, format, onProgress, onEngineProgress) {
  const ff = await getFF(onProgress, onEngineProgress)
  const { fetchFile } = await import('@ffmpeg/util')
  const ts    = Date.now()
  const inExt = ext(file)
  const outExt = format.toLowerCase()
  const inFile  = `vid_${ts}.${inExt}`, outFile = `audio_${ts}.${outExt}`
  // BUG-B: include FLAC and M4A so they don't silently fall back to MP3
  const presets = {
    MP3:  FFMPEG_PRESETS.MP3,
    WAV:  FFMPEG_PRESETS.WAV,
    AAC:  FFMPEG_PRESETS.AAC,
    OGG:  FFMPEG_PRESETS.OGG,
    FLAC: FFMPEG_PRESETS.FLAC,
    M4A:  FFMPEG_PRESETS.M4A,
  }

  const ph = ({ progress: p }) => onProgress?.(Math.min(99, Math.round(p * 100)))
  ff.on('progress', ph)
  try {
    await ff.writeFile(inFile, await fetchFile(file))
    await ff.exec(['-i', inFile, ...(presets[format] || FFMPEG_PRESETS.MP3), '-vn', '-y', outFile])
    const data = await ff.readFile(outFile)
    onProgress?.(100)
    return new Blob([data.buffer], { type: MIME[format] || 'audio/mpeg' })
  } finally {
    ff.off('progress', ph)
    await ff.deleteFile(inFile).catch(() => {})
    await ff.deleteFile(outFile).catch(() => {})
  }
}

// ─── ZIP BUNDLE ──────────────────────────────────────────────
export async function zipBlobs(blobs, ext, baseName = 'file') {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  blobs.forEach((blob, i) => {
    zip.file(`${baseName}_${String(i + 1).padStart(3, '0')}.${ext}`, blob)
  })
  return zip.generateAsync({ type:'blob', compression:'DEFLATE' })
}

export async function zipFiles(fileMap) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (const [name, blob] of Object.entries(fileMap)) {
    zip.file(name, blob)
  }
  return zip.generateAsync({ type:'blob', compression:'DEFLATE' })
}

// ─── MASTER ROUTER ────────────────────────────────────────────
const AUDIO_FORMATS = new Set(['MP3','WAV','OGG','AAC','FLAC','M4A'])

export async function convertFile(file, format, options = {}) {
  const { quality = 85, resizeW, resizeH, gifQuality = 'medium', onProgress, onEngineProgress } = options
  const cat = getCategory(file.name)

  if (cat === 'unknown') throw new Error(`Unsupported file format: .${ext(file)}`)

  // Issues #7 & #8: pass quality + resize through to HEIC and SVG converters
  if (cat === 'heic')  return convertHEIC(file, format, quality, resizeW, resizeH)
  if (cat === 'svg')   return convertSVG(file, format, quality, resizeW, resizeH)
  if (cat === 'image') {
    // BUG-E: pass resizeW through so createICO can produce a custom-size icon
    if (format === 'ICO') return createICO(file, resizeW)
    if (format === 'PDF') return singleImageToPDF(file)
    return convertImage(file, format, quality, resizeW, resizeH)
  }
  if (cat === 'pdf') {
    if (format === 'ZIP') return pdfToZip(file, 'PNG', onProgress)
    return pdfToImages(file, format, onProgress)
  }
  if (cat === 'video') {
    if (format === 'GIF') return videoToGIF(file, gifQuality, onProgress, onEngineProgress)
    if (AUDIO_FORMATS.has(format)) return extractAudio(file, format, onProgress, onEngineProgress)
    return convertAV(file, format, onProgress, onEngineProgress)
  }
  if (cat === 'audio') return convertAV(file, format, onProgress, onEngineProgress)

  throw new Error(`No converter for .${ext(file)} → ${format}`)
}
