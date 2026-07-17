import type { CamSpec } from '../model/types'
import { MAX_CAMS, MIN_CAMS, useDesignerStore } from '../model/store'
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
  const updateCharacter = useDesignerStore((s) => s.updateCharacter)
  const addCam = useDesignerStore((s) => s.addCam)
  const addCharacter = useDesignerStore((s) => s.addCharacter)
  const removeCharacter = useDesignerStore((s) => s.removeCharacter)

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
            <CamControls
              key={cam.id}
              cam={cam}
              removable={spec.mechanism.cams.length > MIN_CAMS}
            />
          ))}
          <button
            onClick={addCam}
            disabled={spec.mechanism.cams.length >= MAX_CAMS}
            style={{ width: '100%', marginTop: 4 }}
          >
            + Add cam {spec.mechanism.cams.length >= MAX_CAMS ? '(max 4)' : ''}
          </button>
          <div className="subhead">Pushrods (stage interface)</div>
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
            <div key={ch.id}>
              <div className="subhead">
                {ch.label} · rides
                <select
                  style={{ marginLeft: 6 }}
                  value={ch.channelId}
                  onChange={(e) => updateCharacter(ch.id, { channelId: e.target.value })}
                >
                  {spec.mechanism.pushrods.map((rod) => (
                    <option key={rod.id} value={rod.id}>
                      {rod.id}
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
            </div>
          ))}
          <button onClick={addCharacter} style={{ width: '100%', marginTop: 4 }}>
            + Add figure
          </button>
          <p className="hint">
            Characters bind to output channels, not to cams — swap a cam type in the
            mechanism and the figure above it changes its dance without being touched.
          </p>
        </div>
      </details>

      <ExportPanel />
      <SavePanel />
    </aside>
  )
}
