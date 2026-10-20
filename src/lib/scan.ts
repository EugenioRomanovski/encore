export type Pt = { x: number; y: number }
export type Filter = 'orig' | 'enh' | 'bw'

/** Solve the 3x3 homography that maps the unit square corners to quad (TL, TR, BR, BL). */
function squareToQuad(q: Pt[]) {
  const [p0, p1, p2, p3] = q
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y
  let a13 = 0, a23 = 0
  if (dx3 !== 0 || dy3 !== 0) {
    const den = dx1 * dy2 - dx2 * dy1
    a13 = (dx3 * dy2 - dx2 * dy3) / den
    a23 = (dx1 * dy3 - dx3 * dy1) / den
  }
  return {
    a11: p1.x - p0.x + a13 * p1.x, a21: p3.x - p0.x + a23 * p3.x, a31: p0.x,
    a12: p1.y - p0.y + a13 * p1.y, a22: p3.y - p0.y + a23 * p3.y, a32: p0.y,
    a13, a23,
  }
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** Perspective-correct the quad region of the source into a flat rectangle. */
export function warpQuad(src: HTMLCanvasElement, quad: Pt[], maxSide = 1800): HTMLCanvasElement {
  let w = (dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2
  let h = (dist(quad[0], quad[3]) + dist(quad[1], quad[2])) / 2
  const k = Math.min(1, maxSide / Math.max(w, h))
  w = Math.max(1, Math.round(w * k))
  h = Math.max(1, Math.round(h * k))
  const sctx = src.getContext('2d')!
  const sd = sctx.getImageData(0, 0, src.width, src.height).data
  const sw = src.width, sh = src.height
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const octx = out.getContext('2d')!
  const od = octx.createImageData(w, h)
  const H = squareToQuad(quad)
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w
      const z = H.a13 * u + H.a23 * v + 1
      const sx = (H.a11 * u + H.a21 * v + H.a31) / z
      const sy = (H.a12 * u + H.a22 * v + H.a32) / z
      // bilinear sample
      const x0 = Math.max(0, Math.min(sw - 2, Math.floor(sx)))
      const y0 = Math.max(0, Math.min(sh - 2, Math.floor(sy)))
      const fx = Math.min(1, Math.max(0, sx - x0)), fy = Math.min(1, Math.max(0, sy - y0))
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4
      const o = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const top = sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx
        const bot = sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx
        od.data[o + c] = top * (1 - fy) + bot * fy
      }
      od.data[o + 3] = 255
    }
  }
  octx.putImageData(od, 0, 0)
  return out
}

/** Document-style enhancement: auto levels (+ optional grayscale). Returns a new canvas. */
export function applyFilter(src: HTMLCanvasElement, f: Filter): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  if (f === 'orig') return out
  const img = ctx.getImageData(0, 0, out.width, out.height)
  const d = img.data
  const hist = new Uint32Array(256)
  for (let i = 0; i < d.length; i += 4) hist[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8]++
  const total = d.length / 4
  let lo = 0, hi = 255, acc = 0
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > total * 0.02) { lo = i; break } }
  acc = 0
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > total * 0.08) { hi = i; break } }
  if (hi - lo < 30) { lo = 0; hi = 255 }
  const scale = 255 / (hi - lo)
  const lut = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) {
    let v = (i - lo) * scale / 255
    v = Math.min(1, Math.max(0, v))
    // gentle S-curve for crisper print
    v = f === 'bw' ? (v < 0.5 ? 2 * v * v : 1 - 2 * (1 - v) * (1 - v)) : v
    lut[i] = v * 255
  }
  for (let i = 0; i < d.length; i += 4) {
    if (f === 'bw') {
      const g = lut[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8]
      d[i] = d[i + 1] = d[i + 2] = g
    } else {
      d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]
    }
  }
  ctx.putImageData(img, 0, 0)
  return out
}

export function rotate90(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = src.height
  out.height = src.width
  const ctx = out.getContext('2d')!
  ctx.translate(out.width, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(src, 0, 0)
  return out
}

export async function blobToCanvas(blob: Blob, max = 2400): Promise<HTMLCanvasElement> {
  let src: ImageBitmap | HTMLImageElement
  try {
    src = await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  } catch {
    const img = new Image()
    img.src = URL.createObjectURL(blob)
    await img.decode()
    src = img
  }
  const w = 'naturalWidth' in src ? src.naturalWidth : src.width
  const h = 'naturalHeight' in src ? src.naturalHeight : src.height
  const k = Math.min(1, max / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * k)
  c.height = Math.round(h * k)
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
  return c
}

export const canvasBlob = (c: HTMLCanvasElement, type = 'image/jpeg', q = 0.9) =>
  new Promise<Blob>((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error('blob'))), type, q))
