import { useState } from 'react'
import { composeScene, FIGURE_INFO, MAX_CAST, MOTIONS, SCENES, type CastMember, type SceneId } from '../model/catalog'
import { FIGURE_SHAPES, PICKABLE_FIGURES } from '../model/figures'
import type { AutomatonSpec } from '../model/types'
import { FigureThumb } from './Thumbs'

const SIMPLE_MOTIONS: CastMember['motion'][] = ['bob', 'bounce', 'drop']

/** The first of a figure's suggested motions that needs only a cam and a rod. */
function simpleMotion(shape: string): CastMember['motion'] {
  const pick = FIGURE_INFO[shape]?.motions.find((m) => (SIMPLE_MOTIONS as string[]).includes(m))
  return (pick as CastMember['motion']) ?? 'bob'
}

function tryCompose(cast: CastMember[], scene: SceneId): AutomatonSpec | null {
  try {
    return composeScene(cast.length === 1 ? `${FIGURE_SHAPES[cast[0].shape].label} scene` : 'My scene', cast, scene)
  } catch {
    return null
  }
}

/**
 * Build a whole scene in one go: line up a cast, give each a motion,
 * choose the scenery. Everything runs off one straight shaft with a cam
 * and a pushrod per figure — the simplest toy to cut and assemble.
 */
export function SceneBuilder({ onBuild }: { onBuild: (spec: AutomatonSpec) => void }) {
  const [cast, setCast] = useState<CastMember[]>([])
  const [scene, setScene] = useState<SceneId | 'auto'>('auto')
  const sceneId: SceneId = scene === 'auto' ? (FIGURE_INFO[cast[0]?.shape]?.scene ?? 'none') : scene
  const spec = cast.length > 0 ? tryCompose(cast, sceneId) : null
  const fits = (shape: string) => cast.length < MAX_CAST && tryCompose([...cast, { shape, motion: 'bob' }], 'none') !== null

  return (
    <div className="scene-builder">
      <p className="card-blurb">
        Click figures to line them up on the stage, left to right. Each one gets its own cam on a
        single shaft and they move one after another, like a wave. Nothing special to build.
      </p>
      <div className="cast-row" aria-label="Your cast">
        {cast.map((m, i) => (
          <div key={i} className="cast-slot">
            <FigureThumb shape={m.shape} color={FIGURE_INFO[m.shape]?.color ?? '#e0a54f'} size={64} />
            <select
              value={m.motion}
              aria-label={`How the ${FIGURE_SHAPES[m.shape].label.toLowerCase()} moves`}
              onChange={(e) =>
                setCast(cast.map((c, k) => (k === i ? { ...c, motion: e.target.value as CastMember['motion'] } : c)))
              }
            >
              {SIMPLE_MOTIONS.map((id) => (
                <option key={id} value={id}>
                  {MOTIONS[id].label}
                </option>
              ))}
            </select>
            <button
              className="icon-btn"
              aria-label={`Remove ${FIGURE_SHAPES[m.shape].label}`}
              onClick={() => setCast(cast.filter((_, k) => k !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        {cast.length === 0 && <div className="cast-empty">Your stage is empty — add a figure below</div>}
      </div>
      <div className="chip-row">
        {PICKABLE_FIGURES.map((shape) => (
          <button
            key={shape.id}
            className="chip"
            disabled={!fits(shape.id)}
            title={fits(shape.id) ? `Add a ${shape.label.toLowerCase()}` : 'No more room on one sheet'}
            onClick={() => setCast([...cast, { shape: shape.id, motion: simpleMotion(shape.id) }])}
          >
            <FigureThumb shape={shape.id} color={FIGURE_INFO[shape.id]?.color ?? '#e0a54f'} size={30} />+{' '}
            {shape.label}
          </button>
        ))}
      </div>
      <div className="builder-foot">
        <label>
          Scenery{' '}
          <select value={scene} onChange={(e) => setScene(e.target.value as SceneId | 'auto')}>
            <option value="auto">Match the first figure</option>
            {(Object.keys(SCENES) as SceneId[]).map((id) => (
              <option key={id} value={id}>
                {SCENES[id].label}
              </option>
            ))}
          </select>
        </label>
        {spec && (
          <span className="tag">
            {cast.length} cam{cast.length > 1 ? 's' : ''} · box {spec.frame.width} mm wide
          </span>
        )}
        <button className="primary big" disabled={!spec} onClick={() => spec && onBuild(spec)}>
          Build this scene →
        </button>
      </div>
    </div>
  )
}
