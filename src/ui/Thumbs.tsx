import type { Point2 } from '../model/figures'
import { FIGURE_SHAPES } from '../model/figures'
import { PROP_SHAPES } from '../model/props'
import type { MotionId } from '../model/catalog'

/** A library outline drawn to fit a square thumbnail, feet/base down. */
function OutlineThumb({
  outline,
  layers = [],
  engrave = [],
  aspect,
  color,
  size,
}: {
  outline: Point2[]
  layers?: Point2[][]
  engrave?: Point2[][]
  /** width / height of the real shape */
  aspect: number
  color: string
  size: number
}) {
  const w = aspect >= 1 ? 1 : aspect
  const h = aspect >= 1 ? 1 / aspect : 1
  const path = (pts: Point2[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${(p.x * w).toFixed(3)},${(-p.y * h).toFixed(3)}`).join(' ')
  const d = path(outline)
  const pad = 0.08
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-0.5 - pad} ${-(1 + h) / 2 - pad} ${1 + 2 * pad} ${1 + 2 * pad}`}
      aria-hidden="true"
    >
      <path d={`${d} Z`} fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth={0.012} strokeLinejoin="round" />
      {layers.map((l, i) => (
        <path key={`l${i}`} d={`${path(l)} Z`} fill="rgba(0,0,0,0.18)" stroke="rgba(0,0,0,0.4)" strokeWidth={0.01} />
      ))}
      {engrave.map((l, i) => (
        <path
          key={`e${i}`}
          d={path(l)}
          fill="none"
          stroke="rgba(0,0,0,0.5)"
          strokeWidth={0.014}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

export function FigureThumb({ shape, color, size = 72 }: { shape: string; color: string; size?: number }) {
  const s = FIGURE_SHAPES[shape]
  if (!s) return null
  return (
    <OutlineThumb
      outline={s.outline}
      layers={s.layers}
      engrave={s.engrave}
      aspect={s.defaultWidth / s.defaultHeight}
      color={color}
      size={size}
    />
  )
}

export function PropThumb({ shape, color, size = 48 }: { shape: string; color?: string; size?: number }) {
  const s = PROP_SHAPES[shape]
  if (!s) return null
  return (
    <OutlineThumb
      outline={s.outline}
      aspect={s.defaultWidth / s.defaultHeight}
      color={color ?? s.defaultColor}
      size={size}
    />
  )
}

/** A tiny looping animation showing what a motion looks like. */
export function MotionIcon({ motion, size = 56 }: { motion: MotionId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" className="motion-icon" aria-hidden="true">
      <rect x="6" y="44" width="44" height="4" rx="2" className="motion-stage" />
      <g className={`motion-fig motion-${motion}`}>
        {motion === 'spin' ? (
          <ellipse cx="28" cy="28" rx="9" ry="12" />
        ) : (
          <rect x="19" y="20" width="18" height="22" rx="6" />
        )}
      </g>
    </svg>
  )
}

export function Difficulty({ level }: { level: 1 | 2 | 3 }) {
  const label = level === 1 ? 'Easy' : level === 2 ? 'Medium' : 'Advanced'
  return (
    <span className="difficulty" title={`Build difficulty: ${label}`}>
      {[1, 2, 3].map((n) => (
        <i key={n} className={n <= level ? 'on' : ''} />
      ))}
      {label}
    </span>
  )
}
