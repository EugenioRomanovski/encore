import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/anton/latin-400.css'
import '@fontsource/anton/latin-ext-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import '@fontsource/ibm-plex-mono/cyrillic-500.css'
import '@fontsource/ibm-plex-mono/cyrillic-600.css'
import oswaldCyr from '@fontsource/oswald/files/oswald-cyrillic-700-normal.woff2?url'
import oswaldCyrExt from '@fontsource/oswald/files/oswald-cyrillic-ext-700-normal.woff2?url'
import './styles/global.css'
import App from './App'

// Anton has no Cyrillic: Russian text in the display face falls back to bold Oswald.
for (const [url, range] of [
  [oswaldCyr, 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116'],
  [oswaldCyrExt, 'U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F'],
] as const) {
  const f = new FontFace('EncoreCyr', `url(${url}) format('woff2')`, { unicodeRange: range, display: 'swap' })
  document.fonts.add(f)
  f.load().catch(() => {})
}

if (navigator.storage?.persist) navigator.storage.persist().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
