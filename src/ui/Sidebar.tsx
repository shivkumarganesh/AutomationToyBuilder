import type { CamSpec, CharacterSpec, LimbKind } from '../model/types'
import { gearRatio, layshaftY, spinnerRatio } from '../model/types'
import { channelCount, MAX_CHANNELS, MAX_LIMBS, useDesignerStore } from '../model/store'
import { grashofOk } from '../kinematics/linkage'
import { NumberField } from './NumberField'
import { ExportPanel } from './ExportPanel'
import { SavePanel } from './SavePanel'

/** Swap a cam to a different kind, keeping its shaft placement. */
function convertCam(cam: CamSpec, kind: CamSpec['kind']): CamSpec {
  const base = {
    id: cam.id,
    position: cam.position,
    phaseDeg: cam.phaseDeg,
    thickness: cam.thickness,
  }
  switch (kind) {
    case 'eccentric':
      return { ...base, kind, radius: 20, eccentricity: 8 }
    case 'petal':
      return { ...base, kind, baseRadius: 16, lift: 8, lobes: 4 }
    case 'snail':
      return { ...base, kind, baseRadius: 14, lift: 10 }
  }
}

function CamControls({ cam, removable }: { cam: CamSpec; removable: boolean }) {
  const updateCam = useDesignerStore((s) => s.updateCam)
  const removeCam = useDesignerStore((s) => s.removeCam)
  const hasGearTrain = useDesignerStore((s) => s.spec.mechanism.gearTrain !== undefined)
  const replaceCam = (next: CamSpec) => updateCam(cam.id, next)
  return (
    <>
      <div className="subhead">
        {cam.id}
        <select
          style={{ marginLeft: 8 }}
          value={cam.kind}
          onChange={(e) => replaceCam(convertCam(cam, e.target.value as CamSpec['kind']))}
        >
          <option value="eccentric">Eccentric</option>
          <option value="petal">Petal</option>
          <option value="snail">Snail</option>
        </select>
        {hasGearTrain && (
          <select
            style={{ marginLeft: 6 }}
            title="Which shaft carries this cam"
            value={cam.shaft === 'lay' ? 'lay' : 'crank'}
            onChange={(e) => updateCam(cam.id, { shaft: e.target.value as 'crank' | 'lay' })}
          >
            <option value="crank">Crankshaft</option>
            <option value="lay">Layshaft</option>
          </select>
        )}
        {removable && (
          <button
            className="icon-btn"
            title="Remove this cam, its pushrod, and figures riding it"
            onClick={() => removeCam(cam.id)}
          >
            ✕
          </button>
        )}
      </div>
      {cam.kind === 'eccentric' && (
        <>
          <NumberField
            label="Disc radius"
            value={cam.radius}
            min={10}
            max={35}
            onChange={(v) => updateCam(cam.id, { radius: v })}
          />
          <NumberField
            label="Eccentricity (lift = 2×)"
            value={cam.eccentricity}
            min={1}
            max={Math.max(1, cam.radius - 4)}
            onChange={(v) => updateCam(cam.id, { eccentricity: v })}
          />
        </>
      )}
      {cam.kind === 'petal' && (
        <>
          <NumberField
            label="Base radius"
            value={cam.baseRadius}
            min={8}
            max={30}
            onChange={(v) => updateCam(cam.id, { baseRadius: v })}
          />
          <NumberField
            label="Lobe lift"
            value={cam.lift}
            min={2}
            max={15}
            onChange={(v) => updateCam(cam.id, { lift: v })}
          />
          <NumberField
            label="Lobes"
            value={cam.lobes}
            min={2}
            max={8}
            unit=""
            onChange={(v) => updateCam(cam.id, { lobes: v })}
          />
        </>
      )}
      {cam.kind === 'snail' && (
        <>
          <NumberField
            label="Base radius"
            value={cam.baseRadius}
            min={8}
            max={30}
            onChange={(v) => updateCam(cam.id, { baseRadius: v })}
          />
          <NumberField
            label="Drop height"
            value={cam.lift}
            min={2}
            max={18}
            onChange={(v) => updateCam(cam.id, { lift: v })}
          />
        </>
      )}
      <NumberField
        label="Position on shaft"
        value={Math.round(cam.position * 100)}
        min={10}
        max={90}
        unit="%"
        onChange={(v) => updateCam(cam.id, { position: v / 100 })}
      />
      <NumberField
        label="Phase"
        value={cam.phaseDeg}
        min={0}
        max={360}
        step={5}
        unit="°"
        onChange={(v) => updateCam(cam.id, { phaseDeg: v })}
      />
    </>
  )
}

/** Every output channel id a figure or limb can bind to. */
function useChannelIds(): string[] {
  const mech = useDesignerStore((s) => s.spec.mechanism)
  return [
    ...mech.pushrods.map((r) => r.id),
    ...mech.rockers.map((r) => r.id),
    ...mech.spinners.map((sp) => sp.id),
    ...(mech.linkages ?? []).map((l) => l.id),
  ]
}

function CharacterControls({ character: ch }: { character: CharacterSpec }) {
  const updateCharacter = useDesignerStore((s) => s.updateCharacter)
  const removeCharacter = useDesignerStore((s) => s.removeCharacter)
  const setCharacterKind = useDesignerStore((s) => s.setCharacterKind)
  const addLimb = useDesignerStore((s) => s.addLimb)
  const updateLimb = useDesignerStore((s) => s.updateLimb)
  const removeLimb = useDesignerStore((s) => s.removeLimb)
  const channelIds = useChannelIds()
  const limbs = ch.limbs ?? []
  return (
    <div>
      <div className="subhead">
        {ch.label} ·
        <select
          style={{ marginLeft: 6 }}
          title="Rigid block or articulated (jointed limbs)"
          value={ch.kind}
          onChange={(e) => setCharacterKind(ch.id, e.target.value as CharacterSpec['kind'])}
        >
          <option value="block">Block</option>
          <option value="articulated">Articulated</option>
        </select>
        <select
          style={{ marginLeft: 6 }}
          title="Output channel this figure rides"
          value={ch.channelId}
          onChange={(e) => updateCharacter(ch.id, { channelId: e.target.value })}
        >
          {channelIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <input
          type="color"
          value={ch.color}
          style={{ marginLeft: 8, verticalAlign: 'middle' }}
          onChange={(e) => updateCharacter(ch.id, { color: e.target.value })}
        />
        <button
          className="icon-btn"
          title="Remove this figure"
          onClick={() => removeCharacter(ch.id)}
        >
          ✕
        </button>
      </div>
      <NumberField
        label="Height"
        value={ch.height}
        min={10}
        max={60}
        onChange={(v) => updateCharacter(ch.id, { height: v })}
      />
      <NumberField
        label="Width"
        value={ch.width}
        min={8}
        max={50}
        onChange={(v) => updateCharacter(ch.id, { width: v })}
      />
      {ch.kind === 'articulated' && (
        <>
          {limbs.map((limb) => (
            <div key={limb.id} style={{ marginLeft: 8 }}>
              <div className="subhead">
                {limb.id} ·
                <select
                  style={{ marginLeft: 6 }}
                  value={limb.kind}
                  onChange={(e) =>
                    updateLimb(ch.id, limb.id, { kind: e.target.value as LimbKind })
                  }
                >
                  <option value="wings">Wings</option>
                  <option value="head">Head</option>
                  <option value="tail">Tail</option>
                </select>
                <select
                  style={{ marginLeft: 6 }}
                  title="Channel that drives this joint"
                  value={limb.channelId}
                  onChange={(e) => updateLimb(ch.id, limb.id, { channelId: e.target.value })}
                >
                  {channelIds.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
                {limbs.length > 1 && (
                  <button
                    className="icon-btn"
                    title="Remove this limb"
                    onClick={() => removeLimb(ch.id, limb.id)}
                  >
                    ✕
                  </button>
                )}
              </div>
              <NumberField
                label="Limb length"
                value={limb.length}
                min={5}
                max={60}
                onChange={(v) => updateLimb(ch.id, limb.id, { length: v })}
              />
              <NumberField
                label="Crank arm (bigger = smaller swing)"
                value={limb.crankArm}
                min={3}
                max={40}
                onChange={(v) => updateLimb(ch.id, limb.id, { crankArm: v })}
              />
            </div>
          ))}
          {limbs.length < MAX_LIMBS && (
            <button onClick={() => addLimb(ch.id)} style={{ width: '100%', marginTop: 2 }}>
              + Add limb
            </button>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Parameter panel, organised to mirror the architecture: the frame
 * boundary, the mechanism zone inside it, the characters above it, and
 * the manufacturing settings.
 */
export function Sidebar() {
  const spec = useDesignerStore((s) => s.spec)
  const updateFrame = useDesignerStore((s) => s.updateFrame)
  const updateMechanism = useDesignerStore((s) => s.updateMechanism)
  const updatePushrod = useDesignerStore((s) => s.updatePushrod)
  const addCam = useDesignerStore((s) => s.addCam)
  const addRocker = useDesignerStore((s) => s.addRocker)
  const addSpinner = useDesignerStore((s) => s.addSpinner)
  const removeSpinner = useDesignerStore((s) => s.removeSpinner)
  const updateRocker = useDesignerStore((s) => s.updateRocker)
  const updateSpinner = useDesignerStore((s) => s.updateSpinner)
  const addCharacter = useDesignerStore((s) => s.addCharacter)
  const addLinkage = useDesignerStore((s) => s.addLinkage)
  const updateLinkage = useDesignerStore((s) => s.updateLinkage)
  const removeLinkage = useDesignerStore((s) => s.removeLinkage)
  const addGearTrain = useDesignerStore((s) => s.addGearTrain)
  const updateGearTrain = useDesignerStore((s) => s.updateGearTrain)
  const removeGearTrain = useDesignerStore((s) => s.removeGearTrain)
  const full = channelCount(spec) >= MAX_CHANNELS

  return (
    <aside className="sidebar">
      <details className="section" open>
        <summary>Frame &amp; Stage</summary>
        <div className="section-body">
          <NumberField
            label="Box width"
            value={spec.frame.width}
            min={100}
            max={300}
            onChange={(v) => updateFrame({ width: v })}
          />
          <NumberField
            label="Box depth"
            value={spec.frame.depth}
            min={50}
            max={160}
            onChange={(v) => updateFrame({ depth: v })}
          />
          <NumberField
            label="Box height"
            value={spec.frame.height}
            min={60}
            max={180}
            onChange={(v) => updateFrame({ height: v })}
          />
          <NumberField
            label="Material thickness"
            value={spec.frame.materialThickness}
            min={2}
            max={6}
            step={0.5}
            onChange={(v) => updateFrame({ materialThickness: v })}
          />
        </div>
      </details>

      <details className="section" open>
        <summary>Mechanism (inside the box)</summary>
        <div className="section-body">
          <div className="subhead">Drive</div>
          <NumberField
            label="Shaft diameter"
            value={spec.mechanism.shaftDiameter}
            min={3}
            max={12}
            onChange={(v) => updateMechanism({ shaftDiameter: v })}
          />
          <NumberField
            label="Shaft height"
            value={spec.mechanism.shaftHeight}
            min={30}
            max={spec.frame.height - 20}
            onChange={(v) => updateMechanism({ shaftHeight: v })}
          />
          <NumberField
            label="Crank arm length"
            value={spec.mechanism.crank.armLength}
            min={15}
            max={50}
            onChange={(v) =>
              updateMechanism({ crank: { ...spec.mechanism.crank, armLength: v } })
            }
          />
          {spec.mechanism.cams.map((cam) => (
            <CamControls key={cam.id} cam={cam} removable={channelCount(spec) > 1} />
          ))}
          {spec.mechanism.spinners.map((sp) => (
            <div key={sp.id}>
              <div className="subhead">
                {sp.id} · spins ×{spinnerRatio(sp).toFixed(2)}
                <select
                  style={{ marginLeft: 6 }}
                  title="Drive style"
                  value={sp.drive === 'bevel' ? 'bevel' : 'friction'}
                  onChange={(e) =>
                    updateSpinner(
                      sp.id,
                      e.target.value === 'bevel'
                        ? { drive: 'bevel', crownTeeth: 24, pinionTeeth: 8, module: 1.5 }
                        : e.target.value === 'geneva'
                          ? { drive: 'geneva', stations: 6, wheelRadius: 16 }
                          : { drive: 'friction' },
                    )
                  }
                >
                  <option value="friction">Friction</option>
                  <option value="bevel">Bevel gears</option>
                  <option value="geneva">Geneva (steps)</option>
                </select>
                <button
                  className="icon-btn"
                  title="Remove this spinner and figures riding it"
                  onClick={() => removeSpinner(sp.id)}
                >
                  ✕
                </button>
              </div>
              {sp.drive === 'geneva' ? (
                <>
                  <NumberField
                    label="Stations (steps per spindle turn)"
                    value={sp.stations ?? 6}
                    min={3}
                    max={12}
                    unit=""
                    onChange={(v) => updateSpinner(sp.id, { stations: Math.round(v) })}
                  />
                  <NumberField
                    label="Pin circle radius"
                    value={sp.wheelRadius}
                    min={10}
                    max={30}
                    onChange={(v) => updateSpinner(sp.id, { wheelRadius: v })}
                  />
                </>
              ) : sp.drive === 'bevel' ? (
                <>
                  <NumberField
                    label="Crown gear teeth"
                    value={sp.crownTeeth ?? 24}
                    min={12}
                    max={36}
                    unit=""
                    onChange={(v) => updateSpinner(sp.id, { crownTeeth: Math.round(v) })}
                  />
                  <NumberField
                    label="Pinion teeth"
                    value={sp.pinionTeeth ?? 8}
                    min={6}
                    max={16}
                    unit=""
                    onChange={(v) => updateSpinner(sp.id, { pinionTeeth: Math.round(v) })}
                  />
                  <NumberField
                    label="Module (tooth size)"
                    value={sp.module ?? 1.5}
                    min={1}
                    max={2.5}
                    step={0.25}
                    onChange={(v) => updateSpinner(sp.id, { module: v })}
                  />
                </>
              ) : (
                <>
                  <NumberField
                    label="Spin ratio (revs per crank turn)"
                    value={sp.ratio}
                    min={0.25}
                    max={2}
                    step={0.25}
                    unit="×"
                    onChange={(v) => updateSpinner(sp.id, { ratio: v })}
                  />
                  <NumberField
                    label="Drive wheel radius"
                    value={sp.wheelRadius}
                    min={6}
                    max={30}
                    onChange={(v) => updateSpinner(sp.id, { wheelRadius: v })}
                  />
                </>
              )}
              <NumberField
                label="Platform radius"
                value={sp.platformRadius}
                min={10}
                max={60}
                onChange={(v) => updateSpinner(sp.id, { platformRadius: v })}
              />
              <NumberField
                label="Position on shaft"
                value={Math.round(sp.position * 100)}
                min={10}
                max={90}
                unit="%"
                onChange={(v) => updateSpinner(sp.id, { position: v / 100 })}
              />
            </div>
          ))}
          <div className="subhead">Gear train</div>
          {spec.mechanism.gearTrain ? (
            <>
              <div className="subhead">
                layshaft ×{gearRatio(spec.mechanism.gearTrain)} reverse · height{' '}
                {layshaftY(spec.mechanism).toFixed(0)} mm
                <button
                  className="icon-btn"
                  title="Remove the gear train; layshaft cams move to the crankshaft"
                  onClick={removeGearTrain}
                >
                  ✕
                </button>
              </div>
              <NumberField
                label="Speed multiplier (drive teeth = k × driven)"
                value={gearRatio(spec.mechanism.gearTrain)}
                min={1}
                max={3}
                unit="×"
                onChange={(v) =>
                  updateGearTrain({
                    teethDrive: Math.round(v) * spec.mechanism.gearTrain!.teethDriven,
                  })
                }
              />
              <NumberField
                label="Driven gear teeth"
                value={spec.mechanism.gearTrain.teethDriven}
                min={8}
                max={16}
                unit=""
                onChange={(v) =>
                  updateGearTrain({
                    teethDriven: Math.round(v),
                    teethDrive:
                      Math.round(v) * gearRatio(spec.mechanism.gearTrain!),
                  })
                }
              />
              <NumberField
                label="Module (tooth size)"
                value={spec.mechanism.gearTrain.module}
                min={1}
                max={2.5}
                step={0.25}
                onChange={(v) => updateGearTrain({ module: v })}
              />
              <NumberField
                label="Position on shaft"
                value={Math.round(spec.mechanism.gearTrain.position * 100)}
                min={10}
                max={90}
                unit="%"
                onChange={(v) => updateGearTrain({ position: v / 100 })}
              />
            </>
          ) : (
            <button onClick={addGearTrain} style={{ width: '100%', marginBottom: 6 }}>
              + Add gear train (layshaft)
            </button>
          )}
          {(spec.mechanism.linkages ?? []).map((l) => (
            <div key={l.id}>
              <div className="subhead">
                {l.id} · four-bar
                <button
                  className="icon-btn"
                  title="Remove this linkage and figures riding it"
                  onClick={() => removeLinkage(l.id)}
                >
                  ✕
                </button>
              </div>
              {!grashofOk(l) && (
                <p className="hint" style={{ color: '#e0764f' }}>
                  Not a crank-rocker: the crank must stay the shortest link and
                  crank + longest ≤ the other two combined. Adjust the lengths.
                </p>
              )}
              <NumberField
                label="Crank radius"
                value={l.crankRadius}
                min={5}
                max={20}
                onChange={(v) => updateLinkage(l.id, { crankRadius: v })}
              />
              <NumberField
                label="Coupler length"
                value={l.couplerLen}
                min={15}
                max={70}
                onChange={(v) => updateLinkage(l.id, { couplerLen: v })}
              />
              <NumberField
                label="Rocker length"
                value={l.rockerLen}
                min={15}
                max={70}
                onChange={(v) => updateLinkage(l.id, { rockerLen: v })}
              />
              <NumberField
                label="Pivot offset (ground link)"
                value={l.groundLen}
                min={15}
                max={70}
                onChange={(v) => updateLinkage(l.id, { groundLen: v })}
              />
              <NumberField
                label="Coupler point extension"
                value={l.couplerExt}
                min={0}
                max={40}
                onChange={(v) => updateLinkage(l.id, { couplerExt: v })}
              />
              <NumberField
                label="Wand length"
                value={l.wandLen}
                min={30}
                max={120}
                onChange={(v) => updateLinkage(l.id, { wandLen: v })}
              />
              <NumberField
                label="Position on shaft"
                value={Math.round(l.position * 100)}
                min={10}
                max={90}
                unit="%"
                onChange={(v) => updateLinkage(l.id, { position: v / 100 })}
              />
              <NumberField
                label="Phase"
                value={l.phaseDeg}
                min={0}
                max={360}
                step={5}
                unit="°"
                onChange={(v) => updateLinkage(l.id, { phaseDeg: v })}
              />
            </div>
          ))}
          <div className="row" style={{ marginTop: 4 }}>
            <button onClick={addCam} disabled={full} style={{ flex: 1 }}>
              + Cam
            </button>
            <button onClick={addRocker} disabled={full} style={{ flex: 1 }}>
              + Rocker
            </button>
            <button onClick={addSpinner} disabled={full} style={{ flex: 1 }}>
              + Spinner
            </button>
            <button onClick={addLinkage} disabled={full} style={{ flex: 1 }}>
              + Linkage
            </button>
          </div>
          {full && <p className="hint">Channel limit reached (4).</p>}
          <div className="subhead">Stage interface</div>
          {spec.mechanism.rockers.map((rocker) => (
            <div key={rocker.id}>
              <NumberField
                label={`${rocker.id} · lever length`}
                value={rocker.leverLength}
                min={10}
                max={80}
                onChange={(v) => updateRocker(rocker.id, { leverLength: v })}
              />
              <NumberField
                label={`${rocker.id} · follower pad width`}
                value={rocker.padWidth}
                min={4}
                max={40}
                onChange={(v) => updateRocker(rocker.id, { padWidth: v })}
              />
            </div>
          ))}
          {spec.mechanism.pushrods.map((rod) => (
            <div key={rod.id}>
              <NumberField
                label={`${rod.id} · length`}
                value={rod.length}
                min={30}
                max={120}
                onChange={(v) => updatePushrod(rod.id, { length: v })}
              />
              <NumberField
                label={`${rod.id} · follower pad width`}
                value={rod.padWidth}
                min={4}
                max={40}
                onChange={(v) => updatePushrod(rod.id, { padWidth: v })}
              />
            </div>
          ))}
        </div>
      </details>

      <details className="section" open>
        <summary>Characters (above the stage)</summary>
        <div className="section-body">
          {spec.characters.map((ch) => (
            <CharacterControls key={ch.id} character={ch} />
          ))}
          <button onClick={addCharacter} style={{ width: '100%', marginTop: 4 }}>
            + Add figure
          </button>
          <p className="hint">
            Characters bind to output channels, not to cams — swap a cam type in the
            mechanism and the figure above it changes its dance without being touched.
            Click an articulated figure in the 3D view to x-ray its body and inspect
            the wire linkage inside.
          </p>
        </div>
      </details>

      <ExportPanel />
      <SavePanel />
    </aside>
  )
}
