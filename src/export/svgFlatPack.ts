import type { AutomatonSpec } from '../model/types'
import { outputChannels } from '../model/types'
import { camOutline, type Point2 } from '../kinematics/camProfile'

/**
 * Laser-cut flat-pack layout of the frame (the zone boundary) and the cams.
 *
 * Kerf strategy: the beam burns `kerf/2` off each side of a cut line, so
 * fit-critical features are compensated parametrically —
 *   - finger-joint and tab boundaries shift so fingers/tabs widen by kerf
 *     and their mating notches/slots narrow by kerf (tight friction fit);
 *   - interior holes are drawn `kerf` under their intended size (the cut
 *     enlarges them back);
 *   - cam outlines are grown radially by `kerf/2`.
 * Overall panel outer dimensions are left nominal; the kerf/2 shrink
 * (~0.05 mm) does not affect assembly.
 *
 * Construction: four walls corner-joined with interleaved finger joints;
 * every wall has two tabs on its top edge that lock into slots in the
 * stage plate; the stage also carries the pushrod guide slots; the side
 * walls carry the shaft bearing holes; cams press onto a D-profile shaft.
 */

type Path = Point2[]

interface Part {
  name: string
  outline: Path
  holes: Path[]
  width: number
  height: number
}

const FINGER_SEGMENTS = 5 // odd, so both ends of a joint edge are symmetric
const TAB_WIDTH = 14
const TABS_PER_EDGE = 2
const BEARING_CLEARANCE = 0.5 // radial slop so the shaft spins freely
const GUIDE_CLEARANCE = 0.4 // per-side slop so pushrods slide in their slots

/** Shaft cross-section: circle with a flat — cams key onto it and can't spin. */
export function dHolePath(diameter: number, cx: number, cy: number, segments = 48): Path {
  const r = diameter / 2
  const flatY = r * 0.55 // flat chord height above centre
  const start = Math.asin(flatY / r)
  const path: Path = []
  // arc from the right end of the flat, all the way round to its left end
  const sweep = 2 * Math.PI - (Math.PI - 2 * start)
  for (let i = 0; i <= segments; i++) {
    const a = Math.PI - start + (i / segments) * sweep
    path.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return path
}

function rect(cx: number, cy: number, w: number, h: number): Path {
  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ]
}

function circle(cx: number, cy: number, r: number, segments = 48): Path {
  const path: Path = []
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * 2 * Math.PI
    path.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return path
}

/** Evenly spread `count` centres along a length. */
function spread(length: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => ((i + 1) * length) / (count + 1))
}

interface EdgeSpec {
  /** 'straight' | 'finger' (corner joint) | 'tabs' (into stage slots) */
  type: 'straight' | 'finger' | 'tabs'
  /** finger joints: which alternating segments are material (0 or 1). */
  phase?: 0 | 1
}

/**
 * Build one panel outline walking its four edges counter-clockwise:
 * bottom (y=0) → right → top → left. Fingers/tabs protrude by `t`.
 */
function panelOutline(w: number, h: number, t: number, kerf: number, edges: {
  bottom: EdgeSpec
  right: EdgeSpec
  top: EdgeSpec
  left: EdgeSpec
}): Path {
  const pts: Path = []
  const half = kerf / 2

  // Walk an edge from `from` to `to`; `out` is the outward normal.
  const walk = (from: Point2, to: Point2, out: Point2, spec: EdgeSpec) => {
    if (spec.type === 'straight') {
      pts.push(to)
      return
    }
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.hypot(dx, dy)
    const ux = dx / len
    const uy = dy / len

    if (spec.type === 'finger') {
      const n = FINGER_SEGMENTS
      const seg = len / n
      const phase = spec.phase ?? 0
      // segment i carries material at the nominal line when (i % 2) === phase,
      // otherwise it is a notch inset by the material thickness
      for (let i = 0; i < n; i++) {
        const isMaterial = i % 2 === phase
        const inset = isMaterial ? 0 : -t
        // material segments widen by kerf/2 on each interior boundary,
        // notches narrow by the same amount
        let s0 = i * seg
        let s1 = (i + 1) * seg
        if (i > 0) s0 += (i - 1) % 2 === phase ? half : -half
        if (i < n - 1) s1 += isMaterial ? half : -half
        pts.push({ x: from.x + ux * s0 + out.x * inset, y: from.y + uy * s0 + out.y * inset })
        pts.push({ x: from.x + ux * s1 + out.x * inset, y: from.y + uy * s1 + out.y * inset })
      }
      return
    }

    // tabs: straight edge with protruding tabs that enter stage slots
    const centers = spread(len, TABS_PER_EDGE)
    for (const c of centers) {
      const a = c - TAB_WIDTH / 2 - half
      const b = c + TAB_WIDTH / 2 + half
      pts.push({ x: from.x + ux * a, y: from.y + uy * a })
      pts.push({ x: from.x + ux * a + out.x * t, y: from.y + uy * a + out.y * t })
      pts.push({ x: from.x + ux * b + out.x * t, y: from.y + uy * b + out.y * t })
      pts.push({ x: from.x + ux * b, y: from.y + uy * b })
    }
    pts.push(to)
  }

  const c0 = { x: 0, y: 0 }
  const c1 = { x: w, y: 0 }
  const c2 = { x: w, y: h }
  const c3 = { x: 0, y: h }
  pts.push(c0)
  walk(c0, c1, { x: 0, y: -1 }, edges.bottom)
  walk(c1, c2, { x: 1, y: 0 }, edges.right)
  walk(c2, c3, { x: 0, y: 1 }, edges.top)
  walk(c3, c0, { x: -1, y: 0 }, edges.left)
  return pts
}

/** Grow a centred polygon radially (positive = outward). */
function growRadially(path: Path, amount: number): Path {
  return path.map((p) => {
    const r = Math.hypot(p.x, p.y)
    const f = (r + amount) / r
    return { x: p.x * f, y: p.y * f }
  })
}

function translate(path: Path, dx: number, dy: number): Path {
  return path.map((p) => ({ x: p.x + dx, y: p.y + dy }))
}

function bounds(path: Path) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of path) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

/** Generate all parts for the current spec. Exported for tests. */
export function generateParts(spec: AutomatonSpec): Part[] {
  const { width: w, depth: d, height: h, materialThickness: t } = spec.frame
  const kerf = spec.export.kerf
  const mech = spec.mechanism
  const parts: Part[] = []

  // Side walls (bear the shaft). Corner fingers phase 0; tabs on top.
  for (const name of ['side-left', 'side-right']) {
    const outline = panelOutline(d, h, t, kerf, {
      bottom: { type: 'straight' },
      right: { type: 'finger', phase: 0 },
      top: { type: 'tabs' },
      left: { type: 'finger', phase: 0 },
    })
    const bearing = circle(d / 2, mech.shaftHeight, (mech.shaftDiameter + BEARING_CLEARANCE - kerf) / 2)
    parts.push({ name, outline, holes: [bearing], width: d, height: h })
  }

  // Front/back walls: complementary corner fingers; tabs on top.
  for (const name of ['wall-front', 'wall-back']) {
    const outline = panelOutline(w, h, t, kerf, {
      bottom: { type: 'straight' },
      right: { type: 'finger', phase: 1 },
      top: { type: 'tabs' },
      left: { type: 'finger', phase: 1 },
    })
    parts.push({ name, outline, holes: [], width: w, height: h })
  }

  // Stage plate: slots for every wall tab + a guide slot per output channel.
  {
    const outline = panelOutline(w, d, t, kerf, {
      bottom: { type: 'straight' },
      right: { type: 'straight' },
      top: { type: 'straight' },
      left: { type: 'straight' },
    })
    const holes: Path[] = []
    const slotW = TAB_WIDTH - kerf
    const slotH = t - kerf
    // front/back wall centrelines sit t/2 in from the stage edges; their
    // top-edge tabs are spread along the wall length (= w)
    for (const c of spread(w, TABS_PER_EDGE)) {
      holes.push(rect(c, d - t / 2, slotW, slotH))
      holes.push(rect(c, t / 2, slotW, slotH))
    }
    // side wall centrelines at x = t/2 and w − t/2, tabs spread along d
    for (const c of spread(d, TABS_PER_EDGE)) {
      holes.push(rect(t / 2, c, slotH, slotW))
      holes.push(rect(w - t / 2, c, slotH, slotW))
    }
    // pushrod guide slots at each channel's stage position
    for (const ch of outputChannels(spec)) {
      const size = ch.pushrod.rodWidth + 2 * GUIDE_CLEARANCE - kerf
      holes.push(rect(ch.x + w / 2, d / 2, size, size))
    }
    parts.push({ name: 'stage', outline, holes, width: w, height: d })
  }

  // Bottom panel: plain rectangle glued inside the walls.
  {
    const bw = w - 2 * t
    const bd = d - 2 * t
    parts.push({
      name: 'bottom',
      outline: [
        { x: 0, y: 0 },
        { x: bw, y: 0 },
        { x: bw, y: bd },
        { x: 0, y: bd },
      ],
      holes: [],
      width: bw,
      height: bd,
    })
  }

  // Cams: profile grown by kerf/2, D-hole shrunk by kerf for a press fit.
  for (const cam of mech.cams) {
    const raw = camOutline(cam, 128)
    const outline = growRadially(raw, kerf / 2)
    const b = bounds(outline)
    const centred = translate(outline, -b.minX, -b.minY)
    const hole = translate(dHolePath(mech.shaftDiameter - kerf, 0, 0), -b.minX, -b.minY)
    parts.push({
      name: `cam-${cam.kind}`,
      outline: centred,
      holes: [hole],
      width: b.maxX - b.minX,
      height: b.maxY - b.minY,
    })
  }

  return parts
}

function pathToSvg(path: Path): string {
  const d = path.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ')
  return `${d} Z`
}

/** Render the full flat-pack SVG document (mm units, hairline cut strokes). */
export function flatPackSvg(spec: AutomatonSpec): string {
  const parts = generateParts(spec)
  const GAP = 8
  const MARGIN = 10

  // shelf-pack the parts into rows
  let x = MARGIN
  let y = MARGIN
  let rowH = 0
  let sheetW = 0
  const placed: { part: Part; dx: number; dy: number }[] = []
  const maxRowWidth = 420
  for (const part of parts) {
    const pb = bounds(part.outline)
    const pw = pb.maxX - pb.minX
    const ph = pb.maxY - pb.minY
    if (x + pw > maxRowWidth && x > MARGIN) {
      x = MARGIN
      y += rowH + GAP
      rowH = 0
    }
    placed.push({ part, dx: x - pb.minX, dy: y - pb.minY })
    x += pw + GAP
    rowH = Math.max(rowH, ph)
    sheetW = Math.max(sheetW, x)
  }
  const sheetH = y + rowH + MARGIN

  const cut: string[] = []
  const labels: string[] = []
  for (const { part, dx, dy } of placed) {
    cut.push(`<path d="${pathToSvg(translate(part.outline, dx, dy))}"/>`)
    for (const hole of part.holes) {
      cut.push(`<path d="${pathToSvg(translate(hole, dx, dy))}"/>`)
    }
    const pb = bounds(translate(part.outline, dx, dy))
    labels.push(
      `<text x="${(pb.minX + pb.maxX) / 2}" y="${pb.maxY - 2}" text-anchor="middle" font-size="4">${part.name}</text>`,
    )
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}mm" height="${sheetH}mm" viewBox="0 0 ${sheetW} ${sheetH}">`,
    `<!-- ${spec.name} — flat-pack, kerf ${spec.export.kerf} mm, material ${spec.frame.materialThickness} mm. Red = cut, blue = engrave. -->`,
    `<g fill="none" stroke="#ff0000" stroke-width="0.1">`,
    ...cut,
    `</g>`,
    `<g fill="#0000ff" font-family="sans-serif">`,
    ...labels,
    `</g>`,
    `</svg>`,
  ].join('\n')
}
