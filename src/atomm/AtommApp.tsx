import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AutomatonScene } from '../scene/AutomatonScene'
import { useDesignerStore, channelCount, MAX_CHANNELS } from '../model/store'
import { useUiStore } from '../ui/uiStore'
import { templates } from '../model/templates'
import { camAngularRate, outputChannels, type AutomatonSpec, type CamSpec, type CharacterSpec } from '../model/types'
import { CUSTOM_SHAPE, FIGURE_SHAPES, PICKABLE_FIGURES, type Point2 } from '../model/figures'
import { MAX_PROPS, PROP_SHAPES } from '../model/props'
import { ARTICULATED_TEMPLATES, composeToy, FIGURE_INFO, MOTIONS, type MotionId } from '../model/catalog'
import { traceMask, type TracedShape } from '../model/tracing'
import { channelSignals } from '../kinematics/channels'
import { drawnFrom } from '../kinematics/drawnMotion'
import { flyerIssues } from '../scene/flyerLayout'
import { flatPackSvg, propConflicts } from '../export/svgFlatPack'
import { exportStl } from '../export/stlExport'
import { buildGuide, guideHtml } from '../export/buildGuide'
import { BASSWOOD, basswoodAudit, narrowestWeb } from '../export/basswood'
import { downloadFile } from '../export/download'
import { unlockSound } from '../ui/sound'
import { NumberRow, PropCard, Segmented, SelectRow, SliderRow, SwatchRow, SwitchRow, type Units } from './fields'
import {
  IconBack,
  IconBulb,
  IconCheck,
  IconClose,
  IconFigure,
  IconFit,
  IconGrid,
  IconImport,
  IconInfo,
  IconMinus,
  IconPanel,
  IconPlus,
  IconReset,
  IconScenery,
  IconTrash,
  IconWarn,
} from './icons'

type Tool = 'toys' | 'figures' | 'scenery' | 'own'
type ViewTab = '3d' | 'sheets' | 'guide'

const TOOLS: { id: Tool; label: string; title: string; icon: ReactNode }[] = [
  { id: 'toys', label: 'Toys', title: 'Ready-made toys', icon: <IconGrid /> },
  { id: 'figures', label: 'Figures', title: 'Start from a figure', icon: <IconFigure /> },
  { id: 'scenery', label: 'Scenery', title: 'Scenery', icon: <IconScenery /> },
  { id: 'own', label: 'Import', title: 'Your own figure', icon: <IconImport /> },
]

const TOY_ORDER = [...ARTICULATED_TEMPLATES, ...Object.keys(templates).filter((k) => !ARTICULATED_TEMPLATES.includes(k))]

/** A library outline as an inline SVG that fills its tile, base down. */
function OutlineIcon({ outline, aspect }: { outline: Point2[]; aspect: number }) {
  const w = aspect >= 1 ? 1 : aspect
  const h = aspect >= 1 ? 1 / aspect : 1
  const d = outline.map((p, i) => `${i ? 'L' : 'M'}${(p.x * w).toFixed(3)},${(-p.y * h).toFixed(3)}`).join(' ')
  return (
    <svg viewBox={`-0.55 ${-(1 + h) / 2 - 0.05} 1.1 1.1`} aria-hidden="true">
      <path d={`${d} Z`} fill="currentColor" stroke="none" />
    </svg>
  )
}

/* ───────────────────────── lead panels ───────────────────────── */

function PanelHeader({ title, onCollapse }: { title: string; onCollapse: () => void }) {
  return (
    <div className="gen-rail-header">
      <span className="gen-rail-title">{title}</span>
      <button type="button" className="btn-plate" aria-label="Collapse panel" onClick={onCollapse}>
        <IconPanel />
      </button>
    </div>
  )
}

function ToysPanel({ onCollapse }: { onCollapse: () => void }) {
  const name = useDesignerStore((s) => s.spec.name)
  const loadTemplate = useDesignerStore((s) => s.loadTemplate)
  return (
    <>
      <PanelHeader title="Ready-made toys" onCollapse={onCollapse} />
      <div className="gen-rail-scroll">
        <div className="thumb-grid" role="listbox" aria-label="Toys">
          {TOY_ORDER.map((key) => {
            const spec = templates[key]
            return (
              <button
                key={key}
                type="button"
                className="thumb"
                role="option"
                aria-selected={spec.name === name}
                onClick={() => loadTemplate(spec)}
              >
                <span className="thumb-card">
                  <img src={`${import.meta.env.BASE_URL}thumbs/studio-${key}.jpg`} alt="" width="560" height="560" />
                </span>
                <span className="thumb-label">{spec.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

/** Second level of a panel: choose how the picked figure moves. */
function MotionView({
  title,
  recommended,
  onBack,
  onBuild,
  onAdd,
}: {
  title: string
  recommended: MotionId[]
  onBack: () => void
  onBuild: (m: MotionId) => void
  onAdd?: (m: MotionId) => void
}) {
  const [motion, setMotion] = useState<MotionId>(recommended[0] ?? 'bob')
  const order = (Object.keys(MOTIONS) as MotionId[]).sort((a, b) => {
    const ia = recommended.indexOf(a)
    const ib = recommended.indexOf(b)
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib)
  })
  return (
    <>
      <div className="gen-rail-header">
        <button type="button" className="rail-back" onClick={onBack}>
          <IconBack />
          <span>{title}</span>
        </button>
      </div>
      <div className="gen-rail-scroll">
        <div className="gen-rail-content">
          <div className="rail-section">
            <h4>How it moves</h4>
            <div className="atomm-motion-list" role="listbox" aria-label="Motion">
              {order.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="atomm-motion"
                  role="option"
                  aria-selected={motion === m}
                  onClick={() => setMotion(m)}
                >
                  <span>
                    <b>{MOTIONS[m].label}</b>
                    {recommended[0] === m && <span className="tag">Best match</span>}
                  </span>
                  <small>{MOTIONS[m].blurb}</small>
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => onBuild(motion)}>
            Build toy
          </button>
          {onAdd && (
            <button type="button" className="btn btn-secondary btn-block" onClick={() => onAdd(motion)}>
              Add to this toy
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function FiguresPanel({ onCollapse }: { onCollapse: () => void }) {
  const [picked, setPicked] = useState<string | null>(null)
  const loadTemplate = useDesignerStore((s) => s.loadTemplate)
  const addFigureWithMotion = useDesignerStore((s) => s.addFigureWithMotion)
  const full = useDesignerStore((s) => channelCount(s.spec) >= MAX_CHANNELS)
  if (picked)
    return (
      <MotionView
        title={FIGURE_SHAPES[picked].label}
        recommended={FIGURE_INFO[picked]?.motions ?? []}
        onBack={() => setPicked(null)}
        onBuild={(m) => {
          loadTemplate(composeToy(picked, m))
          setPicked(null)
        }}
        onAdd={
          full
            ? undefined
            : (m) => {
                addFigureWithMotion(picked, m)
                setPicked(null)
              }
        }
      />
    )
  return (
    <>
      <PanelHeader title="Start from a figure" onCollapse={onCollapse} />
      <div className="gen-rail-scroll">
        <div className="gen-rail-content">
          <div className="thumb-grid-sm" role="listbox" aria-label="Figures">
            {PICKABLE_FIGURES.map((shape) => (
              <button
                key={shape.id}
                type="button"
                className="thumb thumb-sm"
                role="option"
                aria-selected="false"
                onClick={() => setPicked(shape.id)}
              >
                <span className="thumb-card">
                  <OutlineIcon outline={shape.outline} aspect={shape.defaultWidth / shape.defaultHeight} />
                </span>
                <span className="thumb-label">{shape.label}</span>
              </button>
            ))}
          </div>
          <p className="field-note" style={{ padding: 0 }}>
            Pick a figure, then choose how it moves. The mechanism is built for you.
          </p>
        </div>
      </div>
    </>
  )
}

function SceneryPanel({ onCollapse }: { onCollapse: () => void }) {
  const addProp = useDesignerStore((s) => s.addProp)
  const count = useDesignerStore((s) => (s.spec.props ?? []).length)
  return (
    <>
      <PanelHeader title="Scenery" onCollapse={onCollapse} />
      <div className="gen-rail-scroll">
        <div className="gen-rail-content">
          <div className="thumb-grid-sm" aria-label="Scenery">
            {Object.values(PROP_SHAPES).map((shape) => (
              <button
                key={shape.id}
                type="button"
                className="thumb thumb-sm"
                disabled={count >= MAX_PROPS}
                onClick={() => addProp(shape.id)}
              >
                <span className="thumb-card">
                  <OutlineIcon outline={shape.outline} aspect={shape.defaultWidth / shape.defaultHeight} />
                </span>
                <span className="thumb-label">{shape.label}</span>
              </button>
            ))}
          </div>
          <p className="field-note" style={{ padding: 0 }}>
            {count >= MAX_PROPS
              ? `A stage holds ${MAX_PROPS} pieces of scenery.`
              : 'Click to stand a piece on the stage. Place it in the Scenery card on the right.'}
          </p>
        </div>
      </div>
    </>
  )
}

const TRACE_RES = 200

function OwnPanel({ onCollapse }: { onCollapse: () => void }) {
  const [shape, setShape] = useState<(TracedShape & { width: number; height: number }) | null>(null)
  const [fileName, setFileName] = useState('')
  const [failed, setFailed] = useState(false)
  const [choose, setChoose] = useState(false)
  const loadTemplate = useDesignerStore((s) => s.loadTemplate)

  const upload = (file: File) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = TRACE_RES
      const g = canvas.getContext('2d', { willReadFrequently: true })!
      g.fillStyle = '#ffffff'
      g.fillRect(0, 0, TRACE_RES, TRACE_RES)
      const scale = Math.min((TRACE_RES - 16) / img.width, (TRACE_RES - 16) / img.height)
      g.drawImage(img, (TRACE_RES - img.width * scale) / 2, (TRACE_RES - img.height * scale) / 2, img.width * scale, img.height * scale)
      URL.revokeObjectURL(img.src)
      const px = g.getImageData(0, 0, TRACE_RES, TRACE_RES).data
      const data = new Uint8Array(TRACE_RES * TRACE_RES)
      for (let i = 0; i < data.length; i++) {
        const lum = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]
        data[i] = lum < 150 ? 1 : 0
      }
      const traced = traceMask({ width: TRACE_RES, height: TRACE_RES, data })
      setFileName(file.name)
      setFailed(!traced)
      if (!traced) return setShape(null)
      let height = 40
      let width = height * traced.aspect
      if (width > 64) {
        width = 64
        height = width / traced.aspect
      }
      setShape({ ...traced, width: Math.round(width), height: Math.round(height) })
    }
    img.onerror = () => setFailed(true)
    img.src = URL.createObjectURL(file)
  }

  if (choose && shape)
    return (
      <MotionView
        title="Your figure"
        recommended={FIGURE_INFO.custom.motions}
        onBack={() => setChoose(false)}
        onBuild={(m) => {
          loadTemplate(composeToy(CUSTOM_SHAPE, m, { outline: shape.outline, width: shape.width, height: shape.height }))
          setChoose(false)
        }}
      />
    )

  const neck = shape ? narrowestWeb(shape.outline.map((p) => ({ x: p.x * shape.width, y: p.y * shape.height }))) : Infinity
  return (
    <>
      <PanelHeader title="Your own figure" onCollapse={onCollapse} />
      <div className="gen-rail-scroll">
        <div className="gen-rail-content">
          <label className="dropzone">
            <span className="plate">
              <IconImport />
            </span>
            <strong>Click to choose a picture</strong>
            <small>A dark shape on a light background · PNG / JPG / SVG</small>
            <input
              type="file"
              accept="image/*"
              aria-label="Picture of your figure"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) upload(f)
                e.target.value = ''
              }}
            />
          </label>
          {fileName && <p className="field-note" style={{ padding: 0 }}>{fileName}</p>}
          {failed && (
            <div className="alert alert-error" role="alert">
              <IconWarn />
              <p>Nothing dark enough to trace. Use a solid dark shape on a plain light background.</p>
            </div>
          )}
          {shape && (
            <>
              <div className="atomm-trace" aria-label="Traced figure">
                <OutlineIcon outline={shape.outline} aspect={shape.aspect} />
              </div>
              {neck >= BASSWOOD.minWeb ? (
                <div className="alert alert-success">
                  <IconCheck />
                  <p>
                    Cuts cleanly in {BASSWOOD.thickness} mm basswood at {shape.width} × {shape.height} mm.
                  </p>
                </div>
              ) : (
                <div className="alert alert-warning" role="alert">
                  <IconWarn />
                  <p>A neck is only {neck.toFixed(1)} mm wide and would snap. Use a picture with thicker parts.</p>
                </div>
              )}
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => setChoose(true)}>
                Choose a motion
              </button>
            </>
          )}
          <p className="field-note" style={{ padding: 0 }}>
            Stand the picture upright: its bottom edge is where the figure mounts.
          </p>
        </div>
      </div>
    </>
  )
}

/* ───────────────────────── parameters ───────────────────────── */

function camFor(cam: CamSpec, motion: 'bob' | 'bounce' | 'drop'): CamSpec {
  const base = { id: cam.id, position: cam.position, phaseDeg: cam.phaseDeg, thickness: cam.thickness, ...(cam.shaft ? { shaft: cam.shaft } : {}) }
  if (motion === 'bounce') return { ...base, kind: 'petal', baseRadius: 16, lift: 8, lobes: 3 }
  if (motion === 'drop') return { ...base, kind: 'snail', baseRadius: 14, lift: 12 }
  return { ...base, kind: 'eccentric', radius: 20, eccentricity: 8 }
}

function FigureCard({ ch, spec, units }: { ch: CharacterSpec; spec: AutomatonSpec; units: Units }) {
  const s = useDesignerStore.getState()
  const channel = outputChannels(spec).find((c) => c.id === ch.channelId)
  if (!channel) return null
  const camKind = channel.kind === 'lift' || channel.kind === 'tilt' ? channel.cam.kind : null
  const feel = camKind === 'petal' ? 'bounce' : camKind === 'snail' ? 'drop' : camKind === 'custom' ? 'custom' : 'bob'
  const lib = ch.kind === 'silhouette' && ch.shape && FIGURE_SHAPES[ch.shape]
  const sizePct = lib ? Math.round((ch.height / lib.defaultHeight) * 100) : null
  const shared = spec.characters.some((c) => c.id !== ch.id && c.channelId === ch.channelId)
  const remove = () => {
    if (shared || channelCount(spec) <= 1) return s.removeCharacter(ch.id)
    if (channel.kind === 'spin') s.removeSpinner(channel.id)
    else if (channel.kind === 'path') s.removeLinkage(channel.id)
    else s.removeCam(channel.cam.id)
  }
  return (
    <PropCard title={ch.label}>
      {channel.kind === 'lift' && (
        <SelectRow
          label="Motion"
          value={feel}
          options={[
            { value: 'bob', label: 'Bob' },
            { value: 'bounce', label: 'Bounce' },
            { value: 'drop', label: 'Climb & drop' },
            ...(feel === 'custom' ? [{ value: 'custom' as const, label: 'Drawn' }] : []),
          ]}
          onChange={(m) => m !== 'custom' && s.updateCam(channel.cam.id, camFor(channel.cam, m))}
        />
      )}
      {channel.kind === 'tilt' && <div className="field-row"><span className="field-label">Motion</span><span className="value">Rock</span></div>}
      {channel.kind === 'spin' && <div className="field-row"><span className="field-label">Motion</span><span className="value">Spin</span></div>}
      {channel.kind === 'path' && <div className="field-row"><span className="field-label">Motion</span><span className="value">Swoop</span></div>}
      {(channel.kind === 'lift' || channel.kind === 'tilt') && channel.cam.kind === 'eccentric' && (
        <NumberRow
          label="Travel"
          value={channel.cam.eccentricity * 2}
          min={2}
          max={Math.max(2, (channel.cam.radius - 4) * 2)}
          step={1}
          units={units}
          onChange={(v) => s.updateCam(channel.cam.id, { eccentricity: v / 2 })}
        />
      )}
      {(channel.kind === 'lift' || channel.kind === 'tilt') && (channel.cam.kind === 'petal' || channel.cam.kind === 'snail') && (
        <NumberRow label="Travel" value={channel.cam.lift} min={2} max={15} units={units} onChange={(v) => s.updateCam(channel.cam.id, { lift: v })} />
      )}
      {channel.kind === 'lift' && channel.cam.kind === 'petal' && (
        <SliderRow label="Hops per turn" value={channel.cam.lobes} min={2} max={8} onChange={(v) => s.updateCam(channel.cam.id, { lobes: Math.round(v) })} />
      )}
      {channel.kind === 'lift' && channel.cam.kind !== 'custom' && (
        <div className="field-row">
          <span className="field-label">Custom curve</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => s.updateCam(channel.cam.id, drawnFrom(channel.cam, channel.pushrod.padWidth, camAngularRate(spec.mechanism, channel.cam)))}
          >
            Convert
          </button>
        </div>
      )}
      {channel.kind === 'lift' && channel.cam.kind === 'custom' &&
        channel.cam.lifts.map((lift, i) => (
          <SliderRow
            key={i}
            label={`Height at ${Math.round((i / (channel.cam as { lifts: number[] }).lifts.length) * 360)}°`}
            value={lift}
            min={0}
            max={18}
            step={0.5}
            unit=" mm"
            onChange={(v) => {
              const cam = channel.cam as { lifts: number[] }
              const lifts = cam.lifts.slice()
              lifts[i] = v
              s.updateCam(channel.cam.id, { lifts } as Partial<CamSpec>)
            }}
          />
        ))}
      {(channel.kind === 'lift' || channel.kind === 'tilt') && (
        <SliderRow label="Timing" value={channel.cam.phaseDeg} min={0} max={360} step={15} unit="°" onChange={(v) => s.updateCam(channel.cam.id, { phaseDeg: v })} />
      )}
      {channel.kind === 'spin' && (channel.spinner.drive ?? 'friction') === 'friction' && (
        <SliderRow label="Spins per turn" value={channel.spinner.ratio} min={0.25} max={2} step={0.25} unit="×" onChange={(v) => s.updateSpinner(channel.id, { ratio: v })} />
      )}
      {channel.kind === 'path' && (
        <NumberRow label="Swoop size" value={channel.linkage.crankRadius} min={5} max={14} units={units} onChange={(v) => s.updateLinkage(channel.id, { crankRadius: v })} />
      )}
      {sizePct !== null && (
        <SliderRow
          label="Size"
          value={sizePct}
          min={60}
          max={160}
          step={5}
          unit="%"
          onChange={(v) => lib && s.updateCharacter(ch.id, { width: Math.round((lib.defaultWidth * v) / 100), height: Math.round((lib.defaultHeight * v) / 100) })}
        />
      )}
      {ch.kind === 'silhouette' && (
        <SliderRow label="Depth layers" value={ch.relief ?? 0} min={0} max={3} onChange={(v) => s.updateCharacter(ch.id, { relief: Math.round(v) })} />
      )}
      <SwatchRow label="Colour" value={ch.color} onChange={(v) => s.updateCharacter(ch.id, { color: v })} />
      {spec.characters.length > 1 && (
        <div className="field-row">
          <span className="field-label">Remove figure</span>
          <button type="button" className="btn-icon btn-icon-sm" aria-label={`Remove ${ch.label}`} onClick={remove}>
            <IconTrash />
          </button>
        </div>
      )}
    </PropCard>
  )
}

function rodCam(spec: AutomatonSpec, rodId: string) {
  const rod = spec.mechanism.pushrods.find((r) => r.id === rodId)
  return spec.mechanism.cams.find((c) => c.id === rod?.camId)
}
const travelOf = (spec: AutomatonSpec, rodId: string) => {
  const cam = rodCam(spec, rodId)
  return cam?.kind === 'eccentric' ? cam.eccentricity * 2 : 0
}
function setTravel(spec: AutomatonSpec, rods: string[], travel: number) {
  const s = useDesignerStore.getState()
  for (const id of rods) {
    const cam = rodCam(spec, id)
    if (cam?.kind === 'eccentric') s.updateCam(cam.id, { eccentricity: travel / 2 })
  }
}

function FlyerCard({ ch, spec, units }: { ch: CharacterSpec; spec: AutomatonSpec; units: Units }) {
  const s = useDesignerStore.getState()
  const f = ch.flyer!
  const inner = [f.left[0], f.right[0]]
  const outer = f.left.length > 1 ? [f.left[1], f.right[1]] : []
  const innerPhase = rodCam(spec, inner[0])?.phaseDeg ?? 0
  const lag = outer.length ? ((((rodCam(spec, outer[0])?.phaseDeg ?? 0) - innerPhase) % 360) + 360) % 360 : 0
  const issues = flyerIssues(spec, ch, channelSignals(spec))
  return (
    <PropCard title={`${ch.label} · wings`}>
      <NumberRow label={outer.length ? 'Flap at shoulder' : 'Flap'} value={travelOf(spec, inner[0])} min={2} max={24} units={units} onChange={(v) => setTravel(spec, inner, v)} />
      {outer.length > 0 && (
        <>
          <NumberRow label="Whip at wing tip" value={travelOf(spec, outer[0])} min={2} max={28} units={units} onChange={(v) => setTravel(spec, outer, v)} />
          <SliderRow
            label="Ripple"
            value={lag}
            min={0}
            max={120}
            step={5}
            unit="°"
            onChange={(v) => {
              for (const id of outer) {
                const cam = rodCam(spec, id)
                if (cam) s.updateCam(cam.id, { phaseDeg: (innerPhase + v) % 360 })
              }
            }}
          />
        </>
      )}
      <SliderRow label="Body ridge layers" value={ch.relief ?? 0} min={0} max={3} onChange={(v) => s.updateCharacter(ch.id, { relief: Math.round(v) })} />
      <NumberRow label="Tip overhang" value={ch.height} min={6} max={40} units={units} onChange={(v) => s.updateCharacter(ch.id, { height: v })} />
      <SwatchRow label="Colour" value={ch.color} onChange={(v) => s.updateCharacter(ch.id, { color: v })} />
      {issues.map((m) => (
        <div key={m} className="alert alert-warning atomm-card-alert" role="alert">
          <IconWarn />
          <p>{m}</p>
        </div>
      ))}
    </PropCard>
  )
}

function SegmentsCard({ parts, spec, units }: { parts: CharacterSpec[]; spec: AutomatonSpec; units: Units }) {
  const s = useDesignerStore.getState()
  const channels = outputChannels(spec)
  const ordered = [...parts].sort(
    (a, b) => (channels.find((c) => c.id === b.channelId)?.x ?? 0) - (channels.find((c) => c.id === a.channelId)?.x ?? 0),
  )
  const rods = ordered.map((p) => p.channelId)
  const phases = rods.map((id) => rodCam(spec, id)?.phaseDeg ?? 0)
  const lag = phases.length > 1 ? (((phases[1] - phases[0]) % 360) + 360) % 360 : 0
  return (
    <PropCard title={`Swimming fish · ${parts.length} segments`}>
      <NumberRow label="Wave height" value={travelOf(spec, rods[0])} min={2} max={16} units={units} onChange={(v) => setTravel(spec, rods, v)} />
      <SliderRow
        label="Delay per segment"
        value={lag}
        min={0}
        max={120}
        step={5}
        unit="°"
        onChange={(v) =>
          rods.forEach((id, i) => {
            const cam = rodCam(spec, id)
            if (cam) s.updateCam(cam.id, { phaseDeg: (i * v) % 360 })
          })
        }
      />
      <SwatchRow label="Colour" value={ordered[0].color} onChange={(v) => parts.forEach((p) => s.updateCharacter(p.id, { color: v }))} />
    </PropCard>
  )
}

function CrankCard() {
  const isCranking = useDesignerStore((s) => s.isCranking)
  const speed = useDesignerStore((s) => s.crankSpeed)
  const seeThrough = useDesignerStore((s) => s.seeThrough)
  // read once per render of this card; the live angle is shown in the 3D view itself
  const [angle, setAngle] = useState(0)
  const sound = useUiStore((s) => s.sound)
  const st = useDesignerStore.getState()
  return (
    <PropCard title="Crank">
      <SwitchRow
        label="Turn the crank"
        checked={isCranking}
        onChange={(v) => {
          unlockSound()
          st.setCranking(v)
        }}
      />
      <SliderRow label="Speed" value={speed} min={0.05} max={1.5} step={0.05} unit=" rev/s" onChange={(v) => st.setCrankSpeed(v)} />
      <SliderRow
        label="Angle"
        value={angle}
        min={0}
        max={359}
        unit="°"
        onChange={(v) => {
          setAngle(v)
          st.setCranking(false)
          st.setCrankAngle((v * Math.PI) / 180)
        }}
      />
      <SwitchRow label="See inside the box" checked={seeThrough} onChange={(v) => st.setSeeThrough(v)} />
      <SwitchRow
        label="Sound"
        checked={sound}
        onChange={(v) => {
          unlockSound()
          useUiStore.getState().setSound(v)
        }}
      />
      <p className="field-note">Or grab the red handle in the 3D preview and turn it.</p>
    </PropCard>
  )
}

function ParamsRail({ units, setUnits }: { units: Units; setUnits: (u: Units) => void }) {
  const spec = useDesignerStore((s) => s.spec)
  const s = useDesignerStore.getState()
  const method = useUiStore((u) => u.method)
  const setMethod = useUiStore((u) => u.setMethod)
  const inAtomm = useUiStore((u) => u.inAtomm)
  const finish = useUiStore((u) => u.finish)
  const audit = useMemo(() => (method === 'laser' ? basswoodAudit(spec) : []), [spec, method])
  const guide = useMemo(() => buildGuide(spec, method), [spec, method])
  const conflicts = propConflicts(spec)
  const segments = spec.characters.filter((c) => c.kind === 'silhouette' && FIGURE_SHAPES[c.shape ?? '']?.partOf)
  const slug = spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'automaton'
  const reset = () => {
    const original = Object.values(templates).find((t) => t.name === spec.name)
    s.loadTemplate(original ?? templates.flyingbird)
  }

  return (
    <aside className="gen-rail gen-rail-params" aria-label="Parameters">
      <div className="gen-params-header">
        <Segmented label="Units" value={units} options={[{ value: 'mm', label: 'mm' }, { value: 'in', label: 'inch' }]} onChange={setUnits} />
        <button type="button" className="btn btn-secondary" onClick={reset}>
          <IconReset />
          Reset
        </button>
      </div>

      <div className="gen-rail-scroll">
        <div className="gen-params-content">
          <CrankCard />
          {segments.length > 0 && <SegmentsCard parts={segments} spec={spec} units={units} />}
          {spec.characters
            .filter((c) => !segments.includes(c))
            .map((c) =>
              c.kind === 'flyer' && c.flyer ? (
                <FlyerCard key={c.id} ch={c} spec={spec} units={units} />
              ) : (
                <FigureCard key={c.id} ch={c} spec={spec} units={units} />
              ),
            )}

          {(spec.props ?? []).length > 0 && (
            <PropCard title="Scenery">
              {(spec.props ?? []).map((p) => (
                <div key={p.id} className="atomm-group">
                  <div className="field-row">
                    <span className="field-label">
                      <b>{PROP_SHAPES[p.shape]?.label ?? p.shape}</b>
                    </span>
                    <button type="button" className="btn-icon btn-icon-sm" aria-label={`Remove ${PROP_SHAPES[p.shape]?.label}`} onClick={() => s.removeProp(p.id)}>
                      <IconTrash />
                    </button>
                  </div>
                  <SelectRow label="Row" value={p.row} options={[{ value: 'front', label: 'In front' }, { value: 'back', label: 'Behind' }]} onChange={(v) => s.updateProp(p.id, { row: v })} />
                  <SliderRow label="Position" value={Math.round(p.position * 100)} min={5} max={95} unit="%" onChange={(v) => s.updateProp(p.id, { position: v / 100 })} />
                  <NumberRow label="Width" value={p.width} min={10} max={spec.frame.width} units={units} onChange={(v) => s.updateProp(p.id, { width: v })} />
                  <SwatchRow label="Colour" value={p.color} onChange={(v) => s.updateProp(p.id, { color: v })} />
                  {conflicts.includes(p.id) && (
                    <div className="alert alert-warning atomm-card-alert" role="alert">
                      <IconWarn />
                      <p>This spot collides with a slot in the stage. Slide it sideways or switch rows.</p>
                    </div>
                  )}
                </div>
              ))}
            </PropCard>
          )}

          <PropCard title="Box" defaultOpen={false}>
            <NumberRow label="Width" value={spec.frame.width} min={100} max={300} step={5} units={units} onChange={(v) => s.updateFrame({ width: v })} />
            <NumberRow label="Depth" value={spec.frame.depth} min={50} max={160} step={5} units={units} onChange={(v) => s.updateFrame({ depth: v })} />
            <NumberRow label="Height" value={spec.frame.height} min={60} max={180} step={5} units={units} onChange={(v) => s.updateFrame({ height: v })} />
          </PropCard>

          <PropCard title="Make">
            <div className="field-row">
              <span className="field-label">Method</span>
              <Segmented label="Method" value={method} options={[{ value: 'laser', label: 'Laser cut' }, { value: 'print', label: '3D print' }]} onChange={setMethod} />
            </div>
            <NumberRow label="Sheet thickness" value={spec.frame.materialThickness} min={2} max={6} step={0.5} units={units} onChange={(v) => s.updateFrame({ materialThickness: v })} />
            {method === 'laser' ? (
              <>
                <NumberRow label="Laser kerf" value={spec.export.kerf} min={0} max={0.5} step={0.05} units={units} onChange={(v) => s.updateExport({ kerf: v })} />
                <p className="field-note">Kerf changes the cut sheets only, not the 3D preview.</p>
              </>
            ) : (
              <>
                <NumberRow label="Fit clearance" value={spec.export.fdmClearance} min={0} max={0.6} step={0.05} units={units} onChange={(v) => s.updateExport({ fdmClearance: v })} />
                <p className="field-note">Clearance changes the print file only, not the 3D preview.</p>
              </>
            )}
            <SelectRow
              label="Preview finish"
              value={finish}
              options={[{ value: 'painted', label: 'Painted' }, { value: 'natural', label: 'Basswood' }, { value: 'walnut', label: 'Walnut' }]}
              onChange={(v) => useUiStore.getState().setFinish(v)}
            />
            {method === 'laser' &&
              (audit.length === 0 ? (
                <div className="alert alert-success atomm-card-alert">
                  <IconCheck />
                  <p>
                    Ready for {BASSWOOD.thickness} mm basswood: {guide.parts.reduce((n, p) => n + p.qty, 0)} parts on {guide.sheets} sheets of{' '}
                    {BASSWOOD.sheetWidth} × {BASSWOOD.sheetHeight} mm.
                  </p>
                </div>
              ) : (
                <div className="alert alert-warning atomm-card-alert" role="alert">
                  <IconWarn />
                  <p>
                    {audit.length} to fix before cutting: <b>{audit[0].part}</b> {audit[0].message}.
                  </p>
                </div>
              ))}
          </PropCard>
        </div>
      </div>

      <div className="gen-rail-footer">
        {inAtomm ? (
          // hosted: the platform renders its Export button into this slot
          <div data-atomm-export-button />
        ) : (
          // opened directly: ordinary downloads
          <div className="atomm-downloads">
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() =>
                method === 'laser'
                  ? downloadFile(`${slug}-flatpack.svg`, flatPackSvg(spec), 'image/svg+xml')
                  : downloadFile(`${slug}-parts.stl`, exportStl(spec), 'model/stl')
              }
            >
              {method === 'laser' ? 'Download cut file' : 'Download print file'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => downloadFile(`${slug}-build-guide.html`, guideHtml(spec, method), 'text/html')}
            >
              Download build guide
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

/* ───────────────────────── canvas ───────────────────────── */

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.5, 2, 4]

function Canvas2D({ zoomApi }: { zoomApi: React.MutableRefObject<ZoomApi | null> }) {
  const spec = useDesignerStore((s) => s.spec)
  const svg = useMemo(() => flatPackSvg(spec), [spec])
  const stage = useRef<HTMLDivElement>(null)
  const board = useRef<HTMLDivElement>(null)
  const view = useRef({ zoom: 1, x: 0, y: 0 })
  const size = /width="([\d.]+)mm" height="([\d.]+)mm"/.exec(svg)
  const docW = Number(size?.[1] ?? 300)
  const docH = Number(size?.[2] ?? 200)
  const [fit, setFit] = useState({ w: 320, h: 200 })
  const [panning, setPanning] = useState(false)

  const apply = (smooth = false) => {
    const b = board.current
    if (!b) return
    if (smooth) b.removeAttribute('data-zooming')
    else b.setAttribute('data-zooming', '')
    b.style.setProperty('--zoom', String(view.current.zoom))
    b.style.setProperty('--pan-x', `${view.current.x}px`)
    b.style.setProperty('--pan-y', `${view.current.y}px`)
    window.dispatchEvent(new CustomEvent('studio-zoom-level', { detail: view.current.zoom }))
  }

  useEffect(() => {
    const el = stage.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return // mounted hidden: keep the current fit
      const k = Math.min((r.width - 96) / docW, (r.height - 140) / docH)
      setFit({ w: docW * k, h: docH * k })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    // wheel zoom anchored on the pointer; native + non-passive so the page never scrolls
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const px = e.clientX - (r.left + r.width / 2)
      const py = e.clientY - (r.top + r.height / 2)
      const v = view.current
      const next = Math.min(8, Math.max(0.25, v.zoom * Math.exp(-e.deltaY * 0.0015)))
      const k = next / v.zoom
      v.x = px - (px - v.x) * k
      v.y = py - (py - v.y) * k
      v.zoom = next
      apply()
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      ro.disconnect()
      el.removeEventListener('wheel', wheel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docW, docH])

  useEffect(() => {
    zoomApi.current = {
      by: (f) => {
        view.current.zoom = Math.min(8, Math.max(0.25, view.current.zoom * f))
        apply(true)
      },
      to: (level) => {
        view.current.zoom = level
        apply(true)
      },
      fit: () => {
        view.current = { zoom: 1, x: 0, y: 0 }
        apply(true)
      },
    }
    apply()
    return () => {
      zoomApi.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const drag = useRef<{ x: number; y: number } | null>(null)
  return (
    <div
      ref={stage}
      className="gen-canvas-stage"
      data-panning={panning ? '' : undefined}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY }
        e.currentTarget.setPointerCapture(e.pointerId)
        setPanning(true)
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        view.current.x += e.clientX - drag.current.x
        view.current.y += e.clientY - drag.current.y
        drag.current = { x: e.clientX, y: e.clientY }
        apply()
      }}
      onPointerUp={() => {
        drag.current = null
        setPanning(false)
      }}
    >
      <div
        ref={board}
        className="gen-artboard atomm-sheet"
        role="img"
        aria-label="Cut sheets"
        dir="ltr"
        style={{ width: fit.w, height: fit.h }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}

function GuideView() {
  const spec = useDesignerStore((s) => s.spec)
  const method = useUiStore((s) => s.method)
  const g = useMemo(() => buildGuide(spec, method), [spec, method])
  return (
    <div className="atomm-doc-wrap">
      <article className="atomm-doc" aria-label="Assembly guide">
        <h2>{spec.name}</h2>
        <h3>What you need</h3>
        <ul>
          {g.hardware.map((h) => (
            <li key={h.item}>
              <b>{h.item}</b> — {h.detail}
            </li>
          ))}
        </ul>
        <h3>Assembly</h3>
        <ol>
          {g.steps.map((step) => (
            <li key={step.title}>
              <b>{step.title}</b>
              <ul>
                {step.body.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </article>
    </div>
  )
}

interface ZoomApi {
  by: (factor: number) => void
  to: (level: number) => void
  fit: () => void
}

const TIPS = [
  {
    title: 'Real sizes, 3 mm basswood',
    body: 'Every dimension is physical and the cut sheets are 1:1 in millimetres. The design is checked for 3 mm basswood: no neck under 2 mm and no hole within 2 mm of an edge.',
  },
  {
    title: 'Cut, score and engrave',
    body: 'Red lines cut through. Blue lines are scored lightly on the surface: eyes, ribs and the outlines that show where to glue detail plates. Blue text is the part labels.',
  },
  {
    title: 'Layers and hinges',
    body: 'Cams and pushrods are cut as two identical layers and glued. Wing plates are hinged 2 mm apart with cloth tape underneath, or with wire loops through the small stitch holes. Wings rest on their rods; do not glue them.',
  },
]

function TipsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [i, setI] = useState(0)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      setI(0)
      d.showModal()
    }
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="dialog" aria-labelledby="tips-title" onClose={onClose}>
      <div className="dialog-header">
        <span id="tips-title">Fabrication Tips</span>
        <IconInfo />
        <span className="spacer" aria-hidden="true" />
        <span className="sr-only" aria-live="polite">
          {i + 1} / {TIPS.length}
        </span>
        <button type="button" className="btn-icon btn-icon-sm" aria-label="Close" onClick={onClose}>
          <IconClose />
        </button>
      </div>
      <div className="dialog-body">
        <div className="tip-slide">
          <h3>{TIPS[i].title}</h3>
          <p>{TIPS[i].body}</p>
        </div>
      </div>
      <div className="dialog-footer">
        <div className="dots" aria-hidden="true">
          {TIPS.map((_, k) => (
            <i key={k} aria-current={k === i ? 'true' : undefined} />
          ))}
        </div>
        <span className="spacer" aria-hidden="true" />
        <button type="button" className="btn btn-secondary" disabled={i === 0} onClick={() => setI(i - 1)}>
          Back
        </button>
        <button type="button" className="btn btn-primary" onClick={() => (i + 1 < TIPS.length ? setI(i + 1) : onClose())}>
          {i + 1 < TIPS.length ? 'Next' : 'Done'}
        </button>
      </div>
    </dialog>
  )
}

function ZoomCluster({ tab, api }: { tab: ViewTab; api: React.MutableRefObject<ZoomApi | null> }) {
  const [level, setLevel] = useState(1)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const on = (e: Event) => setLevel((e as CustomEvent<number>).detail)
    window.addEventListener('studio-zoom-level', on)
    return () => window.removeEventListener('studio-zoom-level', on)
  }, [])
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', key)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', key)
      window.removeEventListener('resize', close)
    }
  }, [menu])
  const send = (detail: { factor?: number; level?: number; fit?: boolean }) => {
    if (tab === '3d') window.dispatchEvent(new CustomEvent('studio-zoom', { detail }))
    else if (detail.fit) api.current?.fit()
    else if (detail.level) api.current?.to(detail.level)
    else if (detail.factor) api.current?.by(detail.factor)
  }
  if (tab === 'guide') return null
  return (
    <div className="zoom-cluster" role="group" aria-label="Zoom">
      <button type="button" aria-label="Zoom out" onClick={() => send({ factor: 1 / 1.25 })}>
        <IconMinus />
      </button>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="true"
        aria-expanded={menu !== null}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => {
          const r = trigger.current!.getBoundingClientRect()
          setMenu(menu ? null : { x: r.left, y: r.top })
        }}
      >
        {Math.round(level * 100)}%
      </button>
      <button type="button" aria-label="Zoom in" onClick={() => send({ factor: 1.25 })}>
        <IconPlus />
      </button>
      <button type="button" aria-label="Fit to canvas" onClick={() => send({ fit: true })}>
        <IconFit />
        <span className="tooltip" aria-hidden="true">
          Fit to canvas
        </span>
      </button>
      {menu &&
        createPortal(
          <div
            className="select-list zoom-menu"
            role="menu"
            aria-label="Zoom level"
            style={{ position: 'fixed', left: menu.x, bottom: window.innerHeight - menu.y + 4 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {ZOOM_LEVELS.map((z) => (
              <button
                key={z}
                type="button"
                className="select-option"
                role="menuitem"
                onClick={() => {
                  send({ level: z })
                  setMenu(null)
                }}
              >
                {z * 100}%
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}

/* ───────────────────────── shell ───────────────────────── */

export default function AtommApp() {
  const [tool, setTool] = useState<Tool | null>('toys')
  const [tab, setTab] = useState<ViewTab>('3d')
  const [units, setUnits] = useState<Units>('mm')
  const [tips, setTips] = useState(false)
  const zoomApi = useRef<ZoomApi | null>(null)
  // the 3D view is keyed by toy so each toy opens on its own framing; a
  // parameter change never remounts it, so the camera stays put
  const name = useDesignerStore((s) => s.spec.name)

  return (
    <div className="gen-app">
      <div className="gen-body">
        <nav className="gen-rail gen-rail-tools" aria-label="Tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="rail-item"
              aria-pressed={tool === t.id}
              onClick={() => setTool(tool === t.id ? null : t.id)}
            >
              <span className="plate">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {tool && (
          <aside className="gen-rail gen-rail-lead" aria-label={TOOLS.find((t) => t.id === tool)?.title}>
            {tool === 'toys' && <ToysPanel onCollapse={() => setTool(null)} />}
            {tool === 'figures' && <FiguresPanel onCollapse={() => setTool(null)} />}
            {tool === 'scenery' && <SceneryPanel onCollapse={() => setTool(null)} />}
            {tool === 'own' && <OwnPanel onCollapse={() => setTool(null)} />}
          </aside>
        )}

        <main className="gen-canvas" aria-label="Canvas">
          {/* the 3D view stays mounted behind the other tabs so it is never rebuilt on return */}
          <div className="gen-canvas-stage atomm-stage-3d" hidden={tab !== '3d'}>
            <AutomatonScene key={name} studio />
          </div>
          {tab === 'sheets' && <Canvas2D zoomApi={zoomApi} />}
          {tab === 'guide' && <GuideView />}

          <div className="gen-canvas-top">
            <Segmented
              tabs
              label="View"
              value={tab}
              options={[
                { value: '3d', label: '3D preview' },
                { value: 'sheets', label: 'Cut sheets' },
                { value: 'guide', label: 'Assembly' },
              ]}
              onChange={setTab}
            />
            <button type="button" className="btn-tips gen-tips" onClick={() => setTips(true)}>
              <IconBulb />
              Tips
            </button>
          </div>
          <div className="gen-canvas-bottom">
            <ZoomCluster tab={tab} api={zoomApi} />
          </div>
        </main>

        <ParamsRail units={units} setUnits={setUnits} />
      </div>
      <TipsDialog open={tips} onClose={() => setTips(false)} />
    </div>
  )
}
