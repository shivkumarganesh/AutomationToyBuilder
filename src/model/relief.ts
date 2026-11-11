import type { Point2 } from './figures'
import { chaikin, dilate, simplifyClosed, traceBoundary, type Mask } from './tracing'
import { BASSWOOD, inside, narrowestWeb } from './webCheck'

/**
 * Depth from flat stock.
 *
 * A figure cut from one sheet is a silhouette. Stack smaller copies of
 * its outline on top — each one INSET from the last, like the contour
 * lines of a hill — and the same sheet builds a rounded, sculpted body.
 * The laser route cuts the stack as separate plates (one sheet thick
 * each) to glue up; the print route turns the same idea into many fine
 * steps that read as a smooth dome, so a printed figure has real volume.
 *
 * Insetting is done on a grid: the outline is rasterised, a distance
 * field says how far each cell is from the edge, and each layer is the
 * boundary of "at least d from the edge". That is robust for any
 * outline — library shapes and user drawings alike — and layers are
 * nested by construction.
 */

/** Grid cells per millimetre. */
const PX = 4
/** How far each laser layer steps in from the one below (mm). */
export const RELIEF_STEP = 2.5
/** Parts of a layer narrower than about twice this are dropped (mm). */
const OPEN = 1.3
/** Most depth layers a figure can carry per face. */
export const MAX_RELIEF = 3

function rasterise(outline: Point2[]): { mask: Mask; minX: number; maxY: number } {
  const xs = outline.map((p) => p.x)
  const ys = outline.map((p) => p.y)
  const pad = 2
  const minX = Math.min(...xs) - pad / PX
  const maxY = Math.max(...ys) + pad / PX
  const width = Math.ceil((Math.max(...xs) - Math.min(...xs)) * PX) + 2 * pad
  const height = Math.ceil((Math.max(...ys) - Math.min(...ys)) * PX) + 2 * pad
  const data = new Uint8Array(width * height)
  // even-odd scanline fill at cell centres (image rows run down, figure y runs up)
  for (let row = 0; row < height; row++) {
    const y = maxY - (row + 0.5) / PX
    const cuts: number[] = []
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i]
      const b = outline[(i + 1) % outline.length]
      if (a.y > y !== b.y > y) cuts.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y))
    }
    cuts.sort((p, q) => p - q)
    for (let k = 0; k + 1 < cuts.length; k += 2) {
      const from = Math.max(0, Math.ceil((cuts[k] - minX) * PX - 0.5))
      const to = Math.min(width - 1, Math.floor((cuts[k + 1] - minX) * PX - 0.5))
      for (let col = from; col <= to; col++) data[row * width + col] = 1
    }
  }
  return { mask: { width, height, data }, minX, maxY }
}

/** Distance of every filled cell from the nearest empty one, in cells (3-4 chamfer). */
function distanceField(mask: Mask): Float32Array {
  const { width: w, height: h, data } = mask
  const d = new Float32Array(w * h)
  const BIG = 1e9
  for (let i = 0; i < d.length; i++) d[i] = data[i] ? BIG : 0
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x])
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!d[i]) continue
      d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4)
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      if (!d[i]) continue
      d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4)
    }
  for (let i = 0; i < d.length; i++) d[i] /= 3
  return d
}

interface Field {
  mask: Mask
  dist: Float32Array
  minX: number
  maxY: number
}

const fields = new Map<string, Field>()
function fieldOf(outline: Point2[]): Field {
  const key = outline.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(';')
  let f = fields.get(key)
  if (!f) {
    const r = rasterise(outline)
    f = { ...r, dist: distanceField(r.mask) }
    if (fields.size > 80) fields.clear()
    fields.set(key, f)
  }
  return f
}

/** Every 4-connected blob of at least `minCells` cells, each as its own mask. */
function blobs(mask: Mask, minCells: number): Mask[] {
  const { width, height, data } = mask
  const seen = new Uint8Array(width * height)
  const out: Mask[] = []
  const stack: number[] = []
  for (let start = 0; start < data.length; start++) {
    if (!data[start] || seen[start]) continue
    const cells: number[] = []
    stack.push(start)
    seen[start] = 1
    while (stack.length) {
      const i = stack.pop()!
      cells.push(i)
      const x = i % width
      const y = (i - x) / width
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const j = ny * width + nx
        if (data[j] && !seen[j]) {
          seen[j] = 1
          stack.push(j)
        }
      }
    }
    if (cells.length < minCells) continue
    const blob = new Uint8Array(width * height)
    for (const i of cells) blob[i] = 1
    out.push({ width, height, data: blob })
  }
  return out
}

/**
 * The outline moved inwards by `distance` mm. An inset can split a shape
 * (a butterfly's two wings, a boat's hull and sails), so the result is
 * a list of pieces — empty when nothing meaningful is left.
 */
export function insetOutline(outline: Point2[], distance: number): Point2[][] {
  const f = fieldOf(outline)
  const { width, height } = f.mask
  // "opening": go in a little further than asked, then grow back. Thin
  // appendages (a tail stalk, a beak) do not survive the extra step, so
  // each piece is chunky, with no neck narrower than about twice OPEN.
  const deep = new Uint8Array(width * height)
  const limit = distance * PX
  const deeper = (distance + OPEN) * PX
  let any = 0
  for (let i = 0; i < deep.length; i++)
    if (f.dist[i] > deeper) {
      deep[i] = 1
      any++
    }
  if (any < 30) return []
  const grown = dilate({ width, height, data: deep }, Math.round(OPEN * PX))
  const data = new Uint8Array(width * height)
  for (let i = 0; i < data.length; i++) data[i] = grown.data[i] && f.dist[i] > limit ? 1 : 0
  const pieces: Point2[][] = []
  for (const blob of blobs({ width, height, data }, 60)) {
    const loop = traceBoundary(blob)
    if (loop.length < 8) continue
    const smooth = chaikin(simplifyClosed(loop, 0.7))
    // grid corners → mm, y up; counter-clockwise like every other outline
    let pts = smooth.map((p) => ({ x: f.minX + p.x / PX, y: f.maxY - p.y / PX }))
    let a = 0
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const q = pts[(i + 1) % pts.length]
      a += p.x * q.y - q.x * p.y
    }
    if (a < 0) pts = pts.reverse()
    pts = pts.filter((p, i) => {
      const q = pts[(i + 1) % pts.length]
      return Math.hypot(p.x - q.x, p.y - q.y) > 0.05
    })
    if (pts.length >= 6) pieces.push(pts)
  }
  // stable order: left to right
  return pieces.sort((p, q) => centreOf(p).x - centreOf(q).x)
}

/** Smallest plate worth cutting and gluing (mm across). */
const MIN_LAYER = 7

function cuttable(layer: Point2[]): boolean {
  const xs = layer.map((p) => p.x)
  const ys = layer.map((p) => p.y)
  if (Math.max(...xs) - Math.min(...xs) < MIN_LAYER || Math.max(...ys) - Math.min(...ys) < MIN_LAYER)
    return false
  return narrowestWeb(layer) >= BASSWOOD.minWeb
}

/**
 * The stack of depth levels for the LASER route, lowest first: up to
 * `count` levels, each RELIEF_STEP further in than the one below
 * (`first` sets the first inset). A level is one or more plates. Plates
 * too small or too thin-necked to cut from basswood are left out, and
 * the stack stops at the first level with none left — so every plate
 * returned is buildable.
 */
export function reliefLayers(outline: Point2[], count: number, first = RELIEF_STEP): Point2[][][] {
  const levels: Point2[][][] = []
  for (let k = 0; k < Math.min(count, MAX_RELIEF); k++) {
    const plates = insetOutline(outline, first + k * RELIEF_STEP).filter(cuttable)
    if (plates.length === 0) break
    levels.push(plates)
  }
  return levels
}

export interface DomeSlice {
  outlines: Point2[][]
  /** Bottom and top of the slice above the figure's face, mm. */
  from: number
  to: number
}

/** Fine slices per laser layer in a printed dome. */
const SLICES_PER_LAYER = 4

/**
 * The same depth for the PRINT route: instead of a few sheet-thick
 * steps, many thin slices following a quarter-circle profile — steep at
 * the rim, flat on top — over the same footprint and the same total
 * height as the laser stack (`layers` levels of `sheet` mm). Printed,
 * it reads as a smooth dome.
 */
export function domeSlices(outline: Point2[], layers: number, sheet: number, first = RELIEF_STEP): DomeSlice[] {
  const built = reliefLayers(outline, layers, first).length
  if (built === 0) return []
  const height = built * sheet
  const reach = first + (built - 1) * RELIEF_STEP
  const n = built * SLICES_PER_LAYER
  const profile = (u: number) => height * Math.sqrt(1 - (1 - u) * (1 - u))
  const slices: DomeSlice[] = []
  for (let k = 1; k <= n; k++) {
    // start just inside the rim so the first slice is a visible step in
    const inset = 0.6 + (reach - 0.6) * (k / n)
    const outlines = insetOutline(outline, inset)
    if (outlines.length === 0) break
    slices.push({ outlines, from: profile((k - 1) / n), to: profile(k / n) })
  }
  return slices
}

/** How many of a nested stack's levels (from the first) have a plate under a point. */
export function levelAt(levels: Point2[][][], pt: Point2): number {
  let level = 0
  for (const plates of levels) {
    if (!plates.some((plate) => inside(plate, pt))) break
    level++
  }
  return level
}

/** Middle of a polyline or plate — where it is considered to sit. */
export function centreOf(pts: Point2[]): Point2 {
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  }
}
