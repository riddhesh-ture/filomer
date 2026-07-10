// ══════════════════════════════════════════════════════════════
//  DevSuite — conversionEngine.js
//
//  Full format support:
//   Images  → PNG JPG WEBP GIF BMP ICO AVIF PDF  (Canvas API)
//   SVG     → PNG JPG WEBP PDF                    (Canvas API)
//   HEIC    → JPG PNG WEBP                        (heic2any)
//   PDF     → PNG JPG WEBP ZIP                    (pdfjs + pdf-lib)
//   Video   → MP4 WEBM AVI MOV GIF MP3 WAV AAC   (ffmpeg.wasm)
//   Audio   → MP3 WAV OGG AAC FLAC M4A            (ffmpeg.wasm)
//  Special:
//   Images[] → single PDF                         (pdf-lib)
//   PDFs[]  → merged PDF                          (pdf-lib)
//   Any[]   → ZIP bundle                          (jszip)
// ══════════════════════════════════════════════════════════════

// ─── FORMAT CATEGORIES ───────────────────────────────────────
export const FILE_CATEGORIES = {
  image: ['jpg','jpeg','png','webp','gif','bmp','tiff','tif','avif','ico'],
  svg:   ['svg'],
  heic:  ['heic','heif'],
  pdf:   ['pdf'],
  video: ['mp4','mkv','mov','avi','webm','flv','3gp','ts','wmv','m4v','ogv'],
  audio: ['mp3','wav','ogg','aac','flac','m4a','opus','wma','aiff','aif'],
}

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

// Only video/audio actually need ffmpeg. HEIC uses heic2any, PDF uses pdfjs.
export const NEEDS_ENGINE = new Set(['video', 'audio'])

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

// ─── CONSTANTS ────────────────────────────────────────────────
const FFMPEG_CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js'
const FFMPEG_WASM = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm'

const MIME = {
  PNG:'image/png', JPG:'image/jpeg', WEBP:'image/webp',
  GIF:'image/gif', BMP:'image/bmp', AVIF:'image/avif',
  ICO:'image/x-icon', PDF:'application/pdf',
  MP3:'audio/mpeg', WAV:'audio/wav', OGG:'audio/ogg',
  AAC:'audio/aac', FLAC:'audio/flac', M4A:'audio/mp4',
  MP4:'video/mp4', WEBM:'video/webm', AVI:'video/x-msvideo',
  MOV:'video/quicktime', ZIP:'application/zip',
}

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

// ─── FFMPEG SINGLETON ─────────────────────────────────────────
let _ff = null, _ffReady = false

export async function loadFFmpeg(onProgress) {
  if (_ffReady) return _ff
  const { FFmpeg }    = await import('@ffmpeg/ffmpeg')
  const { toBlobURL } = await import('@ffmpeg/util')
  _ff = new FFmpeg()
  _ff.on('progress', ({ progress: p }) => onProgress?.(Math.min(99, Math.round(p * 100))))
  await _ff.load({
    coreURL: await toBlobURL(FFMPEG_CORE, 'text/javascript'),
    wasmURL: await toBlobURL(FFMPEG_WASM, 'application/wasm'),
  })
  _ffReady = true
  return _ff
}

export const isFFmpegReady = () => _ffReady

async function getFF(onProgress) {
  if (_ffReady) return _ff
  return loadFFmpeg(onProgress)
}

// ─── HELPERS ──────────────────────────────────────────────────
function ext(file) { return file.name.split('.').pop().toLowerCase() }

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

      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (format === 'JPG' || format === 'BMP') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
      }
      ctx.drawImage(img, 0, 0, w, h)

      const mime = MIME[format] || 'image/png'
      const q = ['PNG','GIF','BMP','ICO','AVIF'].includes(format) ? 1 : quality

      if (format === 'AVIF') {
        canvas.toBlob(b => {
          URL.revokeObjectURL(url)
          if (b && b.size > 0) { resolve(b); return }
          canvas.toBlob(fb => { resolve(fb) }, 'image/webp', 0.85)
        }, 'image/avif', 0.8)
        return
      }

      canvas.toBlob(b => {
        URL.revokeObjectURL(url)
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
export async function convertSVG(file, format) {
  if (format === 'PDF') return singleImageToPDF(file)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const svgText = e.target.result
      const parser = new DOMParser()
      const doc = parser.parseFromString(svgText, 'image/svg+xml')
      const svgEl = doc.querySelector('svg')
      const vb = svgEl?.getAttribute('viewBox')?.split(/[\s,]/).map(Number)
      const w = parseFloat(svgEl?.getAttribute('width'))  || (vb ? vb[2] : 800)
      const h = parseFloat(svgEl?.getAttribute('height')) || (vb ? vb[3] : 600)

      const blob = new Blob([svgText], { type:'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(w, 1); canvas.height = Math.max(h, 1)
        const ctx = canvas.getContext('2d')
        if (format === 'JPG') { ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height) }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const mime = MIME[format] || 'image/png'
        canvas.toBlob(b => { URL.revokeObjectURL(url); b ? resolve(b) : reject(new Error('SVG render failed')) }, mime, 0.92)
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG load failed')) }
      img.src = url
    }
    reader.readAsText(file)
  })
}

// ─── HEIC → RASTER ───────────────────────────────────────────
export async function convertHEIC(file, format) {
  const heic2any = (await import('heic2any')).default
  const mime = MIME[format] || 'image/jpeg'
  const result = await heic2any({ blob: file, toType: mime, quality: 0.92 })
  return Array.isArray(result) ? result[0] : result
}

// ─── ICO GENERATION ──────────────────────────────────────────
export async function createICO(file) {
  const SIZES = [16, 32, 48, 64]
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
export async function imagesToPDF(files, onProgress) {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const fileExt = ext(file)
    let imgBytes, imgType
    if (['jpg','jpeg'].includes(fileExt)) {
      imgBytes = new Uint8Array(await file.arrayBuffer()); imgType = 'jpg'
    } else {
      const blob = await imageToBlob(file, 'PNG', 1)
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

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width; canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    const blob = await new Promise(r => canvas.toBlob(r, mime, q))
    blobs.push(blob)
    onProgress?.(Math.round((p / pdf.numPages) * 100))
  }
  if (blobs.length === 1) return blobs[0]
  return zipBlobs(blobs, format.toLowerCase())
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

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width; canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    const blob = await new Promise(r => canvas.toBlob(r, mime, q))
    zip.file(`${base}_page${String(p).padStart(3,'0')}.${extStr}`, blob)
    onProgress?.(Math.round((p / pdf.numPages) * 90))
  }
  const zipBlob = await zip.generateAsync({ type:'blob', compression:'DEFLATE' })
  onProgress?.(100)
  return zipBlob
}

// ─── VIDEO / AUDIO (ffmpeg) ──────────────────────────────────
export async function convertAV(file, format, onProgress) {
  const ff = await getFF(onProgress)
  const { fetchFile } = await import('@ffmpeg/util')
  const inExt = ext(file)
  const outExt = format.toLowerCase()
  const inFile = `src.${inExt}`, outFile = `out.${outExt}`

  const ph = ({ progress: p }) => onProgress?.(Math.min(99, Math.round(p * 100)))
  ff.on('progress', ph)
  await ff.writeFile(inFile, await fetchFile(file))
  await ff.exec(['-i', inFile, ...(FFMPEG_PRESETS[format] || []), '-y', outFile])
  const data = await ff.readFile(outFile)
  ff.off('progress', ph)
  await ff.deleteFile(inFile).catch(() => {})
  await ff.deleteFile(outFile).catch(() => {})
  onProgress?.(100)
  return new Blob([data.buffer], { type: MIME[format] || 'application/octet-stream' })
}

// ─── VIDEO → GIF ─────────────────────────────────────────────
export async function videoToGIF(file, quality = 'medium', onProgress) {
  const ff = await getFF(onProgress)
  const { fetchFile } = await import('@ffmpeg/util')
  const fps = { low:6, medium:12, high:20 }[quality] || 12
  const scale = { low:320, medium:480, high:640 }[quality] || 480
  const inExt = ext(file)
  const inFile = `gifin.${inExt}`, palette = 'pal.png', outFile = 'out.gif'

  const ph = ({ progress: p }) => onProgress?.(Math.min(95, Math.round(p * 100)))
  ff.on('progress', ph)
  await ff.writeFile(inFile, await fetchFile(file))
  await ff.exec(['-i', inFile, '-vf', `fps=${fps},scale=${scale}:-1:flags=lanczos,palettegen=stats_mode=diff`, '-y', palette])
  await ff.exec(['-i', inFile, '-i', palette, '-lavfi', `fps=${fps},scale=${scale}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer`, '-y', outFile])
  const data = await ff.readFile(outFile)
  ff.off('progress', ph)
  await ff.deleteFile(inFile).catch(() => {})
  await ff.deleteFile(outFile).catch(() => {})
  await ff.deleteFile(palette).catch(() => {})
  onProgress?.(100)
  return new Blob([data.buffer], { type:'image/gif' })
}

// ─── EXTRACT AUDIO FROM VIDEO ────────────────────────────────
export async function extractAudio(file, format, onProgress) {
  const ff = await getFF(onProgress)
  const { fetchFile } = await import('@ffmpeg/util')
  const inExt = ext(file)
  const outExt = format.toLowerCase()
  const inFile = `vid.${inExt}`, outFile = `audio.${outExt}`
  const presets = { MP3:FFMPEG_PRESETS.MP3, WAV:FFMPEG_PRESETS.WAV, AAC:FFMPEG_PRESETS.AAC, OGG:FFMPEG_PRESETS.OGG }

  const ph = ({ progress: p }) => onProgress?.(Math.min(99, Math.round(p * 100)))
  ff.on('progress', ph)
  await ff.writeFile(inFile, await fetchFile(file))
  await ff.exec(['-i', inFile, ...(presets[format] || FFMPEG_PRESETS.MP3), '-vn', '-y', outFile])
  const data = await ff.readFile(outFile)
  ff.off('progress', ph)
  await ff.deleteFile(inFile).catch(() => {})
  await ff.deleteFile(outFile).catch(() => {})
  onProgress?.(100)
  return new Blob([data.buffer], { type: MIME[format] || 'audio/mpeg' })
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
  const { quality = 85, resizeW, resizeH, gifQuality = 'medium', onProgress } = options
  const cat = getCategory(file.name)

  if (cat === 'unknown') throw new Error(`Unsupported file format: .${ext(file)}`)

  if (cat === 'heic')  return convertHEIC(file, format)
  if (cat === 'svg')   return convertSVG(file, format)
  if (cat === 'image') {
    if (format === 'ICO') return createICO(file)
    if (format === 'PDF') return singleImageToPDF(file)
    return convertImage(file, format, quality, resizeW, resizeH)
  }
  if (cat === 'pdf') {
    if (format === 'ZIP') return pdfToZip(file, 'PNG', onProgress)
    return pdfToImages(file, format, onProgress)
  }
  if (cat === 'video') {
    if (format === 'GIF') return videoToGIF(file, gifQuality, onProgress)
    if (AUDIO_FORMATS.has(format)) return extractAudio(file, format, onProgress)
    return convertAV(file, format, onProgress)
  }
  if (cat === 'audio') return convertAV(file, format, onProgress)

  throw new Error(`No converter for .${ext(file)} → ${format}`)
}
