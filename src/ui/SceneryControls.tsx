import { useDesignerStore } from '../model/store'
import { MAX_PROPS, PROP_SHAPES } from '../model/props'
import { propConflicts } from '../export/svgFlatPack'
import { NumberField } from './NumberField'
import { PropThumb } from './Thumbs'

/** Add, place and size the static scenery plates on the stage. */
export function SceneryControls() {
  const spec = useDesignerStore((s) => s.spec)
  const addProp = useDesignerStore((s) => s.addProp)
  const updateProp = useDesignerStore((s) => s.updateProp)
  const removeProp = useDesignerStore((s) => s.removeProp)
  const props = spec.props ?? []
  const conflicts = propConflicts(spec)

  return (
    <>
      {props.map((p) => (
        <div key={p.id} className="unit">
          <div className="unit-head">
            <PropThumb shape={p.shape} color={p.color} size={34} />
            <b>{PROP_SHAPES[p.shape]?.label ?? p.shape}</b>
            <select
              value={p.row}
              title="Which row of the stage"
              onChange={(e) => updateProp(p.id, { row: e.target.value as 'front' | 'back' })}
            >
              <option value="front">In front</option>
              <option value="back">Behind</option>
            </select>
            <input
              type="color"
              value={p.color}
              title="Colour"
              onChange={(e) => updateProp(p.id, { color: e.target.value })}
            />
            <button className="icon-btn" title="Remove this scenery" onClick={() => removeProp(p.id)}>
              ✕
            </button>
          </div>
          {conflicts.includes(p.id) && (
            <p className="hint warn">
              This spot collides with a slot in the stage (or hangs off the edge). Slide it
              sideways or switch rows.
            </p>
          )}
          <NumberField
            label="Position across the stage"
            value={Math.round(p.position * 100)}
            min={5}
            max={95}
            unit="%"
            onChange={(v) => updateProp(p.id, { position: v / 100 })}
          />
          <NumberField
            label="Width"
            value={p.width}
            min={10}
            max={spec.frame.width}
            onChange={(v) => updateProp(p.id, { width: v })}
          />
          <NumberField
            label="Height"
            value={p.height}
            min={6}
            max={120}
            onChange={(v) => updateProp(p.id, { height: v })}
          />
        </div>
      ))}
      {props.length < MAX_PROPS ? (
        <div className="chip-row">
          {Object.values(PROP_SHAPES).map((s) => (
            <button key={s.id} className="chip" title={`Add ${s.label.toLowerCase()}`} onClick={() => addProp(s.id)}>
              <PropThumb shape={s.id} size={30} />+ {s.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="hint">Scenery limit reached ({MAX_PROPS}).</p>
      )}
    </>
  )
}
