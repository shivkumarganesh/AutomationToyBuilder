import { useRef, useState } from 'react'
import type { CustomCamSpec } from '../model/types'
import { drawnLift } from '../kinematics/camProfile'
import { displacementTable } from '../kinematics/follower'
import {
  DRAWN_MAX_LIFT,
  drawnCamIssues,
  MOTION_PRESETS,
  presetLifts,
} from '../kinematics/drawnMotion'
import { NumberField } from './NumberField'

const W = 280
const H = 132
const X0 = 16
const X1 = 272
const Y0 = 112 // lift 0
const Y1 = 12 // full lift
const TWO_PI = Math.PI * 2

/**
 * Draw the motion, get the cam. Drag the dots to say how high the
 * figure should stand at each point of the turn. The dashed line is
 * what was drawn; the solid line is what the real flat follower will
 * do on the resulting cam (it rounds off sharp corners).
 */
export function MotionEditor({
  cam,
  padWidth,
  rate,
  onChange,
}: {
  cam: CustomCamSpec
  padWidth: number
  rate: number
  onChange: (patch: Partial<CustomCamSpec>) => void
}) {
  const svg = useRef<SVGSVGElement>(null)
  const [active, setActive] = useState<number | null>(null)
  const n = cam.lifts.length
  const xOf = (i: number) => X0 + ((X1 - X0) * i) / n
  const yOf = (lift: number) => Y0 - ((Y0 - Y1) * lift) / DRAWN_MAX_LIFT
  const issues = drawnCamIssues(cam)

  const drawn: string[] = []
  for (let k = 0; k <= 180; k++) {
    const th = (k / 180) * TWO_PI
    drawn.push(`${k ? 'L' : 'M'}${(X0 + ((X1 - X0) * k) / 180).toFixed(1)},${yOf(drawnLift(cam.lifts, th)).toFixed(1)}`)
  }
  // the real follower on this cam, with the cam's own phase taken out so
  // the two curves line up
  const table = displacementTable({ ...cam, phaseDeg: 0 }, padWidth, rate)
  const actual = table.heights
    .map((h, k) => {
      const x = X0 + ((X1 - X0) * k) / table.heights.length
      return `${k ? 'L' : 'M'}${x.toFixed(1)},${yOf(h - cam.baseRadius).toFixed(1)}`
    })
    .join(' ')

  const setFromPointer = (i: number, clientY: number) => {
    const rect = svg.current?.getBoundingClientRect()
    if (!rect) return
    const y = ((clientY - rect.top) / rect.height) * H
    const lift = Math.max(0, Math.min(DRAWN_MAX_LIFT, ((Y0 - y) / (Y0 - Y1)) * DRAWN_MAX_LIFT))
    const lifts = cam.lifts.slice()
    lifts[i] = Math.round(lift * 2) / 2
    onChange({ lifts })
  }

  const travel = Math.max(...cam.lifts)

  return (
    <div className="motion-editor">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label="Motion curve: height against crank angle"
        onPointerMove={(e) => active !== null && setFromPointer(active, e.clientY)}
        onPointerUp={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={X0} x2={X1} y1={yOf(f * DRAWN_MAX_LIFT)} y2={yOf(f * DRAWN_MAX_LIFT)} className="grid" />
        ))}
        {[0, 90, 180, 270, 360].map((deg) => (
          <text key={deg} x={X0 + ((X1 - X0) * deg) / 360} y={H - 4} textAnchor="middle" className="axis">
            {deg}°
          </text>
        ))}
        <path d={drawn.join(' ')} className="drawn" />
        <path d={actual} className="actual" />
        {cam.lifts.map((lift, i) => (
          <circle
            key={i}
            cx={xOf(i)}
            cy={yOf(lift)}
            r={active === i ? 7 : 5.5}
            className="handle"
            tabIndex={0}
            role="slider"
            aria-label={`Height at ${Math.round((i / n) * 360)}°`}
            aria-valuemin={0}
            aria-valuemax={DRAWN_MAX_LIFT}
            aria-valuenow={lift}
            onPointerDown={(e) => {
              e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId)
              setActive(i)
            }}
            onKeyDown={(e) => {
              const step = e.key === 'ArrowUp' ? 0.5 : e.key === 'ArrowDown' ? -0.5 : 0
              if (!step) return
              e.preventDefault()
              const lifts = cam.lifts.slice()
              lifts[i] = Math.max(0, Math.min(DRAWN_MAX_LIFT, lift + step))
              onChange({ lifts })
            }}
          />
        ))}
      </svg>
      <p className="hint">
        Drag the dots: how high the figure stands through one turn of the crank. Dashed =
        your drawing, solid = what the follower really does.
      </p>
      {issues.map((msg) => (
        <p key={msg} className="hint warn">
          {msg}
        </p>
      ))}
      <div className="chip-row">
        {MOTION_PRESETS.map((p) => (
          <button
            key={p.id}
            className="chip plain"
            onClick={() => onChange({ lifts: presetLifts(p, Math.max(6, travel)) })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <NumberField
        label="Cam size (bigger = gentler climbs)"
        value={cam.baseRadius}
        min={10}
        max={30}
        onChange={(v) => onChange({ baseRadius: v })}
      />
    </div>
  )
}
