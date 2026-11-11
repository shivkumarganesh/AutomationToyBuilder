import { useState } from 'react'
import type { AutomatonSpec, CamSpec, CharacterSpec, OutputChannel } from '../model/types'
import { outputChannels } from '../model/types'
import { channelCount, MAX_CHANNELS, useDesignerStore } from '../model/store'
import { FIGURE_SHAPES } from '../model/figures'
import { FIGURE_INFO, MOTIONS, type MotionId } from '../model/catalog'
import { grashofOk } from '../kinematics/linkage'
import { NumberField } from './NumberField'
import { SceneryControls } from './SceneryControls'
import { FigureThumb, MotionIcon } from './Thumbs'
import { useUiStore } from './uiStore'

/** The plain-language motion a channel currently produces. */
function motionOf(ch: OutputChannel): MotionId {
  if (ch.kind === 'tilt') return 'nod'
  if (ch.kind === 'spin') return 'spin'
  if (ch.kind === 'path') return 'swoop'
  return ch.cam.kind === 'petal' ? 'bounce' : ch.cam.kind === 'snail' ? 'drop' : 'bob'
}

/** Rebuild a lift cam for a different feel, keeping its place on the shaft. */
function camFor(cam: CamSpec, motion: MotionId): CamSpec {
  const base = {
    id: cam.id,
    position: cam.position,
    phaseDeg: cam.phaseDeg,
    thickness: cam.thickness,
    ...(cam.shaft ? { shaft: cam.shaft } : {}),
  }
  if (motion === 'bounce') return { ...base, kind: 'petal', baseRadius: 16, lift: 8, lobes: 3 }
  if (motion === 'drop') return { ...base, kind: 'snail', baseRadius: 14, lift: 12 }
  return { ...base, kind: 'eccentric', radius: 20, eccentricity: 8 }
}

function FigureCard({ ch, spec }: { ch: CharacterSpec; spec: AutomatonSpec }) {
  // actions are stable — read them without subscribing to every frame
  const s = useDesignerStore.getState()
  const channel = outputChannels(spec).find((c) => c.id === ch.channelId)
  const [pickShape, setPickShape] = useState(false)
  if (!channel) return null
  const motion = motionOf(channel)
  const shared =
    spec.characters.some((c) => c.id !== ch.id && c.channelId === ch.channelId) ||
    spec.characters.some((c) => c.id !== ch.id && (c.limbs ?? []).some((l) => l.channelId === ch.channelId))
  const lastChannel = channelCount(spec) <= 1

  const remove = () => {
    if (shared || lastChannel) return s.removeCharacter(ch.id)
    if (channel.kind === 'spin') s.removeSpinner(channel.id)
    else if (channel.kind === 'path') s.removeLinkage(channel.id)
    else s.removeCam(channel.cam.id)
  }

  const scale = (factor: number) =>
    s.updateCharacter(ch.id, {
      width: Math.round(ch.width * factor),
      height: Math.round(ch.height * factor),
    })
  const sizePct = ch.kind === 'silhouette' && ch.shape && FIGURE_SHAPES[ch.shape]
    ? Math.round((ch.height / FIGURE_SHAPES[ch.shape].defaultHeight) * 100)
    : null

  return (
    <div className="unit">
      <div className="unit-head">
        {ch.kind === 'silhouette' && ch.shape ? (
          <button
            className="thumb-btn"
            title="Change the figure"
            onClick={() => setPickShape(!pickShape)}
          >
            <FigureThumb shape={ch.shape} color={ch.color} size={44} />
          </button>
        ) : (
          <span className="swatch" style={{ background: ch.color }} />
        )}
        <input
          className="name-input"
          value={ch.label}
          aria-label="Figure name"
          onChange={(e) => s.updateCharacter(ch.id, { label: e.target.value.slice(0, 40) || ch.label })}
        />
        <input
          type="color"
          value={ch.color}
          title="Colour"
          onChange={(e) => s.updateCharacter(ch.id, { color: e.target.value })}
        />
        <button
          className="icon-btn"
          title={
            spec.characters.length <= 1
              ? 'A toy needs at least one figure'
              : 'Remove this figure and its mechanism'
          }
          disabled={spec.characters.length <= 1}
          onClick={remove}
        >
          ✕
        </button>
      </div>

      {pickShape && (
        <div className="shape-grid">
          {Object.values(FIGURE_SHAPES).map((shape) => (
            <button
              key={shape.id}
              className={`thumb-btn${ch.shape === shape.id ? ' selected' : ''}`}
              title={shape.label}
              onClick={() => {
                s.updateCharacter(ch.id, {
                  shape: shape.id,
                  width: shape.defaultWidth,
                  height: shape.defaultHeight,
                  label: shape.label,
                  color: FIGURE_INFO[shape.id]?.color ?? ch.color,
                })
                setPickShape(false)
              }}
            >
              <FigureThumb shape={shape.id} color={FIGURE_INFO[shape.id]?.color ?? ch.color} size={40} />
            </button>
          ))}
        </div>
      )}
      {ch.kind === 'block' && (
        <button className="link-btn" onClick={() => s.setCharacterKind(ch.id, 'silhouette')}>
          Swap this block for a figure from the library
        </button>
      )}

      <div className="motion-line">
        <MotionIcon motion={motion} size={38} />
        <div>
          <b>{MOTIONS[motion].label}</b>
          <span>{MOTIONS[motion].mechanism}</span>
        </div>
      </div>

      {channel.kind === 'lift' && (
        <div className="seg" role="group" aria-label="Motion feel">
          {(['bob', 'bounce', 'drop'] as MotionId[]).map((m) => (
            <button
              key={m}
              className={motion === m ? 'on' : ''}
              onClick={() => s.updateCam(channel.cam.id, camFor(channel.cam, m))}
            >
              {MOTIONS[m].label}
            </button>
          ))}
        </div>
      )}

      {(channel.kind === 'lift' || channel.kind === 'tilt') &&
        (channel.cam.kind === 'eccentric' ? (
          <NumberField
            label={channel.kind === 'lift' ? 'How far it travels' : 'How far it rocks'}
            value={channel.cam.eccentricity * 2}
            min={2}
            max={Math.max(2, (channel.cam.radius - 4) * 2)}
            step={2}
            onChange={(v) => s.updateCam(channel.cam.id, { eccentricity: v / 2 })}
          />
        ) : (
          <NumberField
            label="How far it travels"
            value={channel.cam.lift}
            min={2}
            max={channel.cam.kind === 'snail' ? 18 : 15}
            onChange={(v) => s.updateCam(channel.cam.id, { lift: v })}
          />
        ))}
      {channel.kind === 'lift' && channel.cam.kind === 'petal' && (
        <NumberField
          label="Hops per turn"
          value={channel.cam.lobes}
          min={2}
          max={8}
          unit=""
          onChange={(v) => s.updateCam(channel.cam.id, { lobes: Math.round(v) })}
        />
      )}
      {channel.kind === 'spin' && (channel.spinner.drive ?? 'friction') === 'friction' && (
        <NumberField
          label="Spins per turn of the crank"
          value={channel.spinner.ratio}
          min={0.25}
          max={2}
          step={0.25}
          unit="×"
          onChange={(v) => s.updateSpinner(channel.id, { ratio: v })}
        />
      )}
      {channel.kind === 'path' && (
        <>
          <NumberField
            label="Size of the swoop"
            value={channel.linkage.crankRadius}
            min={5}
            max={14}
            onChange={(v) => s.updateLinkage(channel.id, { crankRadius: v })}
          />
          {!grashofOk(channel.linkage) && (
            <p className="hint warn">That swoop is too big for this linkage — make it smaller.</p>
          )}
        </>
      )}
      {(channel.kind === 'lift' || channel.kind === 'tilt') && spec.characters.length > 1 && (
        <NumberField
          label="Timing (when in the turn)"
          value={channel.cam.phaseDeg}
          min={0}
          max={360}
          step={15}
          unit="°"
          onChange={(v) => s.updateCam(channel.cam.id, { phaseDeg: v })}
        />
      )}
      {!shared && (
        <NumberField
          label="Position along the box"
          value={Math.round(
            (channel.kind === 'spin'
              ? channel.spinner.position
              : channel.kind === 'path'
                ? channel.linkage.position
                : channel.cam.position) * 100,
          )}
          min={10}
          max={90}
          unit="%"
          onChange={(v) =>
            channel.kind === 'spin'
              ? s.updateSpinner(channel.id, { position: v / 100 })
              : channel.kind === 'path'
                ? s.updateLinkage(channel.id, { position: v / 100 })
                : s.updateCam(channel.cam.id, { position: v / 100 })
          }
        />
      )}
      {sizePct !== null && (
        <NumberField
          label="Figure size"
          value={sizePct}
          min={60}
          max={160}
          step={5}
          unit="%"
          onChange={(v) => scale(v / sizePct)}
        />
      )}
    </div>
  )
}

function AddFigure() {
  const spec = useDesignerStore((s) => s.spec)
  const addFigureWithMotion = useDesignerStore((s) => s.addFigureWithMotion)
  const [open, setOpen] = useState(false)
  const [shape, setShape] = useState('fish')
  const full = channelCount(spec) >= MAX_CHANNELS
  const info = FIGURE_INFO[shape]
  const [motion, setMotion] = useState<MotionId>('bob')

  if (full) return <p className="hint">This box is full — four moving figures is the limit.</p>
  if (!open)
    return (
      <button className="wide" onClick={() => setOpen(true)}>
        + Add another figure
      </button>
    )
  return (
    <div className="unit adding">
      <b>Pick a figure</b>
      <div className="shape-grid">
        {Object.values(FIGURE_SHAPES).map((sh) => (
          <button
            key={sh.id}
            className={`thumb-btn${shape === sh.id ? ' selected' : ''}`}
            title={sh.label}
            onClick={() => {
              setShape(sh.id)
              setMotion(FIGURE_INFO[sh.id]?.motions[0] ?? 'bob')
            }}
          >
            <FigureThumb shape={sh.id} color={FIGURE_INFO[sh.id]?.color ?? '#e0a54f'} size={40} />
          </button>
        ))}
      </div>
      <b>How it moves</b>
      <div className="seg wrap" role="group" aria-label="Motion">
        {(Object.keys(MOTIONS) as MotionId[]).map((m) => (
          <button key={m} className={motion === m ? 'on' : ''} onClick={() => setMotion(m)}>
            {MOTIONS[m].label}
            {info?.motions[0] === m ? ' ★' : ''}
          </button>
        ))}
      </div>
      <p className="hint">{MOTIONS[motion].blurb}</p>
      <div className="row">
        <button onClick={() => setOpen(false)}>Cancel</button>
        <button
          className="primary"
          style={{ flex: 1 }}
          onClick={() => {
            addFigureWithMotion(shape, motion)
            setOpen(false)
          }}
        >
          Add {FIGURE_SHAPES[shape].label.toLowerCase()}
        </button>
      </div>
    </div>
  )
}

/**
 * Step 2 for everyone: the design described as figures, motions and
 * scenery — no cam radii or lever lengths. Every control here edits the
 * same spec the Advanced panel exposes in full.
 */
export function SimplePanel() {
  const spec = useDesignerStore((s) => s.spec)
  const updateFrame = useDesignerStore((s) => s.updateFrame)
  const setView = useUiStore((s) => s.setView)

  return (
    <>
      <details className="section" open>
        <summary>Figures</summary>
        <div className="section-body">
          {spec.characters.map((ch) => (
            <FigureCard key={ch.id} ch={ch} spec={spec} />
          ))}
          <AddFigure />
          <p className="hint">
            Drag the 3D view to look around. Tick “See through” to watch the mechanism
            inside the box.
          </p>
        </div>
      </details>

      <details className="section" open>
        <summary>Scenery</summary>
        <div className="section-body">
          <SceneryControls />
        </div>
      </details>

      <details className="section">
        <summary>Box size</summary>
        <div className="section-body">
          <NumberField
            label="Width"
            value={spec.frame.width}
            min={100}
            max={300}
            step={5}
            onChange={(v) => updateFrame({ width: v })}
          />
          <NumberField
            label="Depth"
            value={spec.frame.depth}
            min={50}
            max={160}
            step={5}
            onChange={(v) => updateFrame({ depth: v })}
          />
          <p className="hint">
            Need exact control over cams, levers and gears? Switch to <b>Advanced</b> at the
            top of this panel.
          </p>
        </div>
      </details>

      <button className="primary big wide" onClick={() => setView('make')}>
        Next: make it →
      </button>
    </>
  )
}
