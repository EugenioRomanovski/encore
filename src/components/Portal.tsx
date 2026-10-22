import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

/**
 * Render fixed overlays (sheets, full-screen layers) straight into <body>.
 * Screens sit inside an animated route wrapper; a transformed ancestor would make
 * `position: fixed` relative to that wrapper instead of the viewport (notably in iOS Safari).
 */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}
