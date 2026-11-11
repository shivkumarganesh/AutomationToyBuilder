import { useRef } from 'react'
import { useDesignerStore } from '../model/store'
import { SCENES, type SceneId } from '../model/catalog'
import { FIGURE_SHAPES } from '../model/figures'
import { PROP_SHAPES } from '../model/props'
import { interiorWidth, outputChannels, type AutomatonSpec, type OutputChannel } from '../model/types'
import { propRowZ, propWorldX } from '../scene/propLayout'
import { propConflicts } from '../export/svgFlatPack'
import './stage-map.css'

/** A figure as the stage map sees it: where it stands and whether it can be slid along. */
export interface StageFigure {
  id: string
  label: string
  color: string
  x: number
  width: number
  channel: OutputChannel
  /** Figures that share a mechanism (wings, body segments) move as one in their own card. */
  movable: boolean
}

export function stageFigures(spec: AutomatonSpec): StageFigure[] {
  const channels = outputChannels(spec)
  return spec.characters.flatMap((ch) => {
    const channel = channels.find((c) => c.id === ch.channelId)
    if (!channel) return []
    const shared =
      spec.characters.some((c) => c.id !== ch.id && c.channelId === ch.channelId) ||
      spec.characters.some((c) => (c.limbs ?? []).some((l) => l.channelId === ch.channelId))
    const segment = ch.kind === 'silhouette' && !!FIGURE_SHAPES[ch.shape ?? '']?.partOf
    return [
      {
        id: ch.id,
        label: ch.label,
        color: ch.color,
        x: channel.x,
        width: ch.width,
        channel,
        movable: !shared && !segment && ch.kind !== 'flyer' && ch.kind !== 'articulated',
      },
    ]
  })
}

/** Pairs of figures whose plates would overlap when seen from the front. */
export function crowdedFigures(spec: AutomatonSpec): string[] {
  const figs = stageFigures(spec).filter((f) => f.movable)
  const bad = new Set<string>()
  for (const a of figs)
    for (const b of figs)
      if (a.id < b.id && Math.abs(a.x - b.x) < (a.width + b.width) / 2) {
        bad.add(a.id)
        bad.add(b.id)
      }
  return [...bad]
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * The stage seen from above. Drag a figure along the shaft, drag scenery
 * sideways or between the front and back rows; the 3D toy follows.
 */
export function StageMap() {
  const spec = useDesignerStore((s) => s.spec)
  const svg = useRef<SVGSVGElement>(null)
  const { width: w, depth: d } = spec.frame
  const inner = interiorWidth(spec.frame)
  const figures = stageFigures(spec)
  const crowded = crowdedFigures(spec)
  const conflicts = propConflicts(spec)
  const props = spec.props ?? []
  const pad = 5

  const toStage = (e: React.PointerEvent) => {
    const m = svg.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: p.x, z: p.y }
  }
  const drag = (move: (at: { x: number; z: number }) => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      e.preventDefault()
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!(e.currentTarget as Element).hasPointerCapture(e.pointerId)) return
      const at = toStage(e)
      if (at) move(at)
    },
  })

  const moveFigure = (f: StageFigure, x: number) => {
    const position = Math.round(clamp((x + inner / 2) / inner, 0.1, 0.9) * 100) / 100
    const s = useDesignerStore.getState()
    const c = f.channel
    if (c.kind === 'spin') {
      if (c.spinner.position !== position) s.updateSpinner(c.id, { position })
    } else if (c.kind === 'path') {
      if (c.linkage.position !== position) s.updateLinkage(c.id, { position })
    } else if (c.cam.position !== position) s.updateCam(c.cam.id, { position })
  }
  const nudge = (e: React.KeyboardEvent, by: (step: number) => void) => {
    if (e.key === 'ArrowLeft') by(-1)
    else if (e.key === 'ArrowRight') by(1)
    else return
    e.preventDefault()
  }

  const rowZ = propRowZ(spec.frame, 'front')
  const current = (Object.keys(SCENES) as SceneId[]).filter((id) => id !== 'none')

  return (
    <div className="stage-map">
      <svg
        ref={svg}
        viewBox={`${-w / 2 - pad} ${-d / 2 - pad} ${w + 2 * pad} ${d + 2 * pad}`}
        role="group"
        aria-label="Stage layout seen from above"
      >
        <rect className="sm-stage" x={-w / 2} y={-d / 2} width={w} height={d} rx={2} />
        <line className="sm-row" x1={-w / 2 + 4} x2={w / 2 - 4} y1={-rowZ} y2={-rowZ} />
        <line className="sm-row" x1={-w / 2 + 4} x2={w / 2 - 4} y1={rowZ} y2={rowZ} />
        <line className="sm-shaft" x1={-inner / 2} x2={inner / 2} y1={0} y2={0} />
        <text className="sm-note" x={-w / 2 + 3} y={-d / 2 + 6}>
          back
        </text>
        <text className="sm-note" x={-w / 2 + 3} y={d / 2 - 2.5}>
          front
        </text>
        {props.map((p) => {
          const x = propWorldX(spec.frame, p)
          const z = propRowZ(spec.frame, p.row)
          const label = PROP_SHAPES[p.shape]?.label ?? p.shape
          const set = (position: number, row = p.row) => {
            const next = Math.round(clamp(position, 0.05, 0.95) * 100) / 100
            if (next !== p.position || row !== p.row)
              useDesignerStore.getState().updateProp(p.id, { position: next, row })
          }
          return (
            <g
              key={p.id}
              className={`sm-prop${conflicts.includes(p.id) ? ' bad' : ''}`}
              tabIndex={0}
              aria-label={`${label}, ${p.row === 'front' ? 'front' : 'back'} row`}
              onKeyDown={(e) => {
                nudge(e, (step) => set(p.position + step * 0.02))
                if (e.key === 'ArrowUp') set(p.position, 'back')
                if (e.key === 'ArrowDown') set(p.position, 'front')
              }}
              {...drag((at) => set((at.x + w / 2) / w, at.z > 0 ? 'front' : 'back'))}
            >
              <title>{`${label} — drag sideways, or across to the other row`}</title>
              <rect x={x - p.width / 2} y={z - 6} width={p.width} height={12} fill="transparent" />
              <rect x={x - p.width / 2} y={z - 2.2} width={p.width} height={4.4} rx={1.5} fill={p.color} />
            </g>
          )
        })}
        {figures.map((f) => (
          <g
            key={f.id}
            className={`sm-figure${f.movable ? '' : ' fixed'}${crowded.includes(f.id) ? ' bad' : ''}`}
            tabIndex={f.movable ? 0 : undefined}
            aria-label={f.label}
            onKeyDown={(e) => f.movable && nudge(e, (step) => moveFigure(f, f.x + step * inner * 0.02))}
            {...(f.movable ? drag((at) => moveFigure(f, at.x)) : {})}
          >
            <title>
              {f.movable ? `${f.label} — drag along the box` : `${f.label} — part of a jointed creature`}
            </title>
            <rect x={f.x - f.width / 2} y={-9} width={f.width} height={18} fill="transparent" />
            <rect x={f.x - f.width / 2} y={-3} width={f.width} height={6} rx={2} fill={f.color} />
            <circle cx={f.x} cy={0} r={5.5} fill={f.color} />
            <text x={f.x} y={2.3} textAnchor="middle">
              {f.label.slice(0, 1).toUpperCase()}
            </text>
          </g>
        ))}
      </svg>
      {crowded.length > 0 && (
        <p className="hint warn">Two figures overlap — drag them apart, or make the box wider.</p>
      )}
      {conflicts.length > 0 && (
        <p className="hint warn">A piece of scenery (red) collides with a slot or hangs off the stage.</p>
      )}
      <div className="chip-row">
        <span className="sm-label">Scenery set</span>
        {current.map((id) => (
          <button key={id} className="chip plain" onClick={() => useDesignerStore.getState().setScene(id)}>
            {SCENES[id].label}
          </button>
        ))}
        <button className="chip plain" onClick={() => useDesignerStore.getState().setScene('none')}>
          Clear
        </button>
      </div>
      <p className="hint">
        The stage from above. Drag figures along the box and scenery sideways or between rows — or
        use the arrow keys.
      </p>
    </div>
  )
}
