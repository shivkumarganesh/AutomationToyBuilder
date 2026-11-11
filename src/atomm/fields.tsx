import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/** Parameter edits reach the design (and so the 3D rebuild) at most this often. */
const COMMIT_MS = 120

/**
 * A value that follows the control instantly but commits to the design
 * debounced, so dragging a slider does not rebuild geometry per frame.
 */
function useDebounced<T>(value: T, commit: (v: T) => void): [T, (v: T) => void] {
  const [local, setLocal] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef(false)
  useEffect(() => {
    if (!pending.current) setLocal(value)
  }, [value])
  useEffect(() => () => clearTimeout(timer.current), [])
  const set = (v: T) => {
    setLocal(v)
    pending.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      pending.current = false
      commit(v)
    }, COMMIT_MS)
  }
  return [local, set]
}

export const Chevron = () => (
  <svg className="icon" viewBox="0 0 16 16" aria-hidden="true">
    <path d="m4 6 4 4 4-4" />
  </svg>
)

/** A property card: disclosure header + field rows. */
export function PropCard({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <section className="prop-card" aria-labelledby={`${id}-t`}>
      <button
        type="button"
        className="prop-card-header"
        id={`${id}-t`}
        aria-expanded={open}
        aria-controls={`${id}-b`}
        onClick={() => setOpen(!open)}
      >
        {title}
        <Chevron />
      </button>
      <div className="prop-card-body" id={`${id}-b`} hidden={!open}>
        {children}
      </div>
    </section>
  )
}

export type Units = 'mm' | 'in'
const round = (v: number, step: number) => Math.round(v / step) * step
const shown = (mm: number, units: Units) =>
  units === 'in' ? (mm / 25.4).toFixed(3).replace(/\.?0+$/, '') : String(+mm.toFixed(2))

/**
 * Numeric field: the value at the start edge, the unit pinned to the
 * end. Type a value, or press and drag sideways to change it (Shift =
 * ×10, Alt = fine; under 3 px counts as a click). Shift + ↑/↓ steps it.
 */
export function NumberRow({
  label,
  value,
  min,
  max,
  step = 1,
  units,
  unit,
  onChange,
}: {
  label: string
  /** Always millimetres (or a plain number when `unit` is given). */
  value: number
  min: number
  max: number
  step?: number
  units?: Units
  /** A fixed suffix for values that are not lengths (°, ×, %). */
  unit?: string
  onChange: (v: number) => void
}) {
  const id = useId()
  const clamp = (v: number) => Math.min(max, Math.max(min, round(v, step / 10)))
  const [local, setLocal] = useDebounced(value, onChange)
  const isLength = unit === undefined
  const u: Units = isLength ? (units ?? 'mm') : 'mm'
  const [text, setText] = useState<string | null>(null)
  const drag = useRef<{ x: number; start: number; moved: boolean } | null>(null)

  const commitText = () => {
    if (text === null) return
    const n = Number(text)
    if (Number.isFinite(n)) setLocal(clamp(isLength && u === 'in' ? n * 25.4 : n))
    setText(null)
  }
  return (
    <div className="field-row">
      <label htmlFor={id}>{label}</label>
      <span className="input-number">
        <input
          id={id}
          inputMode="decimal"
          value={text ?? shown(local, u)}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
              e.preventDefault()
              setLocal(clamp(local + (e.key === 'ArrowUp' ? step : -step)))
            }
          }}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, start: local, moved: false }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d) return
            const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
            const dx = (e.clientX - d.x) * (rtl ? -1 : 1)
            if (!d.moved && Math.abs(dx) < 3) return
            d.moved = true
            const scale = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
            setLocal(clamp(d.start + Math.round(dx / 4) * step * scale))
          }}
          onPointerUp={(e) => {
            if (drag.current?.moved) e.currentTarget.blur()
            drag.current = null
          }}
        />
        <span className="unit">{isLength ? (u === 'in' ? 'in' : 'mm') : unit}</span>
      </span>
    </div>
  )
}

/** A slider, never alone: its value is shown as a number beside it. */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  const id = useId()
  const [local, setLocal] = useDebounced(value, onChange)
  const pct = ((local - min) / (max - min)) * 100
  return (
    <div className="field-row">
      <label htmlFor={id}>{label}</label>
      <div className="control">
        <input
          id={id}
          className="slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={local}
          style={{ ['--fill' as string]: `${pct}%` }}
          onChange={(e) => setLocal(Number(e.target.value))}
        />
        <span className="value">
          {+local.toFixed(2)}
          {unit}
        </span>
      </div>
    </div>
  )
}

export function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  const id = useId()
  return (
    <div className="field-row">
      <label htmlFor={id}>{label}</label>
      <span className="switch">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="track" aria-hidden="true" />
        <span className="knob" aria-hidden="true" />
      </span>
    </div>
  )
}

/** A native select in the platform's field shell (the allowed fallback to the styled combobox). */
export function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const id = useId()
  return (
    <div className="field-row">
      <label htmlFor={id}>{label}</label>
      <span className="select-field">
        <select className="select" id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Chevron />
      </span>
    </div>
  )
}

export function SwatchRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const id = useId()
  const [local, setLocal] = useDebounced(value, onChange)
  return (
    <div className="field-row">
      <label htmlFor={id}>{label}</label>
      <label className="swatch">
        <input type="color" id={id} value={local} onChange={(e) => setLocal(e.target.value)} />
        <i style={{ background: local }} />
      </label>
    </div>
  )
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  tabs = false,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  tabs?: boolean
}) {
  return (
    <div className={`segmented${tabs ? ' segmented-tabs' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
