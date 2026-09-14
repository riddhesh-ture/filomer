// compressionEngine.js — plain JS (no TypeScript)
// Compresses files to a target byte size

import { getFFmpeg } from './utils/ffmpegLoader.js'

// ─── Helpers ─────────────────────────────────────────────────
function getFileExt(file) {
  return file.name.split('.').pop().toLowerCase()
}

export function getCategory(file) {
  const ext = getFileExt(file)
  if (['jpg','jpeg','png','webp','gif','bmp','avif','heic','ico','tiff','svg'].includes(ext)) return 'image'
  if (['mp4','webm','mkv','avi','mov','ogv','flv'].includes(ext)) return 'video'
  if (['mp3','wav','ogg','aac','flac','m4a','opus'].includes(ext)) return 'audio'
  if (ext === 'pdf') return 'pdf'
  return 'unknown'
}

// FIX-11: attach handlers BEFORE setting src so metadata events aren't missed.
function getMediaDuration(file) {
  return new Promise(resolve => {
    const el  = file.type.startsWith('video')
      ? document.createElement('video')
      : document.createElement('audio')
    const url = URL.createObjectURL(file)
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(el.duration) }
    el.onerror          = () => { URL.revokeObjectURL(url); resolve(60) }
    el.src = url   // set AFTER handlers are attached
  })
}

// FIX-8/9: clamp canvas dimensions to prevent OOM on very large images.
const MAX_IMG_DIM = 16_384
const MAX_IMG_PIX = 50_000_000

function imageToBlob(file, format, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      let w = img.naturalWidth
      let h = img.naturalHeight

      // Clamp dimensions
      w = Math.max(1, Math.min(Math.round(w), MAX_IMG_DIM))
      h = Math.max(1, Math.min(Math.round(h), MAX_IMG_DIM))
      const totalPix = w * h
      if (totalPix > MAX_IMG_PIX) {
        const s = Math.sqrt(MAX_IMG_PIX / totalPix)
        w = Math.max(1, Math.round(w * s))
        h = Math.max(1, Math.round(h * s))
      }

      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (format === 'JPG') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h) }
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      const mime = format === 'WEBP' ? 'image/webp' : 'image/jpeg'
      // FIX-10: guard against toBlob returning null under memory pressure
      canvas.toBlob(blob => {
        canvas.width = 0; canvas.height = 0   // free backing buffer immediately
        blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))
      }, mime, quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

// ─── Image compressor ─────────────────────────────────────────
// FIX-9: lossless mode consistently uses WEBP at quality=1 (was setting
//        outputFormat='PNG' but then calling imageToBlob with 'WEBP').
async function compressImage(file, targetBytes, mode, onProgress) {
  if (mode === 'lossless') {
    onProgress?.(50)
    const blob = await imageToBlob(file, 'WEBP', 1.0)
    onProgress?.(100)
    return {
      blob,
      quality: 100,
      note: blob.size > targetBytes
        ? 'Lossless — cannot hit target without lossy compression'
        : undefined,
    }
  }
  const outputFormat = 'WEBP'
  const minQ = mode === 'aggressive' ? 1 : 10
  const maxQ = mode === 'aggressive' ? 70 : 95
  onProgress?.(5)
  const minBlob = await imageToBlob(file, outputFormat, minQ / 100)
  if (minBlob.size > targetBytes) {
    onProgress?.(100)
    return { blob: minBlob, quality: minQ, warning: `Cannot reach target (min size: ${(minBlob.size/1048576).toFixed(2)} MB)` }
  }
  const maxBlob = await imageToBlob(file, outputFormat, maxQ / 100)
  if (maxBlob.size <= targetBytes) {
    onProgress?.(100)
    return { blob: maxBlob, quality: maxQ, note: 'Already under target — saved at high quality' }
  }
  let lo = minQ, hi = maxQ, bestBlob = minBlob, bestQuality = minQ, step = 0
  while (lo <= hi) {
    const mid = Math.round((lo + hi) / 2)
    onProgress?.(5 + Math.round((step / 10) * 90))
    step++
    const blob = await imageToBlob(file, outputFormat, mid / 100)
    if (blob.size <= targetBytes) { bestBlob = blob; bestQuality = mid; lo = mid + 1 }
    else { hi = mid - 1 }
    if (step >= 10) break
  }
  onProgress?.(100)
  return { blob: bestBlob, quality: bestQuality }
}

// ─── Video compressor ─────────────────────────────────────────
// FIX-3: try/finally ensures listener + temp files are always cleaned up.
// FIX-4: timestamp suffix prevents filename collisions on concurrent calls.
async function compressVideo(file, targetBytes, mode, onProgress) {
  const ff = await getFFmpeg()
  const { fetchFile } = await import('@ffmpeg/util')
  const duration      = await getMediaDuration(file)
  const audioBitrateK = mode === 'aggressive' ? 64 : 96
  const totalBitrateK = (targetBytes * 8) / 1000 / duration
  const videoBitrateK = Math.max(100, Math.floor(totalBitrateK - audioBitrateK))
  const ts      = Date.now()
  const ext     = getFileExt(file)
  const inFile  = `vin_${ts}.${ext}`
  const outFile = `vout_${ts}.mp4`

  const ph = ({ progress: p }) => onProgress?.(Math.min(99, Math.round(p * 100)))
  ff.on('progress', ph)
  try {
    await ff.writeFile(inFile, await fetchFile(file))
    await ff.exec(['-i', inFile, '-c:v', 'libx264', '-b:v', `${videoBitrateK}k`, '-c:a', 'aac', '-b:a', `${audioBitrateK}k`, '-movflags', '+faststart', '-y', outFile])
    const data = await ff.readFile(outFile)
    onProgress?.(100)
    const blob = new Blob([data.buffer], { type: 'video/mp4' })
    return { blob, warning: blob.size > targetBytes ? `Could not reach target — file is ${(blob.size/1048576).toFixed(2)} MB` : undefined }
  } finally {
    ff.off('progress', ph)
    await ff.deleteFile(inFile).catch(() => {})
    await ff.deleteFile(outFile).catch(() => {})
  }
}

// ─── Audio compressor ─────────────────────────────────────────
async function compressAudio(file, targetBytes, mode, onProgress) {
  const ff = await getFFmpeg()
  const { fetchFile } = await import('@ffmpeg/util')
  const duration    = await getMediaDuration(file)
  const totalBitrateK = (targetBytes * 8) / 1000 / duration
  const bitrateK    = Math.min(320, Math.max(mode === 'aggressive' ? 32 : 64, Math.floor(totalBitrateK)))
  const ts      = Date.now()
  const ext     = getFileExt(file)
  const inFile  = `ain_${ts}.${ext}`
  const outFile = `aout_${ts}.mp3`

  const ph = ({ progress: p }) => onProgress?.(Math.min(99, Math.round(p * 100)))
  ff.on('progress', ph)
  try {
    await ff.writeFile(inFile, await fetchFile(file))
    await ff.exec(['-i', inFile, '-codec:a', 'libmp3lame', '-b:a', `${bitrateK}k`, '-y', outFile])
    const data = await ff.readFile(outFile)
    onProgress?.(100)
    return { blob: new Blob([data.buffer], { type: 'audio/mpeg' }) }
  } finally {
    ff.off('progress', ph)
    await ff.deleteFile(inFile).catch(() => {})
    await ff.deleteFile(outFile).catch(() => {})
  }
}

// ─── PDF compressor ───────────────────────────────────────────
// FIX-5: canvas.toBlob null is rejected immediately with a clear error.
// FIX-6: adaptive pixel cap prevents OOM on large pages.
// FIX-7: lossless mode uses higher quality + PNG fallback; lossy modes use JPEG.
const MAX_PDF_CANVAS_PIX = 16_000_000

async function compressPDF(file, targetBytes, mode, onProgress) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href
  const { PDFDocument } = await import('pdf-lib')
  const buffer = await file.arrayBuffer()
  const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise

  // FIX-7: lossless uses JPEG at very high quality (PDF doesn't support PNG
  // embedding via pdf-lib's simple API); aggressive/smart use progressively
  // lower quality and scale to hit the target.
  const attempts = mode === 'lossless'
    ? [{ scale: 2.0, quality: 0.97, mime: 'image/jpeg' }]
    : mode === 'aggressive'
    ? [
        { scale: 1.0, quality: 0.60, mime: 'image/jpeg' },
        { scale: 0.7, quality: 0.45, mime: 'image/jpeg' },
        { scale: 0.5, quality: 0.30, mime: 'image/jpeg' },
      ]
    : [
        { scale: 1.5, quality: 0.80, mime: 'image/jpeg' },
        { scale: 1.0, quality: 0.65, mime: 'image/jpeg' },
        { scale: 0.7, quality: 0.45, mime: 'image/jpeg' },
      ]

  let lastBlob = null
  for (let ai = 0; ai < attempts.length; ai++) {
    const { scale: baseScale, quality, mime } = attempts[ai]
    const pageImages = []

    for (let p = 1; p <= pdf.numPages; p++) {
      const page      = await pdf.getPage(p)
      const naturalVp = page.getViewport({ scale: 1.0 })
      // FIX-6: compute adaptive scale — never exceed MAX_PDF_CANVAS_PIX per page
      let   scale     = baseScale
      const projW = naturalVp.width  * scale
      const projH = naturalVp.height * scale
      if (projW * projH > MAX_PDF_CANVAS_PIX) {
        scale *= Math.sqrt(MAX_PDF_CANVAS_PIX / (projW * projH))
      }
      const viewport = page.getViewport({ scale })
      const canvas   = document.createElement('canvas')
      canvas.width   = Math.round(viewport.width)
      canvas.height  = Math.round(viewport.height)
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      // FIX-5: validate toBlob result
      const imgBlob = await new Promise((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new Error(`Page ${p} render failed`)), mime, quality)
      )
      // FIX-6/F: free canvas backing buffer immediately
      canvas.width = 0; canvas.height = 0
      const imgBuf = await imgBlob.arrayBuffer()
      pageImages.push({ data: new Uint8Array(imgBuf), width: Math.round(viewport.width), height: Math.round(viewport.height) })
      onProgress?.(Math.round(((ai / attempts.length) + (p / pdf.numPages / attempts.length)) * 90))
    }

    const newDoc = await PDFDocument.create()
    for (const { data, width, height } of pageImages) {
      const img  = await newDoc.embedJpg(data)
      const page = newDoc.addPage([width, height])
      page.drawImage(img, { x: 0, y: 0, width, height })
    }
    const bytes = await newDoc.save()
    lastBlob = new Blob([bytes], { type: 'application/pdf' })
    if (lastBlob.size <= targetBytes) { onProgress?.(100); return { blob: lastBlob } }
  }
  onProgress?.(100)
  return {
    blob: lastBlob,
    warning: lastBlob && lastBlob.size > targetBytes
      ? `Could not reach target — best: ${(lastBlob.size/1048576).toFixed(2)} MB`
      : undefined,
  }
}

// ─── Public API ───────────────────────────────────────────────
export async function compressToTarget(file, targetBytes, mode = 'smart', onProgress) {
  const cat = getCategory(file)
  if (file.size <= targetBytes) {
    return { blob: file, originalSize: file.size, finalSize: file.size, note: 'File is already under the target size' }
  }
  let result
  if      (cat === 'image') result = await compressImage(file, targetBytes, mode, onProgress)
  else if (cat === 'video') result = await compressVideo(file, targetBytes, mode, onProgress)
  else if (cat === 'audio') result = await compressAudio(file, targetBytes, mode, onProgress)
  else if (cat === 'pdf')   result = await compressPDF(file, targetBytes, mode, onProgress)
  else throw new Error('No compressor available for this file type.')
  return { ...result, originalSize: file.size, finalSize: result.blob.size }
}
