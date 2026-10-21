import exifr from 'exifr'
import { db, uid, type Media } from './db'

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      await img.decode()
      return img
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }
}

function canvasToBlob(c: HTMLCanvasElement, type = 'image/jpeg', q = 0.85): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), type, q))
}

export async function resizeImage(file: Blob, max: number, type = 'image/jpeg', q = 0.85): Promise<Blob> {
  const src = await loadBitmap(file)
  const w = 'naturalWidth' in src ? src.naturalWidth : src.width
  const h = 'naturalHeight' in src ? src.naturalHeight : src.height
  const k = Math.min(1, max / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * k)
  c.height = Math.round(h * k)
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
  if ('close' in src) src.close()
  return canvasToBlob(c, type, q)
}

async function videoThumb(file: Blob): Promise<Blob | undefined> {
  const url = URL.createObjectURL(file)
  try {
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'metadata'
    v.src = url
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res()
      v.onerror = () => rej(new Error('video'))
      setTimeout(() => rej(new Error('timeout')), 8000)
    })
    v.currentTime = Math.min(0.5, (v.duration || 1) / 2)
    await new Promise<void>((res) => {
      v.onseeked = () => res()
      setTimeout(res, 2000)
    })
    const k = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * k)
    c.height = Math.round(v.videoHeight * k)
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
    return await canvasToBlob(c, 'image/jpeg', 0.8)
  } catch {
    return undefined
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function readTakenAt(file: File): Promise<number | undefined> {
  try {
    const x = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate'])
    const d: Date | undefined = x?.DateTimeOriginal || x?.CreateDate
    if (d instanceof Date && !isNaN(d.getTime())) return d.getTime()
  } catch {
    /* no EXIF */
  }
  return undefined
}

/** Prepare a picked photo/video for storage: downscale, thumbnail, read EXIF date. Not yet saved. */
export async function prepareMedia(file: File): Promise<Media> {
  const isVideo = file.type.startsWith('video/')
  const now = Date.now()
  if (isVideo) {
    return { id: uid(), blob: file, thumb: await videoThumb(file), kind: 'video', createdAt: now }
  }
  const [blob, thumb, takenAt] = await Promise.all([
    resizeImage(file, 2048, 'image/jpeg', 0.86),
    resizeImage(file, 640, 'image/jpeg', 0.8),
    readTakenAt(file),
  ])
  return { id: uid(), blob, thumb, kind: 'image', takenAt, createdAt: now }
}

export async function saveImageAsMedia(file: Blob, max = 2048): Promise<string> {
  const m: Media = {
    id: uid(),
    blob: await resizeImage(file, max),
    thumb: await resizeImage(file, 640, 'image/jpeg', 0.8),
    kind: 'image',
    createdAt: Date.now(),
  }
  await db.media.put(m)
  return m.id
}

export function pickFiles(accept: string, multiple = false, capture?: string): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    if (capture) input.setAttribute('capture', capture)
    input.style.display = 'none'
    document.body.appendChild(input)
    let done = false
    const finish = (files: File[]) => {
      if (done) return
      done = true
      input.remove()
      resolve(files)
    }
    input.onchange = () => finish(Array.from(input.files || []))
    input.addEventListener('cancel', () => finish([]))
    input.click()
  })
}

/** Center-cropped square JPEG (for profile photos). */
export async function squareImage(file: Blob, size = 400): Promise<Blob> {
  const src = await loadBitmap(file)
  const w = 'naturalWidth' in src ? src.naturalWidth : src.width
  const h = 'naturalHeight' in src ? src.naturalHeight : src.height
  const side = Math.min(w, h)
  const c = document.createElement('canvas')
  c.width = c.height = Math.min(size, side)
  c.getContext('2d')!.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, c.width, c.height)
  if ('close' in src) src.close()
  return canvasToBlob(c, 'image/jpeg', 0.86)
}
