import type { CSSProperties, ReactNode } from 'react'
import { useMediaUrl } from '../lib/hooks'
import { ph } from '../lib/palette'

/** A photo from the DB, or the stage-light gradient placeholder when there is none. */
export function Cover({ id, palette, shift = 0, full = false, className, style, children, onClick }: {
  id?: string
  palette: number
  shift?: number
  full?: boolean
  className?: string
  style?: CSSProperties
  children?: ReactNode
  onClick?: () => void
}) {
  const url = useMediaUrl(id, !full)
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: url ? `#111 center/cover no-repeat url("${url}")` : ph(palette, shift),
        ...style,
      }}
    >
      {!url && <div className="grain" />}
      {children}
    </div>
  )
}
