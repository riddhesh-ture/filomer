// compressionEngine.js — plain JS (no TypeScript)
// Compresses files to a target byte size

const FFMPEG_CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js'
const FFMPEG_WASM = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm'

let _ffmpeg = null
let _ffmpegReady = false

async function getFFmpeg(onProgress) {
  if (_ffmpegReady) return _ffmpeg
  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const { toBlobURL } = await import('@ffmpeg/util')
  _ffmpeg = new FFmpeg()
  _ffmpeg.on('progress', ({ progress: p }) => onProgress?.(Math.min(99, Math.round(p * 100))))
  await _ffmpeg.load({
    coreURL: await toBlobURL(FFMPEG_CORE, 'text/javascript'),
    wasmURL: await toBlobURL(FFMPEG_WASM, 'application/wasm'),
  })
  _ffmpegReady = true
  return _ffmpeg
}

function getFileExt(file) {
  return file.name.split('.').pop().toLowerCase()
}

function getCategory(file) {
  const ext = getFileExt(file)
  if (['jpg','jpeg','png','webp','gif','bmp','avif','heic','ico','tiff','svg'].includes(ext)) return 'image'
  if (['mp4','webm','mkv','avi','mov','ogv','flv'].includes(ext)) return 'video'
  if (['mp3','wav','ogg','aac','flac','m4a','opus'].includes(ext)) return 'audio'
  if (ext === 'pdf') return 'pdf'
  return 'unknown'
}

function getMediaDuration(file) {
  return new Promise(resolve => {
    const el = file.type.startsWith('video')
      ? document.createElement('video')
      : document.createElement('audio')
    const url = URL.createObjectURL(file)
    el.onloadedmetadata = () => { resolve(el.duration); URL.revokeObjectURL(url) }
    el.onerror = () => { resolve(60); URL.revokeObjectURL(url) }
    el.src = url
  })
}

async function imageToBlob(file, format, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (format === 'JPG') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height) }
      ctx.drawImage(img, 0, 0)
      const mime = format === 'WEBP' ? 'image/webp' : 'image/jpeg'
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url)
        blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))
      }, mime, quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

async function compressImage(file, targetBytes, mode, onProgress) {
  const outputFormat = mode === 'lossless' ? 'PNG' : 'WEBP'
  if (mode === 'lossless') {
    onProgress?.(50)
    const blob = await imageToBlob(file, 'WEBP', 1.0)
    onProgress?.(100)
    return { blob, quality: 100, note: blob.size > targetBytes ? 'Lossless — cannot hit target without lossy compression' : undefined }
  }
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

async function compressVideo(file, targetBytes, mode, onProgress) {
  const ff = await getFFmpeg(onProgress)
  const { fetchFile } = await import('@ffmpeg/util')
  const duration = await getMediaDuration(file)
  const audioBitrateK = mode === 'aggressive' ? 64 : 96
  const totalBitrateK = (targetBytes * 8) / 1000 / duration
  const videoBitrateK = Math.max(100, Math.floor(totalBitrateK - audioBitrateK))
  const ext = getFileExt(file)
  const inFile = `vin.${ext}`, outFile = 'vout.mp4'
  const ph = ({ progress: p }) => onProgress?.(Math.min(99, Math.round(p * 100)))
  ff.on('progress', ph)
  await ff.writeFile(inFile, await fetchFile(file))
  await ff.exec(['-i', inFile, '-c:v', 'libx264', '-b:v', `${videoBitrateK}k`, '-c:a', 'aac', '-b:a', `${audioBitrateK}k`, '-movflags', '+faststart', '-y', outFile])
  const data = await ff.readFile(outFile)
  ff.off('progress', ph)
  await ff.deleteFile(inFile).catch(() => {})
  await ff.deleteFile(outFile).catch(() => {})
  onProgress?.(100)
  const blob = new Blob([data.buffer], { type: 'video/mp4' })
  return { blob, warning: blob.size > targetBytes ? `Could not reach target — file is ${(blob.size/1048576).toFixed(2)} MB` : undefined }
}

async function compressAudio(file, targetBytes, mode, onProgress) {
  const ff = await getFFmpeg(onProgress)
  const { fetchFile } = await import('@ffmpeg/util')
  const duration = await getMediaDuration(file)
  const totalBitrateK = (targetBytes * 8) / 1000 / duration
  const bitrateK = Math.min(320, Math.max(mode === 'aggressive' ? 32 : 64, Math.floor(totalBitrateK)))
  const ext = getFileExt(file)
  const inFile = `ain.${ext}`, outFile = 'aout.mp3'
  const ph = ({ progress: p }) => onProgress?.(Math.min(99, Math.round(p * 100)))
  ff.on('progress', ph)
  await ff.writeFile(inFile, await fetchFile(file))
  await ff.exec(['-i', inFile, '-codec:a', 'libmp3lame', '-b:a', `${bitrateK}k`, '-y', outFile])
  const data = await ff.readFile(outFile)
  ff.off('progress', ph)
  await ff.deleteFile(inFile).catch(() => {})
  await ff.deleteFile(outFile).catch(() => {})
  onProgress?.(100)
  return { blob: new Blob([data.buffer], { type: 'audio/mpeg' }) }
}

async function compressPDF(file, targetBytes, mode, onProgress) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href
  const { PDFDocument } = await import('pdf-lib')
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const attempts = mode === 'lossless'
    ? [{ scale: 2.0, quality: 0.9 }]
    : mode === 'aggressive'
    ? [{ scale: 1.0, quality: 0.6 }, { scale: 0.7, quality: 0.45 }, { scale: 0.5, quality: 0.3 }]
    : [{ scale: 1.5, quality: 0.75 }, { scale: 1.0, quality: 0.6 }, { scale: 0.7, quality: 0.45 }]
  let lastBlob = null
  for (let ai = 0; ai < attempts.length; ai++) {
    const { scale, quality } = attempts[ai]
    const pageImages = []
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width; canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      const imgBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality))
      const imgBuf = await imgBlob.arrayBuffer()
      pageImages.push({ data: new Uint8Array(imgBuf), width: viewport.width, height: viewport.height })
      onProgress?.(Math.round(((ai / attempts.length) + (p / pdf.numPages / attempts.length)) * 90))
    }
    const newDoc = await PDFDocument.create()
    for (const { data, width, height } of pageImages) {
      const img = await newDoc.embedJpg(data)
      const page = newDoc.addPage([width, height])
      page.drawImage(img, { x: 0, y: 0, width, height })
    }
    const bytes = await newDoc.save()
    lastBlob = new Blob([bytes], { type: 'application/pdf' })
    if (lastBlob.size <= targetBytes) { onProgress?.(100); return { blob: lastBlob } }
  }
  onProgress?.(100)
  return { blob: lastBlob, warning: lastBlob && lastBlob.size > targetBytes ? `Could not reach target — best: ${(lastBlob.size/1048576).toFixed(2)} MB` : undefined }
}

export async function compressToTarget(file, targetBytes, mode = 'smart', onProgress) {
  const cat = getCategory(file)
  if (file.size <= targetBytes) {
    return { blob: file, originalSize: file.size, finalSize: file.size, note: 'File is already under the target size' }
  }
  let result
  if (cat === 'image') result = await compressImage(file, targetBytes, mode, onProgress)
  else if (cat === 'video') result = await compressVideo(file, targetBytes, mode, onProgress)
  else if (cat === 'audio') result = await compressAudio(file, targetBytes, mode, onProgress)
  else if (cat === 'pdf') result = await compressPDF(file, targetBytes, mode, onProgress)
  else throw new Error('No compressor available for this file type.')
  return { ...result, originalSize: file.size, finalSize: result.blob.size }
}

export { getCategory }
