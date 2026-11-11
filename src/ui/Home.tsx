import { useState } from 'react'
import { useDesignerStore } from '../model/store'
import { templates } from '../model/templates'
import { CUSTOM_SHAPE, FIGURE_SHAPES } from '../model/figures'
import {
  composeToy,
  FIGURE_INFO,
  MOTIONS,
  ARTICULATED_TEMPLATES,
  TEMPLATE_INFO,
  type MotionId,
} from '../model/catalog'
import { useUiStore } from './uiStore'
import { CustomThumb, Difficulty, FigureThumb, MotionIcon } from './Thumbs'
import { ShapeStudio, type StudioResult } from './ShapeStudio'

/** Gallery order: sea creatures, land, then the rest. */
const FIGURE_ORDER = [
  'whale',
  'dolphin',
  'fish',
  'ray',
  'sailboat',
  'bird',
  'butterfly',
  'cat',
  'dancer',
  'rocket',
]

/**
 * Step 1 — choose. A first-time visitor picks a figure, then how it
 * should move, and gets a complete working toy to fine-tune; or opens
 * one of the ready-made toys.
 */
export function Home() {
  const loadTemplate = useDesignerStore((s) => s.loadTemplate)
  const currentName = useDesignerStore((s) => s.spec.name)
  const setView = useUiStore((s) => s.setView)
  const [picked, setPicked] = useState<string | null>(null)
  const [studio, setStudio] = useState(false)
  const [own, setOwn] = useState<StudioResult | null>(null)
  const [motion, setMotion] = useState<MotionId | null>(null)

  const open = (spec: Parameters<typeof loadTemplate>[0]) => {
    history.replaceState(null, '', location.pathname)
    loadTemplate(spec)
    setView('design')
  }

  const toyCard = (key: string) => {
    const spec = templates[key]
    const t = TEMPLATE_INFO[key]
    if (!spec) return null
    return (
      <button key={key} className="card toy-card" onClick={() => open(spec)}>
        <span
          className="toy-shot"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}thumbs/${key}.jpg)` }}
        />
        <span className="card-name">{spec.name}</span>
        <span className="card-blurb">{t?.blurb}</span>
        <span className="card-meta">
          {t && <Difficulty level={t.difficulty} />}
          {t?.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </span>
      </button>
    )
  }

  const info = picked ? FIGURE_INFO[picked] : null
  const pickedName =
    picked === CUSTOM_SHAPE
      ? 'your figure'
      : picked
        ? `the ${FIGURE_SHAPES[picked]?.label.toLowerCase()}`
        : ''
  const chosen = motion ?? info?.motions[0] ?? null

  return (
    <div className="home">
      <section className="hero">
        <h2>Design a hand-cranked toy. Then cut it or print it.</h2>
        <p>
          Pick a character, choose how it moves, and watch the mechanism build itself. When
          you are happy, download ready-to-make files for a laser cutter or a 3D printer,
          with a parts list and step-by-step assembly guide.
        </p>
        <ol className="hero-steps">
          <li>
            <b>1</b> Choose a creature
          </li>
          <li>
            <b>2</b> Tune the motion
          </li>
          <li>
            <b>3</b> Make it
          </li>
        </ol>
        <button className="ghost" onClick={() => setView('design')}>
          Continue with “{currentName}” →
        </button>
      </section>

      <section>
        <h3 className="home-title">Articulated creatures — wings and bodies that really move</h3>
        <div className="card-grid toys">{ARTICULATED_TEMPLATES.map((key) => toyCard(key))}</div>
      </section>

      <section>
        <h3 className="home-title">Start with a figure</h3>
        <div className="card-grid figures">
          {FIGURE_ORDER.filter((id) => FIGURE_SHAPES[id]).map((id) => (
            <button
              key={id}
              className={`card figure-card${picked === id ? ' selected' : ''}`}
              onClick={() => {
                setPicked(id)
                setMotion(null)
              }}
            >
              <FigureThumb shape={id} color={FIGURE_INFO[id]?.color ?? '#e0a54f'} size={96} />
              <span className="card-name">{FIGURE_SHAPES[id].label}</span>
              <span className="card-blurb">{FIGURE_INFO[id]?.blurb}</span>
            </button>
          ))}
          <button className="card figure-card own-card" onClick={() => setStudio(true)}>
            <span className="own-mark" aria-hidden="true">
              ✎
            </span>
            <span className="card-name">Draw your own</span>
            <span className="card-blurb">Sketch it or upload a picture — we trace it and check it will cut.</span>
          </button>
        </div>
      </section>

      <section>
        <h3 className="home-title">More ready-made toys</h3>
        <div className="card-grid toys">
          {Object.keys(templates)
            .filter((key) => !ARTICULATED_TEMPLATES.includes(key))
            .map((key) => toyCard(key))}
        </div>
      </section>

      {studio && (
        <ShapeStudio
          onClose={() => setStudio(false)}
          onUse={(r) => {
            setOwn(r)
            setStudio(false)
            setPicked(CUSTOM_SHAPE)
            setMotion(null)
          }}
        />
      )}

      {picked && info && chosen && (
        <div className="modal-backdrop" onClick={() => setPicked(null)}>
          <div
            className="modal"
            role="dialog"
            aria-label="Choose a motion"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              {picked === CUSTOM_SHAPE && own ? (
                <CustomThumb outline={own.outline} aspect={own.aspect} color={info.color} size={84} />
              ) : (
                <FigureThumb shape={picked} color={info.color} size={84} />
              )}
              <div>
                <h3>How should {pickedName} move?</h3>
                <p>
                  Each motion comes from a different mechanism under the stage. You can
                  change everything afterwards.
                </p>
              </div>
              <button className="icon-btn close" onClick={() => setPicked(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="motion-grid">
              {(Object.keys(MOTIONS) as MotionId[])
                .sort((a, b) => {
                  const ia = info.motions.indexOf(a)
                  const ib = info.motions.indexOf(b)
                  return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib)
                })
                .map((id) => {
                  const m = MOTIONS[id]
                  const rank = info.motions.indexOf(id)
                  return (
                    <button
                      key={id}
                      className={`card motion-card${chosen === id ? ' selected' : ''}`}
                      onClick={() => setMotion(id)}
                    >
                      <MotionIcon motion={id} />
                      <span className="card-name">
                        {m.label}
                        {rank === 0 && <span className="badge">Best match</span>}
                        {rank > 0 && <span className="badge soft">Good match</span>}
                      </span>
                      <span className="card-blurb">{m.blurb}</span>
                      <span className="card-meta">
                        <Difficulty level={m.difficulty} />
                        <span className="tag">{m.mechanism}</span>
                      </span>
                    </button>
                  )
                })}
            </div>
            <div className="modal-foot">
              <button onClick={() => setPicked(null)}>Back</button>
              <button
                className="primary big"
                onClick={() =>
                  open(
                    composeToy(
                      picked,
                      chosen,
                      picked === CUSTOM_SHAPE && own
                        ? { outline: own.outline, width: own.width, height: own.height }
                        : undefined,
                    ),
                  )
                }
              >
                Build {pickedName} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
