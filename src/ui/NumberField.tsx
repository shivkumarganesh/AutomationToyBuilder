interface Props {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

/** Slider + numeric input pair for one parametric value. */
export function NumberField({ label, value, min, max, step = 1, unit = 'mm', onChange }: Props) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  return (
    <div className="field">
      <label>
        <span>{label}</span>
        <span>
          {value}
          {unit ? ` ${unit}` : ''}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (!Number.isNaN(v)) onChange(clamp(v))
        }}
      />
    </div>
  )
}
