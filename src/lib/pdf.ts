import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface TextLine {
  text: string
  /** font size in PDF units — the biggest line on a ticket is usually the show's title */
  size: number
  page: number
}

export interface RenderedPdf {
  pages: Blob[]
  /** text with one visual line per row, so "Label: value" pairs stay together */
  text: string
  lines: TextLine[]
}

type Item = { str: string; transform: number[]; height?: number }

/** Group text items into visual lines (same baseline), left to right. */
function toLines(items: Item[], page: number): TextLine[] {
  const rows: { y: number; size: number; parts: { x: number; s: string }[] }[] = []
  for (const it of items) {
    if (!it.str?.trim()) continue
    const [, , c, d, x, y] = it.transform
    const size = Math.round(Math.hypot(c, d) || it.height || 0)
    const row = rows.find((r) => Math.abs(r.y - y) <= Math.max(2, size * 0.3))
    if (row) {
      row.parts.push({ x, s: it.str })
      row.size = Math.max(row.size, size)
    } else rows.push({ y, size, parts: [{ x, s: it.str }] })
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => ({ text: r.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim(), size: r.size, page }))
    .filter((l) => l.text)
}

/** Render every page of a PDF to a PNG (sharp enough for QR codes) and extract its text. */
export async function renderPdf(file: Blob, maxPages = 8): Promise<RenderedPdf> {
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const pages: Blob[] = []
  const lines: TextLine[] = []
  const n = Math.min(doc.numPages, maxPages)
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(3, 1400 / base.width)
    const vp = page.getViewport({ scale })
    const c = document.createElement('canvas')
    c.width = Math.round(vp.width)
    c.height = Math.round(vp.height)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    await page.render({ canvasContext: ctx, viewport: vp }).promise
    pages.push(await new Promise<Blob>((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error('png'))), 'image/png')))
    try {
      const tc = await page.getTextContent()
      lines.push(...toLines(tc.items.filter((it) => 'str' in it) as Item[], i))
    } catch {
      /* ignore */
    }
  }
  await doc.destroy()
  return { pages, text: lines.map((l) => l.text).join('\n'), lines }
}
