import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import type { TicketCode } from './db'
import { blobToCanvas } from './scan'

/*
 * Barcodes on ticket pages. At the gate only the code gets scanned, so the ticket screen shows the codes
 * large instead of the whole document. ZXing (WebAssembly) is used because iOS Safari has no BarcodeDetector.
 */

type Reader = typeof import('zxing-wasm/reader')
let reader: Promise<Reader> | null = null
function zxing() {
  // the .wasm ships with the app (and is precached), so this works offline at the venue
  reader ||= import('zxing-wasm/reader').then((m) => {
    m.prepareZXingModule({ overrides: { locateFile: (p: string, prefix: string) => (p.endsWith('.wasm') ? wasmUrl : prefix + p) } })
    return m
  })
  return reader
}

const LINEAR = /^(Codabar|Code|ITF|DataBar|EAN|ISBN|UPC|Telepen|PZN|DX)/

/** Rows of a 1D barcode around `yc`: walk up and down while the bar pattern stays the same as at the centre line. */
function barRows(img: ImageData, x0: number, x1: number, yc: number): [number, number] {
  const { data, width, height } = img
  const row = (y: number) => {
    const out: boolean[] = []
    for (let x = x0; x <= x1; x++) {
      const i = (y * width + x) * 4
      out.push(data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11 < 128)
    }
    return out
  }
  const ref = row(yc)
  const same = (y: number) => {
    const r = row(y)
    let diff = 0
    for (let i = 0; i < r.length; i++) if (r[i] !== ref[i]) diff++
    return diff / r.length < 0.12
  }
  const limit = Math.round((x1 - x0) * 0.6)
  let top = yc, bottom = yc
  while (top > 0 && yc - top < limit && same(top - 1)) top--
  while (bottom < height - 1 && bottom - yc < limit && same(bottom + 1)) bottom++
  return [top, bottom]
}

/** Find the barcodes / QR codes on the ticket's page images. Boxes are fractions of the page, quiet zone included. */
export async function findCodes(pages: Blob[]): Promise<TicketCode[]> {
  const zx = await zxing()
  const out: TicketCode[] = []
  for (let page = 0; page < pages.length; page++) {
    const c = await blobToCanvas(pages[page], 4000)
    const W = c.width, H = c.height
    const img = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H)
    const found = await zx.readBarcodes(img, { tryHarder: true, tryRotate: true, maxNumberOfSymbols: 12 })
    for (const r of found) {
      if (!r.isValid || !r.text || out.some((o) => o.text === r.text && o.format === r.format)) continue
      const pts = [r.position.topLeft, r.position.topRight, r.position.bottomRight, r.position.bottomLeft]
      let x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x))
      let y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y))
      const linear = LINEAR.test(r.format)
      if (linear && Math.abs(r.orientation % 180) < 10) {
        // ZXing reports a 1D code as the scan line it read; find how tall the bars actually are
        ;[y0, y1] = barRows(img, Math.max(0, Math.round(x0)), Math.min(W - 1, Math.round(x1)), Math.round((y0 + y1) / 2))
      }
      const w = x1 - x0, h = y1 - y0
      const pad = linear ? { x: w * 0.08, y: Math.max(h * 0.1, w * 0.03) } : { x: Math.max(w, h) * 0.12, y: Math.max(w, h) * 0.12 }
      x0 = Math.max(0, x0 - pad.x); x1 = Math.min(W, x1 + pad.x)
      y0 = Math.max(0, y0 - pad.y); y1 = Math.min(H, y1 + pad.y)
      out.push({ page, x: x0 / W, y: y0 / H, w: (x1 - x0) / W, h: (y1 - y0) / H, format: r.format, text: r.text, linear })
    }
  }
  return out
}

const crops = new Map<string, Promise<Blob>>()

/**
 * The code cut out of the ticket. From a PDF it is re-rendered from the vector original (sharp at any size);
 * otherwise it is cut from the page image.
 */
export function cropCode(key: string, code: TicketCode, page: Blob, pdf?: Blob): Promise<Blob> {
  let p = crops.get(key)
  if (!p) {
    p = (pdf ? import('./pdf').then((m) => m.renderRegion(pdf, code)).then(toPng).catch(() => cropImage(page, code)) : cropImage(page, code))
    p.catch(() => crops.delete(key))
    crops.set(key, p)
  }
  return p
}

const toPng = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png'))

async function cropImage(page: Blob, code: TicketCode) {
  const src = await blobToCanvas(page, 4000)
  const sx = code.x * src.width, sy = code.y * src.height, sw = code.w * src.width, sh = code.h * src.height
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(sw))
  c.height = Math.max(1, Math.round(sh))
  c.getContext('2d')!.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height)
  return toPng(c)
}
