import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useDesignerStore } from '../model/store'
import { flatPackSvg } from '../export/svgFlatPack'
import { exportStl, layoutPrintParts, PRINT_PLATE_WIDTH } from '../export/stlExport'
import { buildGuide, guideHtml, type PartGroup } from '../export/buildGuide'
import { BASSWOOD, basswoodAudit } from '../export/basswood'
import { channelSignals } from '../kinematics/channels'
import { flyerIssues } from '../scene/flyerLayout'
import { drawnCamIssues } from '../kinematics/drawnMotion'
import { serializeSpec, shareUrl } from '../model/persistence'
import { downloadFile } from '../export/download'
import { NumberField } from './NumberField'
import { useUiStore } from './uiStore'

type Tab = 'preview' | 'parts' | 'guide'

const PART_COLORS: Record<PartGroup, string> = {
  Box: '#c9a06a',
  Mechanism: '#8fa3bf',
  Figures: '#e0a54f',
  Scenery: '#6fb58a',
}

function groupColor(name: string): string {
  if (name.startsWith('frame-')) return PART_COLORS.Box
  if (name.startsWith('prop-')) return PART_COLORS.Scenery
  if (/^(figure-|detail-|limb-|axle-|wire-|hinge-stand|body-|post-|wing-)/.test(name)) return PART_COLORS.Figures
  return PART_COLORS.Mechanism
}

/** The build plate exactly as the STL lays it out. */
function PlatePreview() {
  const spec = useDesignerStore((s) => s.spec)
  const parts = useMemo(() => layoutPrintParts(spec), [spec])
  const depth = useMemo(() => {
    let max = 0
    for (const p of parts) {
      const bb = p.geometry.boundingBox!
      max = Math.max(max, p.position[1] + bb.max.y)
    }
    return max
  }, [parts])
  const cx = PRINT_PLATE_WIDTH / 2
  const span = Math.max(PRINT_PLATE_WIDTH, depth)
  return (
    <Canvas
      key={Math.round(span / 40)}
      camera={{ position: [cx, span * 1.15, depth / 2 + span * 0.55], fov: 40, far: 8000 }}
    >
      <color attach="background" args={['#191d24']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[200, 400, 300]} intensity={1.3} />
      {/* STL space is Z-up; turn it so the plate lies on the ground */}
      <group rotation-x={-Math.PI / 2} position={[0, 0, depth]}>
        <mesh position={[cx, depth / 2, -1]}>
          <boxGeometry args={[PRINT_PLATE_WIDTH + 24, depth + 24, 2]} />
          <meshStandardMaterial color="#2a303b" />
        </mesh>
        {parts.map((p, i) => (
          <mesh key={`${p.name}-${i}`} geometry={p.geometry} position={p.position}>
            <meshStandardMaterial color={groupColor(p.name)} />
          </mesh>
        ))}
      </group>
      <OrbitControls target={[cx, 0, depth / 2]} makeDefault />
    </Canvas>
  )
}

/**
 * Step 3 — make. Choose a build route, check the kit, download the
 * file, and follow a guide generated from this exact design.
 */
export function MakeView() {
  const spec = useDesignerStore((s) => s.spec)
  const updateExport = useDesignerStore((s) => s.updateExport)
  const updateFrame = useDesignerStore((s) => s.updateFrame)
  const method = useUiStore((s) => s.method)
  const setMethod = useUiStore((s) => s.setMethod)
  const setView = useUiStore((s) => s.setView)
  const inAtomm = useUiStore((s) => s.inAtomm)
  const [tab, setTab] = useState<Tab>('preview')
  const [done, setDone] = useState<Record<number, boolean>>({})
  const [status, setStatus] = useState<string | null>(null)

  const guide = useMemo(() => buildGuide(spec, method), [spec, method])
  const svg = useMemo(() => (method === 'laser' ? flatPackSvg(spec) : ''), [spec, method])
  // the same audit the test-suite runs on every shipped toy
  const audit = useMemo(() => (method === 'laser' ? basswoodAudit(spec) : []), [spec, method])
  const motionIssues = useMemo(() => {
    const signals = channelSignals(spec)
    return [
      ...spec.characters.flatMap((c) =>
        c.kind === 'flyer' ? flyerIssues(spec, c, signals).map((m) => `${c.label}: ${m}`) : [],
      ),
      ...spec.mechanism.cams.flatMap((cam) =>
        cam.kind === 'custom' ? drawnCamIssues(cam).map((m) => `${cam.id}: ${m}`) : [],
      ),
    ]
  }, [spec])
  const slug = spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const partCount = guide.parts.reduce((n, p) => n + p.qty, 0)

  const flash = (msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(null), 2500)
  }

  const openGuide = () => {
    const html = guideHtml(spec, method)
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => win.print(), 300)
    } else {
      downloadFile(`${slug}-build-guide.html`, html, 'text/html')
    }
  }

  const share = async () => {
    const url = shareUrl(spec)
    try {
      await navigator.clipboard.writeText(url)
      flash('Share link copied')
    } catch {
      window.prompt('Copy this share link:', url)
    }
  }

  const groups = [...new Set(guide.parts.map((p) => p.group))]

  return (
    <div className="make">
      <aside className="make-side">
        <h2>Make “{spec.name}”</h2>
        <p className="lede">How do you want to build it?</p>
        <div className="method-cards" role="radiogroup" aria-label="Build method">
          <button
            role="radio"
            aria-checked={method === 'laser'}
            className={`card method${method === 'laser' ? ' selected' : ''}`}
            onClick={() => setMethod('laser')}
          >
            <span className="card-name">Laser cut</span>
            <span className="card-blurb">Flat 3 mm basswood parts that slot together. One SVG file.</span>
          </button>
          <button
            role="radio"
            aria-checked={method === 'print'}
            className={`card method${method === 'print' ? ' selected' : ''}`}
            onClick={() => setMethod('print')}
          >
            <span className="card-name">3D print</span>
            <span className="card-blurb">Every part printed flat, no supports, nothing to buy. One STL file.</span>
          </button>
        </div>

        <div className="section-body settings">
          <NumberField
            label={method === 'laser' ? 'Sheet thickness (checked for 3 mm)' : 'Wall thickness'}
            value={spec.frame.materialThickness}
            min={2}
            max={6}
            step={0.5}
            onChange={(v) => updateFrame({ materialThickness: v })}
          />
          {method === 'laser' ? (
            <>
              <NumberField
                label="Laser kerf (cut width)"
                value={spec.export.kerf}
                min={0}
                max={0.5}
                step={0.05}
                onChange={(v) => updateExport({ kerf: v })}
              />
              <p className="hint">
                Not sure? 0.1 mm suits most diode lasers, 0.15–0.2 mm most CO₂ lasers. Bigger
                kerf = tighter joints.
              </p>
            </>
          ) : (
            <>
              <NumberField
                label="Fit clearance"
                value={spec.export.fdmClearance}
                min={0}
                max={0.6}
                step={0.05}
                onChange={(v) => updateExport({ fdmClearance: v })}
              />
              <p className="hint">
                0.2 mm suits a well-tuned printer. If parts come out too tight, raise it to
                0.3 mm.
              </p>
            </>
          )}
        </div>

        {method === 'laser' &&
          (audit.length === 0 ? (
            <div className="check ok">
              <b>✓ Ready for {BASSWOOD.thickness} mm basswood</b>
              <span>
                {partCount} parts on {guide.sheets} sheet{guide.sheets === 1 ? '' : 's'} of{' '}
                {BASSWOOD.sheetWidth} × {BASSWOOD.sheetHeight} mm. No neck under{' '}
                {BASSWOOD.minWeb} mm, no hole within {BASSWOOD.minLigament} mm of an edge.
              </span>
            </div>
          ) : (
            <div className="check bad">
              <b>
                {audit.length} thing{audit.length === 1 ? '' : 's'} to fix before cutting basswood
              </b>
              <ul>
                {audit.slice(0, 6).map((i) => (
                  <li key={`${i.part}-${i.rule}`}>
                    <span className="mono">{i.part}</span> {i.message}
                  </li>
                ))}
              </ul>
              {audit.length > 6 && <span>…and {audit.length - 6} more.</span>}
            </div>
          ))}
        {motionIssues.length > 0 && (
          <div className="check bad">
            <b>The mechanism needs a tweak</b>
            <ul>
              {motionIssues.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="export-buttons">
          {inAtomm ? (
            <>
              {/* hosted by atomm: the platform renders its Export button here
                  and calls our export hook for the files */}
              <div data-atomm-export-button className="atomm-export-slot" />
              <p className="hint">
                {method === 'laser'
                  ? 'Download gives you the cutting sheets, the build guide and the design file. Open in Studio sends the cutting sheets: red lines cut, blue lines score, blue labels engrave.'
                  : 'Download gives you the STL, the build guide and the design file. Open in Studio sends the laser cutting sheets, since Studio drives the laser.'}
              </p>
            </>
          ) : method === 'laser' ? (
            <button
              className="primary big"
              onClick={() => downloadFile(`${slug}-flatpack.svg`, svg, 'image/svg+xml')}
            >
              Download cutting file · SVG
            </button>
          ) : (
            <button
              className="primary big"
              onClick={() => downloadFile(`${slug}-parts.stl`, exportStl(spec), 'model/stl')}
            >
              Download print file · STL
            </button>
          )}
          <button onClick={openGuide}>Print the build guide (or save as PDF)</button>
          <div className="row">
            {!inAtomm && (
              <button
                style={{ flex: 1 }}
                onClick={() => downloadFile(`${slug}.json`, serializeSpec(spec), 'application/json')}
              >
                Save design file
              </button>
            )}
            <button style={{ flex: 1 }} onClick={share}>
              Copy share link
            </button>
          </div>
          {status && <p className="hint">{status}</p>}
        </div>
        <button className="link-btn" onClick={() => setView('design')}>
          ← Back to the design
        </button>
      </aside>

      <section className="make-main">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}>
            {method === 'laser' ? 'Cutting sheet' : 'Print plate'}
          </button>
          <button role="tab" aria-selected={tab === 'parts'} className={tab === 'parts' ? 'on' : ''} onClick={() => setTab('parts')}>
            Parts &amp; shopping list · {partCount}
          </button>
          <button role="tab" aria-selected={tab === 'guide'} className={tab === 'guide' ? 'on' : ''} onClick={() => setTab('guide')}>
            Assembly guide · {guide.steps.length} steps
          </button>
        </div>

        {tab === 'preview' &&
          (method === 'laser' ? (
            <div className="sheet-wrap">
              <p className="hint">
                {guide.sheets} sheet{guide.sheets === 1 ? '' : 's'} of {guide.footprint.width} ×{' '}
                {guide.footprint.height} mm, {spec.frame.materialThickness} mm thick · red = cut · blue =
                scored detail and labels · green = sheet edge (not cut)
              </p>
              <div className="sheet" dangerouslySetInnerHTML={{ __html: svg }} />
            </div>
          ) : (
            <div className="plate-wrap">
              <p className="hint">
                Parts packed for a {PRINT_PLATE_WIDTH} mm-wide bed — split into batches in your
                slicer if they do not fit at once. Drag to look around.
              </p>
              <div className="plate">
                <PlatePreview />
              </div>
            </div>
          ))}

        {tab === 'parts' && (
          <div className="doc">
            <h3>What you need</h3>
            <table>
              <tbody>
                {guide.hardware.map((h) => (
                  <tr key={h.item}>
                    <td>
                      <b>{h.item}</b>
                    </td>
                    <td>{h.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint">Tools: {guide.tools.join(' · ')}</p>
            {groups.map((group) => (
              <div key={group}>
                <h3>
                  <i className="dot" style={{ background: PART_COLORS[group] }} />
                  {group}
                </h3>
                <table>
                  <thead>
                    <tr>
                      <th>Part</th>
                      <th>{method === 'laser' ? 'Label on the sheet' : 'Name'}</th>
                      <th>Qty</th>
                      <th>Size (mm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guide.parts
                      .filter((p) => p.group === group)
                      .map((p) => (
                        <tr key={p.name}>
                          <td>{p.label}</td>
                          <td className="mono">{p.name}</td>
                          <td>{p.qty}</td>
                          <td>{p.size}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {tab === 'guide' && (
          <div className="doc">
            <ol className="steps">
              {guide.steps.map((step, i) => (
                <li key={step.title} className={done[i] ? 'done' : ''}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!done[i]}
                      onChange={(e) => setDone({ ...done, [i]: e.target.checked })}
                    />
                    <b>
                      {i + 1}. {step.title}
                    </b>
                  </label>
                  <ul>
                    {step.body.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  )
}
