import { useCallback, useEffect, useRef, useState } from 'react'
import { dilate, traceMask, type Mask, type TracedShape } from '../model/tracing'
import { BASSWOOD, narrowestWeb } from '../export/basswood'

/** Canvas resolution the picture is traced at. */
const RES = 200
/** Height (mm) a new figure is checked and created at. */
const CHECK_HEIGHT = 40

export interface StudioResult extends TracedShape {
  width: number
  height: number
}

/** Real size for a traced shape: 40 mm tall unless that makes it too wide. */
function sized(shape: TracedShape): StudioResult {
  let height = CHECK_HEIGHT
  let width = height * shape.aspect
  if (width > 64) {
    width = 64
    height = width / shape.aspect
  }
  return { ...shape, width: Math.round(width), height: Math.round(height) }
}

/**
 * Draw or upload your own figure. Whatever ends up dark on the canvas
 * is traced into one closed outline (the biggest blob), which is then
 * measured against the basswood rules at its real size — with a
 * "Thicker" control to fatten necks that would snap.
 */
export function ShapeStudio({
  onUse,
  onClose,
}: {
  onUse: (result: StudioResult) => void
  onClose: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const stroke = useRef<{ x: number; y: number }[] | null>(null)
  const [thick, setThick] = useState(0)
  const [result, setResult] = useState<StudioResult | null>(null)
  const [neck, setNeck] = useState<number>(Infinity)
  const [dirty, setDirty] = useState(false)

  const ctx = () => canvas.current?.getContext('2d', { willReadFrequently: true }) ?? null

  const clear = useCallback(() => {
    const g = ctx()
    if (!g) return
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, RES, RES)
    setResult(null)
    setDirty(false)
  }, [])

  useEffect(() => clear(), [clear])

  /** Read the canvas as a mask (dark = figure) and trace it. */
  const retrace = useCallback(
    (extra = thick) => {
      const g = ctx()
      if (!g) return
      const img = g.getImageData(0, 0, RES, RES).data
      const data = new Uint8Array(RES * RES)
      for (let i = 0; i < RES * RES; i++) {
        const lum = 0.299 * img[i * 4] + 0.587 * img[i * 4 + 1] + 0.114 * img[i * 4 + 2]
        data[i] = img[i * 4 + 3] > 128 && lum < 150 ? 1 : 0
      }
      let mask: Mask = { width: RES, height: RES, data }
      if (extra > 0) mask = dilate(mask, extra)
      const traced = traceMask(mask)
      if (!traced) {
        setResult(null)
        return
      }
      const r = sized(traced)
      setResult(r)
      setNeck(narrowestWeb(r.outline.map((p) => ({ x: p.x * r.width, y: p.y * r.height }))))
    },
    [thick],
  )

  const point = (e: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * RES,
      y: ((e.clientY - rect.top) / rect.height) * RES,
    }
  }

  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    stroke.current = [point(e)]
  }
  const move = (e: React.PointerEvent) => {
    const g = ctx()
    if (!stroke.current || !g) return
    const p = point(e)
    const last = stroke.current[stroke.current.length - 1]
    g.strokeStyle = '#111111'
    g.lineWidth = 9
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(last.x, last.y)
    g.lineTo(p.x, p.y)
    g.stroke()
    stroke.current.push(p)
  }
  const up = () => {
    const g = ctx()
    const pts = stroke.current
    stroke.current = null
    if (!g || !pts || pts.length < 2) return
    // a stroke that comes back near its start is an outline: fill it in
    const first = pts[0]
    const last = pts[pts.length - 1]
    if (pts.length > 12 && Math.hypot(first.x - last.x, first.y - last.y) < 26) {
      g.fillStyle = '#111111'
      g.beginPath()
      g.moveTo(first.x, first.y)
      for (const p of pts) g.lineTo(p.x, p.y)
      g.closePath()
      g.fill()
    }
    setDirty(true)
    retrace()
  }

  const upload = (file: File) => {
    const img = new Image()
    img.onload = () => {
      const g = ctx()
      if (!g) return
      g.fillStyle = '#ffffff'
      g.fillRect(0, 0, RES, RES)
      const scale = Math.min((RES - 16) / img.width, (RES - 16) / img.height)
      const w = img.width * scale
      const h = img.height * scale
      g.drawImage(img, (RES - w) / 2, (RES - h) / 2, w, h)
      URL.revokeObjectURL(img.src)
      setDirty(true)
      retrace()
    }
    img.src = URL.createObjectURL(file)
  }

  const ok = result !== null && neck >= BASSWOOD.minWeb
  const preview = result
    ? result.outline
        .map((p, i) => `${i ? 'L' : 'M'}${(p.x * result.aspect).toFixed(3)},${(-p.y).toFixed(3)}`)
        .join(' ') + ' Z'
    : ''

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal studio" role="dialog" aria-label="Draw your own figure" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Make your own figure</h3>
            <p>
              Draw it — paint the shape, or draw its outline and close the loop to fill it — or
              upload a dark picture on a light background. Stand it upright: the bottom of the
              picture is where it mounts.
            </p>
          </div>
          <button className="icon-btn close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="studio-body">
          <div>
            <canvas
              ref={canvas}
              width={RES}
              height={RES}
              className="studio-canvas"
              aria-label="Drawing area"
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
            />
            <div className="row" style={{ marginTop: 8 }}>
              <button onClick={clear}>Clear</button>
              <label className="file-btn">
                Upload a picture
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) upload(file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>
          <div className="studio-result">
            <b>Your figure, traced</b>
            <svg viewBox="-0.75 -1.1 1.5 1.2" className="studio-preview" aria-hidden="true">
              <line x1="-0.7" x2="0.7" y1="0" y2="0" className="ground" />
              {preview && <path d={preview} />}
            </svg>
            {!result && (
              <p className="hint">{dirty ? 'Nothing big enough to trace yet — keep drawing.' : 'Start drawing on the left.'}</p>
            )}
            {result &&
              (ok ? (
                <div className="check ok">
                  <b>✓ Cuts cleanly in {BASSWOOD.thickness} mm basswood</b>
                  <span>
                    {result.width} × {result.height} mm, {result.outline.length} points, no neck
                    under {BASSWOOD.minWeb} mm.
                  </span>
                </div>
              ) : (
                <div className="check bad">
                  <b>A neck is only {neck.toFixed(1)} mm wide</b>
                  <span>It would snap in basswood. Press “Thicker”, or redraw that part fatter.</span>
                </div>
              ))}
            <div className="row">
              <button
                disabled={!dirty}
                onClick={() => {
                  const next = Math.min(8, thick + 1)
                  setThick(next)
                  retrace(next)
                }}
              >
                Thicker
              </button>
              <button
                disabled={!dirty || thick === 0}
                onClick={() => {
                  const next = Math.max(0, thick - 1)
                  setThick(next)
                  retrace(next)
                }}
              >
                Thinner
              </button>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button onClick={onClose}>Cancel</button>
          <button className="primary big" disabled={!result} onClick={() => result && onUse(result)}>
            Use this figure →
          </button>
        </div>
      </div>
    </div>
  )
}
