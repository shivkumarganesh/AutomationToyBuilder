import { useState } from 'react'
import type { AutomatonSpec, CamSpec, CharacterSpec, OutputChannel } from '../model/types'
import { camAngularRate, outputChannels } from '../model/types'
import { channelCount, MAX_CHANNELS, useDesignerStore } from '../model/store'
import { CUSTOM_SHAPE, FIGURE_SHAPES, PICKABLE_FIGURES } from '../model/figures'
import { FIGURE_INFO, MOTIONS, type MotionId } from '../model/catalog'
import { grashofOk } from '../kinematics/linkage'
import { channelSignals } from '../kinematics/channels'
import { flyerIssues } from '../scene/flyerLayout'
import { NumberField } from './NumberField'
import { MotionEditor } from './MotionEditor'
import { drawnFrom } from '../kinematics/drawnMotion'
import { SceneryControls } from './SceneryControls'
import { StageMap } from './StageMap'
import { CustomThumb, FigureThumb, MotionIcon } from './Thumbs'
import { ShapeStudio } from './ShapeStudio'
import { MAX_RELIEF } from '../model/relief'
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
  const [studio, setStudio] = useState(false)
  if (!channel) return null
  const motion = motionOf(channel)
  const drawn = (channel.kind === 'lift' || channel.kind === 'tilt') && channel.cam.kind === 'custom'
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
            {ch.shape === CUSTOM_SHAPE && ch.outline ? (
              <CustomThumb outline={ch.outline} aspect={ch.width / ch.height} color={ch.color} size={44} />
            ) : (
              <FigureThumb shape={ch.shape} color={ch.color} size={44} />
            )}
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
          {PICKABLE_FIGURES.map((shape) => (
            <button
              key={shape.id}
              className={`thumb-btn${ch.shape === shape.id ? ' selected' : ''}`}
              title={shape.label}
              onClick={() => {
                s.updateCharacter(ch.id, {
                  shape: shape.id,
                  outline: undefined,
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
          <button
            className={`thumb-btn own${ch.shape === CUSTOM_SHAPE ? ' selected' : ''}`}
            title="Draw or upload your own figure"
            onClick={() => setStudio(true)}
          >
            ✎
          </button>
        </div>
      )}
      {studio && (
        <ShapeStudio
          onClose={() => setStudio(false)}
          onUse={(r) => {
            s.updateCharacter(ch.id, {
              shape: CUSTOM_SHAPE,
              outline: r.outline,
              width: r.width,
              height: r.height,
              label: ch.shape === CUSTOM_SHAPE ? ch.label : 'My figure',
            })
            setStudio(false)
            setPickShape(false)
          }}
        />
      )}
      {ch.kind === 'block' && (
        <button className="link-btn" onClick={() => s.setCharacterKind(ch.id, 'silhouette')}>
          Swap this block for a figure from the library
        </button>
      )}

      <div className="motion-line">
        <MotionIcon motion={motion} size={38} />
        <div>
          <b>{drawn ? 'Your own motion' : MOTIONS[motion].label}</b>
          <span>{drawn ? 'A cam shaped from the curve you draw' : MOTIONS[motion].mechanism}</span>
        </div>
      </div>

      {channel.kind === 'lift' && (
        <div className="seg wrap" role="group" aria-label="Motion feel">
          {(['bob', 'bounce', 'drop'] as MotionId[]).map((m) => (
            <button
              key={m}
              className={!drawn && motion === m ? 'on' : ''}
              onClick={() => s.updateCam(channel.cam.id, camFor(channel.cam, m))}
            >
              {MOTIONS[m].label}
            </button>
          ))}
          <button
            className={drawn ? 'on' : ''}
            title="Draw exactly how the figure should move"
            onClick={() =>
              s.updateCam(
                channel.cam.id,
                drawnFrom(channel.cam, channel.pushrod.padWidth, camAngularRate(spec.mechanism, channel.cam)),
              )
            }
          >
            ✎ Draw it
          </button>
        </div>
      )}
      {channel.kind === 'lift' && channel.cam.kind === 'custom' && (
        <MotionEditor
          cam={channel.cam}
          padWidth={channel.pushrod.padWidth}
          rate={camAngularRate(spec.mechanism, channel.cam)}
          onChange={(patch) => s.updateCam(channel.cam.id, patch)}
        />
      )}

      {(channel.kind === 'lift' || channel.kind === 'tilt') &&
        channel.cam.kind !== 'custom' &&
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
      {ch.kind === 'silhouette' && (
        <NumberField
          label="Depth layers (rounded body)"
          value={ch.relief ?? 0}
          min={0}
          max={MAX_RELIEF}
          unit=""
          onChange={(v) => s.updateCharacter(ch.id, { relief: Math.round(v) })}
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

/** Set the eccentricity of the cams under a list of pushrods (eccentric cams only). */
function setTravel(spec: AutomatonSpec, rodIds: string[], travel: number) {
  const s = useDesignerStore.getState()
  for (const id of rodIds) {
    const rod = spec.mechanism.pushrods.find((r) => r.id === id)
    const cam = spec.mechanism.cams.find((c) => c.id === rod?.camId)
    if (cam?.kind === 'eccentric') s.updateCam(cam.id, { eccentricity: travel / 2 })
  }
}

function camOf(spec: AutomatonSpec, rodId: string): CamSpec | undefined {
  const rod = spec.mechanism.pushrods.find((r) => r.id === rodId)
  return spec.mechanism.cams.find((c) => c.id === rod?.camId)
}

function travelOf(spec: AutomatonSpec, rodId: string): number {
  const cam = camOf(spec, rodId)
  return cam?.kind === 'eccentric' ? cam.eccentricity * 2 : 0
}

/** A hinged-wing creature: flap size, wing-tip whip and ripple, in plain words. */
function FlyerCard({ ch, spec }: { ch: CharacterSpec; spec: AutomatonSpec }) {
  const s = useDesignerStore.getState()
  const f = ch.flyer!
  const inner = [f.left[0], f.right[0]]
  const outer = f.left.length > 1 ? [f.left[1], f.right[1]] : []
  const issues = flyerIssues(spec, ch, channelSignals(spec))
  const innerPhase = camOf(spec, inner[0])?.phaseDeg ?? 0
  const outerPhase = outer.length ? (camOf(spec, outer[0])?.phaseDeg ?? 0) : 0
  const lag = (((outerPhase - innerPhase) % 360) + 360) % 360
  return (
    <div className="unit">
      <div className="unit-head">
        <span className="swatch" style={{ background: ch.color }} />
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
      </div>
      <div className="motion-line">
        <MotionIcon motion="nod" size={38} />
        <div>
          <b>{outer.length ? 'Rippling wings' : 'Flapping wings'}</b>
          <span>
            Hinged wing plates resting on {inner.length + outer.length} pushrods; the body
            stays still on its post
          </span>
        </div>
      </div>
      {issues.map((msg) => (
        <p key={msg} className="hint warn">
          {msg}
        </p>
      ))}
      <NumberField
        label={outer.length ? 'Flap at the shoulder' : 'How far the wings flap'}
        value={travelOf(spec, inner[0])}
        min={2}
        max={24}
        step={1}
        onChange={(v) => setTravel(spec, inner, v)}
      />
      {outer.length > 0 && (
        <>
          <NumberField
            label="Whip at the wing tips"
            value={travelOf(spec, outer[0])}
            min={2}
            max={28}
            step={1}
            onChange={(v) => setTravel(spec, outer, v)}
          />
          <NumberField
            label="Ripple (how far the tips trail)"
            value={lag}
            min={0}
            max={120}
            step={5}
            unit="°"
            onChange={(v) => {
              for (const id of outer) {
                const cam = camOf(spec, id)
                if (cam) s.updateCam(cam.id, { phaseDeg: (innerPhase + v) % 360 })
              }
            }}
          />
        </>
      )}
      <NumberField
        label="Body ridge layers"
        value={ch.relief ?? 0}
        min={0}
        max={MAX_RELIEF}
        unit=""
        onChange={(v) => s.updateCharacter(ch.id, { relief: Math.round(v) })}
      />
      <NumberField
        label="Wing tip overhang"
        value={ch.height}
        min={6}
        max={40}
        onChange={(v) => s.updateCharacter(ch.id, { height: v })}
      />
    </div>
  )
}

/** A body cut into segments, each on its own cam: one card for the whole creature. */
function SegmentedCard({ parts, spec }: { parts: CharacterSpec[]; spec: AutomatonSpec }) {
  const s = useDesignerStore.getState()
  const channels = outputChannels(spec)
  // head first: furthest along +X leads the wave
  const ordered = [...parts].sort(
    (a, b) =>
      (channels.find((c) => c.id === b.channelId)?.x ?? 0) -
      (channels.find((c) => c.id === a.channelId)?.x ?? 0),
  )
  const rods = ordered.map((p) => p.channelId)
  const phases = rods.map((id) => camOf(spec, id)?.phaseDeg ?? 0)
  const lag = phases.length > 1 ? (((phases[1] - phases[0]) % 360) + 360) % 360 : 0
  return (
    <div className="unit">
      <div className="unit-head">
        <span className="swatch" style={{ background: ordered[0].color }} />
        <b>Swimming fish · {parts.length} segments</b>
        <input
          type="color"
          value={ordered[0].color}
          title="Colour"
          onChange={(e) => parts.forEach((p) => s.updateCharacter(p.id, { color: e.target.value }))}
        />
      </div>
      <div className="motion-line">
        <MotionIcon motion="bob" size={38} />
        <div>
          <b>Travelling wave</b>
          <span>Each segment rides its own cam, every one a little behind the last</span>
        </div>
      </div>
      <NumberField
        label="Wave height"
        value={travelOf(spec, rods[0])}
        min={2}
        max={16}
        step={1}
        onChange={(v) => setTravel(spec, rods, v)}
      />
      <NumberField
        label="Delay between segments"
        value={lag}
        min={0}
        max={120}
        step={5}
        unit="°"
        onChange={(v) =>
          rods.forEach((id, i) => {
            const cam = camOf(spec, id)
            if (cam) s.updateCam(cam.id, { phaseDeg: (i * v) % 360 })
          })
        }
      />
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
        {PICKABLE_FIGURES.map((sh) => (
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
  const segments = spec.characters.filter(
    (ch) => ch.kind === 'silhouette' && FIGURE_SHAPES[ch.shape ?? '']?.partOf,
  )

  return (
    <>
      <details className="section" open>
        <summary>Stage layout</summary>
        <div className="section-body">
          <StageMap />
        </div>
      </details>

      <details className="section" open>
        <summary>Figures</summary>
        <div className="section-body">
          {segments.length > 0 && <SegmentedCard parts={segments} spec={spec} />}
          {spec.characters
            .filter((ch) => !segments.includes(ch))
            .map((ch) =>
              ch.kind === 'flyer' && ch.flyer ? (
                <FlyerCard key={ch.id} ch={ch} spec={spec} />
              ) : (
                <FigureCard key={ch.id} ch={ch} spec={spec} />
              ),
            )}
          <AddFigure />
          <p className="hint">
            Grab the red handle and turn it yourself, or drag anywhere else to look around.
            Tick “See through” to watch the mechanism inside the box.
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
