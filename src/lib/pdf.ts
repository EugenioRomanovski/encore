import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface RenderedPdf {
  pages: Blob[]
  text: string
}

/** Render every page of a PDF to a PNG (sharp enough for QR codes) and extract its text. */
export async function renderPdf(file: Blob, maxPages = 8): Promise<RenderedPdf> {
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const pages: Blob[] = []
  let text = ''
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
      text += tc.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n'
    } catch {
      /* ignore */
    }
  }
  await doc.destroy()
  return { pages, text }
}
