import { useState } from 'react'
import { Plus, X } from 'lucide-react'

/** Free-form list editor (genres, people) with quick-pick suggestions. */
export function ChipsInput({ values, onChange, placeholder, suggestions = [], render }: {
  values: string[]
  onChange: (v: string[]) => void
  placeholder: string
  suggestions?: string[]
  render?: (v: string) => React.ReactNode
}) {
  const [text, setText] = useState('')
  const add = (v: string) => {
    const s = v.trim()
    if (s && !values.some((x) => x.toLowerCase() === s.toLowerCase())) onChange([...values, s])
    setText('')
  }
  const sugg = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 8)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {values.map((v) => (
            <button key={v} type="button" onClick={() => onChange(values.filter((x) => x !== v))} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 10px 0 4px', borderRadius: 17, background: 'var(--s2)', font: '600 14px var(--sans)' }}>
              {render ? render(v) : <span style={{ paddingLeft: 8 }}>{v}</span>}
              <X size={14} color="var(--tx3)" />
            </button>
          ))}
        </div>
      )}
      <div className="field">
        <input
          value={text}
          onChange={(e) => {
            const v = e.target.value
            if (v.endsWith(',')) add(v.slice(0, -1))
            else setText(v)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(text)
            }
          }}
          onBlur={() => text && add(text)}
          placeholder={placeholder}
          enterKeyHint="done"
        />
        {text && <button type="button" aria-label="Добавить" onClick={() => add(text)} style={{ color: 'var(--mag)', display: 'flex' }}><Plus size={20} /></button>}
      </div>
      {sugg.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {sugg.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} style={{ height: 30, padding: '0 12px', borderRadius: 15, border: '1px dashed var(--line2)', font: '500 13px var(--sans)', color: 'var(--tx2)' }}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
