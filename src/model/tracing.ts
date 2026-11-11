import type { Point2 } from './figures'

/**
 * Turning a picture into a figure: from a black-and-white MASK (a grid
 * of filled / empty cells — a drawing, or a thresholded photo) to a
 * closed outline in the figure library's normalized coordinates.
 *
 * Everything here is pure and grid-based, so it is tested without a
 * browser; the UI only has to supply the mask.
 */

export interface Mask {
  width: number
  height: number
  /** Row-major, 1 = filled. */
  data: Uint8Array
}

const at = (m: Mask, x: number, y: number) =>
  x >= 0 && y >= 0 && x < m.width && y < m.height ? m.data[y * m.width + x] : 0

/** Keep only the largest 4-connected blob (specks and stray marks are dropped). */
export function largestBlob(mask: Mask): Mask {
  const { width, height, data } = mask
  const label = new Int32Array(width * height)
  let best = 0
  let bestSize = 0
  let next = 0
  const stack: number[] = []
  for (let start = 0; start < data.length; start++) {
    if (!data[start] || label[start]) continue
    next++
    let size = 0
    stack.push(start)
    label[start] = next
    while (stack.length) {
      const i = stack.pop()!
      size++
      const x = i % width
      const y = (i - x) / width
      const tryCell = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return
        const j = ny * width + nx
        if (data[j] && !label[j]) {
          label[j] = next
          stack.push(j)
        }
      }
      tryCell(x + 1, y)
      tryCell(x - 1, y)
      tryCell(x, y + 1)
      tryCell(x, y - 1)
    }
    if (size > bestSize) {
      bestSize = size
      best = next
    }
  }
  const out = new Uint8Array(width * height)
  if (best) for (let i = 0; i < out.length; i++) out[i] = label[i] === best ? 1 : 0
  return { width, height, data: out }
}

/** Grow the filled area by `radius` cells — thickens thin necks and limbs. */
export function dilate(mask: Mask, radius: number): Mask {
  const { width, height } = mask
  const out = new Uint8Array(width * height)
  const r = Math.max(0, Math.round(radius))
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let hit = 0
      for (let dy = -r; dy <= r && !hit; dy++)
        for (let dx = -r; dx <= r; dx++)
          if (dx * dx + dy * dy <= r * r && at(mask, x + dx, y + dy)) {
            hit = 1
            break
          }
      out[y * width + x] = hit
    }
  return { width, height, data: out }
}

/**
 * Outer boundary of the filled area as a closed loop of cell CORNERS
 * (so a single cell traces a unit square, and the loop encloses exactly
 * the filled cells). Assumes one blob; holes are ignored.
 */
export function traceBoundary(mask: Mask): Point2[] {
  // start at the top-left filled cell; walk its outside edge clockwise in
  // image coordinates, keeping filled cells on the right
  let sx = -1
  let sy = -1
  outer: for (let y = 0; y < mask.height; y++)
    for (let x = 0; x < mask.width; x++)
      if (at(mask, x, y)) {
        sx = x
        sy = y
        break outer
      }
  if (sx < 0) return []
  const pts: Point2[] = []
  let x = sx
  let y = sy
  let dx = 1
  let dy = 0 // heading east along the top edge of the start cell
  const limit = 4 * (mask.width + 2) * (mask.height + 2)
  for (let step = 0; step < limit; step++) {
    pts.push({ x, y })
    // cells ahead-left and ahead-right of the corner we are moving to
    const nx = x + dx
    const ny = y + dy
    // with heading (dx,dy), the cell to the right-front and left-front of (nx,ny):
    const rightFront = cellFor(nx, ny, dx, dy, 1)
    const leftFront = cellFor(nx, ny, dx, dy, -1)
    x = nx
    y = ny
    if (at(mask, leftFront.x, leftFront.y)) {
      // wall ahead on the left too: turn left
      ;[dx, dy] = [dy, -dx]
    } else if (!at(mask, rightFront.x, rightFront.y)) {
      // nothing ahead on the right: turn right
      ;[dx, dy] = [-dy, dx]
    }
    if (x === sx && y === sy && dx === 1 && dy === 0) break
  }
  return pts
}

/** The cell diagonally ahead of corner (cx,cy) for a heading, on the right (+1) or left (−1). */
function cellFor(cx: number, cy: number, dx: number, dy: number, side: 1 | -1): Point2 {
  // right of heading (dx,dy) in image coords (y down) is (−dy, dx)
  const rx = -dy * side
  const ry = dx * side
  // the cell whose corner is (cx,cy), lying ahead (dx,dy) and to the side (rx,ry)
  return {
    x: cx + (dx + rx - 1) / 2,
    y: cy + (dy + ry - 1) / 2,
  }
}

function perpDistance(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len
}

function rdp(points: Point2[], eps: number): Point2[] {
  if (points.length < 3) return points
  let worst = 0
  let index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDistance(points[i], points[0], points[points.length - 1])
    if (d > worst) {
      worst = d
      index = i
    }
  }
  if (worst <= eps) return [points[0], points[points.length - 1]]
  return [...rdp(points.slice(0, index + 1), eps).slice(0, -1), ...rdp(points.slice(index), eps)]
}

/** Simplify a closed loop (Ramer–Douglas–Peucker, split at its two far ends). */
export function simplifyClosed(loop: Point2[], eps: number): Point2[] {
  if (loop.length < 4) return loop
  let far = 0
  let best = -1
  for (let i = 0; i < loop.length; i++) {
    const d = Math.hypot(loop[i].x - loop[0].x, loop[i].y - loop[0].y)
    if (d > best) {
      best = d
      far = i
    }
  }
  const a = rdp(loop.slice(0, far + 1), eps)
  const b = rdp([...loop.slice(far), loop[0]], eps)
  return [...a.slice(0, -1), ...b.slice(0, -1)]
}

/** One pass of corner cutting: rounds the staircase a pixel trace leaves. */
function chaikin(loop: Point2[]): Point2[] {
  const out: Point2[] = []
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]
    const b = loop[(i + 1) % loop.length]
    out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 })
    out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 })
  }
  return out
}

export interface TracedShape {
  /** Normalized like the library: x ∈ [-0.5, 0.5], y ∈ [0, 1], CCW, base at y = 0. */
  outline: Point2[]
  /** Real width ÷ real height of the normalized box. */
  aspect: number
}

/** Fewest / most points a traced figure may carry (cut quality vs share-link size). */
export const TRACE_MIN_POINTS = 8
export const TRACE_MAX_POINTS = 160

/**
 * The whole pipeline: mask → largest blob → boundary → smooth outline in
 * library coordinates. x = 0 is placed under the middle of the figure's
 * LOWEST edge, because that is where the rod or platform meets it.
 * Returns null if there is nothing big enough to trace.
 */
export function traceMask(mask: Mask): TracedShape | null {
  const blob = largestBlob(mask)
  const raw = traceBoundary(blob)
  if (raw.length < 4) return null
  const xs = raw.map((p) => p.x)
  const ys = raw.map((p) => p.y)
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  if (w < 6 || h < 6) return null

  // round the corners when the point budget allows; a very detailed
  // shape keeps its crisp corners rather than losing its detail
  const build = (e: number) => {
    const simple = simplifyClosed(raw, e)
    return simple.length * 2 <= TRACE_MAX_POINTS ? chaikin(simple) : simple
  }
  let eps = Math.max(0.6, Math.max(w, h) / 160)
  let loop = build(eps)
  while (loop.length > TRACE_MAX_POINTS && eps < 20) {
    eps *= 1.4
    loop = build(eps)
  }
  if (loop.length < TRACE_MIN_POINTS) return null

  // image y runs down; figures stand up
  const bottom = Math.max(...loop.map((p) => p.y))
  const top = Math.min(...loop.map((p) => p.y))
  const height = bottom - top
  // mount under the middle of the lowest 4% of the figure
  const feet = loop.filter((p) => bottom - p.y <= height * 0.04)
  const mountX = (Math.min(...feet.map((p) => p.x)) + Math.max(...feet.map((p) => p.x))) / 2
  const half = Math.max(...loop.map((p) => Math.abs(p.x - mountX)))
  const round = (v: number) => Math.round(v * 1000) / 1000
  let outline = loop.map((p) => ({
    x: round((p.x - mountX) / (2 * half)),
    y: round((bottom - p.y) / height),
  }))
  // counter-clockwise, like the library
  let area = 0
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]
    const b = outline[(i + 1) % outline.length]
    area += a.x * b.y - b.x * a.y
  }
  if (area < 0) outline = outline.reverse()
  // drop points that rounding made coincide
  outline = outline.filter((p, i) => {
    const q = outline[(i + 1) % outline.length]
    return Math.hypot(p.x - q.x, p.y - q.y) > 0.004
  })
  if (outline.length < TRACE_MIN_POINTS) return null
  return { outline, aspect: (2 * half) / height }
}
