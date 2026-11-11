import type { CharacterSpec } from '../model/types'
import {
  characterOutline,
  DEFAULT_FIGURE_SHAPE,
  FIGURE_SHAPES,
  figureEngraving,
  figureLayers,
  type Point2,
} from '../model/figures'
import { centreOf, domeSlices, levelAt, reliefLayers, type DomeSlice } from '../model/relief'
import { inside } from '../model/webCheck'
import { flyerBodyEngraving, flyerBodyOutline } from './flyerLayout'

/**
 * How a figure is built up in depth — shared by the 3D view, the cut
 * file and the print file, so the stack on screen is the stack that is
 * cut, glued or printed.
 *
 * A figure's `relief` is the number of DEPTH LEVELS added to each face:
 * plates of the same sheet, each a step smaller than the one below.
 * Everything else that lives on a face — the hand-made detail plates
 * (a fin, a wing) and the engraved lines — sits on whichever level is
 * under it, so nothing is ever buried or left floating.
 */
export interface Placed<T> {
  item: T
  /** Depth level it sits on: 0 = the figure's own face. */
  level: number
  /** Index of the detail plate it lies on, when it is not on the face or a depth level. */
  on?: number
}

export interface PlacedDetail extends Placed<Point2[]> {
  /** How many detail plates are stacked under it. */
  rise: number
}

/** Height of one stacked plate on a printed figure, mm. */
export const PRINT_TIER = 2.2

export interface FigureStack {
  /** The figure's own plate, mm. */
  outline: Point2[]
  /** Depth levels, lowest first; each level is one or more plates. */
  levels: Point2[][][]
  /** Hand-made detail plates, each on the highest level it touches. */
  details: PlacedDetail[]
  /** True for figures built up by anatomy: they print as two rounded halves. */
  sculpted: boolean
  /** Engraved lines, cut into runs so each run lies on ONE plate. */
  engraving: Placed<Point2[]>[]
  /**
   * Everything scored on each level: the engraved runs, plus the glue-up
   * footprint of whatever sits on it (the next level, a detail plate).
   * All open polylines, each wholly on one plate.
   */
  scores: Placed<Point2[]>[]
}

/** A flyer body is narrow and carries stitch holes near its edges: its ridge starts further in. */
export const FLYER_RELIEF_FIRST = 5

const cache = new Map<string, FigureStack>()
function memo(key: string, build: () => FigureStack): FigureStack {
  let stack = cache.get(key)
  if (!stack) {
    stack = build()
    if (cache.size > 60) cache.clear()
    cache.set(key, stack)
  }
  return stack
}
const sig = (pts: Point2[]) => pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(';')

const SCORE_STEP = 0.4

/** Points along a polyline no further apart than SCORE_STEP. */
function walk(line: Point2[]): Point2[] {
  const out: Point2[] = []
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]
    const b = line[i + 1]
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / SCORE_STEP))
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })
  }
  out.push(line[line.length - 1])
  return out
}

/** A footprint closer than this to the edge it sits on is not scored, mm. */
const FLUSH = 0.9

/** Distance from a point to the nearest edge of a closed outline. */
function edgeDistance(poly: Point2[], pt: Point2): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = dx * dx + dy * dy
    const t = len > 0 ? Math.min(1, Math.max(0, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len)) : 0
    best = Math.min(best, Math.hypot(pt.x - a.x - t * dx, pt.y - a.y - t * dy))
  }
  return best
}

interface Surface {
  level: number
  on?: number
}

/** Cut a polyline wherever the surface under it changes: one run per stretch on a single plate. */
function runs(line: Point2[], surfaceAt: (pt: Point2) => Surface, keep: (s: Surface) => boolean = () => true): Placed<Point2[]>[] {
  const out: Placed<Point2[]>[] = []
  let run: Point2[] = []
  let at: Surface = { level: -1 }
  const flush = () => {
    if (run.length >= 2 && keep(at)) out.push({ item: run, level: at.level, ...(at.on !== undefined ? { on: at.on } : {}) })
    run = []
  }
  for (const pt of walk(line)) {
    const s = surfaceAt(pt)
    if (s.level !== at.level || s.on !== at.on) flush()
    at = s
    run.push(pt)
  }
  flush()
  return out
}

function build(
  outline: Point2[],
  levels: Point2[][][],
  details: Point2[][],
  lines: Point2[][],
  tiers: number[] = [],
  sculpted = false,
): FigureStack {
  const tier = (i: number) => tiers[i] ?? 1
  const order = details.map((_, i) => i).sort((a, b) => tier(a) - tier(b))
  const placed: PlacedDetail[] = []
  // the topmost surface at a point, counting the depth levels and the given detail plates
  const top = (pt: Point2, among: number[]): Surface => {
    let s: Surface = { level: levelAt(levels, pt) }
    for (const i of among)
      if (placed[i] && placed[i].level + 1 > s.level && inside(details[i], pt)) s = { level: placed[i].level + 1, on: i }
    return s
  }
  const under = (i: number) => order.filter((j) => tier(j) < tier(i))
  for (const i of order) {
    const rim = [...walk([...details[i], details[i][0]]), centreOf(details[i])]
    const level = Math.max(...rim.map((pt) => top(pt, under(i)).level))
    const ground = Math.max(...rim.map((pt) => levelAt(levels, pt)))
    placed[i] = { item: details[i], level, rise: level - ground }
  }
  const all = order
  // each engraved stretch goes on whatever is uppermost there
  const engraving = lines.flatMap((line) => runs(line, (pt) => top(pt, all)))
  const scores = [
    ...engraving,
    // where the next level is glued: always wholly on the level below
    ...levels.flatMap((plates, k) => plates.map((pl) => ({ item: [...pl, pl[0]], level: k }))),
    // where a detail plate is glued: the part of its edge that rests on the
    // surface below — except where it runs along that surface's own cut
    // edge, which already shows where the plate goes
    ...order.flatMap((i) =>
      runs(
        [...details[i], details[i][0]],
        (pt) => {
          const s = top(pt, under(i))
          const rim =
            s.on !== undefined
              ? details[s.on]
              : s.level === 0
                ? outline
                : levels[s.level - 1].find((plate) => inside(plate, pt))
          return rim && edgeDistance(rim, pt) < FLUSH ? { level: -2 } : s
        },
        (s) => s.level === placed[i].level,
      ),
    ),
  ]
  return { outline, levels, details: placed, sculpted, engraving, scores }
}

/** The middle point of a scored run: says which plate it is on. */
export function runAnchor(run: Point2[]): Point2 {
  return run[Math.floor(run.length / 2)]
}

/** The stack of a silhouette figure (base plate at y ≥ 0, mount at x = 0). */
export function figureStack(c: CharacterSpec): FigureStack {
  const outline = characterOutline(c)
  const shapeId = c.shape ?? DEFAULT_FIGURE_SHAPE
  return memo(`fig|${shapeId}|${c.relief ?? 0}|${sig(outline)}`, () => {
    const levels = reliefLayers(outline, c.relief ?? 0)
    return build(
      outline,
      levels,
      figureLayers(shapeId, c.width, c.height),
      figureEngraving(shapeId, c.width, c.height),
      FIGURE_SHAPES[shapeId]?.layerTiers,
      FIGURE_SHAPES[shapeId]?.sculpted ?? false,
    )
  })
}

/** The stack on top of a flyer's body plate (in flyerBodyOutline's frame). */
export function flyerBodyStack(c: CharacterSpec): FigureStack {
  const outline = flyerBodyOutline(c)
  return memo(`fly|${c.shape}|${c.relief ?? 0}|${sig(outline)}`, () => {
    const levels = reliefLayers(outline, c.relief ?? 0, FLYER_RELIEF_FIRST)
    return build(outline, levels, [], flyerBodyEngraving(c))
  })
}

/** The printed dome that replaces a stack's stepped levels. */
export function stackDome(stack: FigureStack, c: CharacterSpec, sheet: number, first?: number): DomeSlice[] {
  return domeSlices(stack.outline, c.relief ?? 0, sheet, first)
}

/** Height of a printed dome above the face at a point (0 outside it). */
export function domeHeightAt(dome: DomeSlice[], pt: Point2): number {
  let h = 0
  for (const slice of dome) {
    if (!slice.outlines.some((o) => inside(o, pt))) break
    h = slice.to
  }
  return h
}

/** The plate of `level` (1-based) that lies under a point, if any. */
export function plateUnder(stack: FigureStack, level: number, pt: Point2): Point2[] | null {
  return stack.levels[level - 1]?.find((plate) => inside(plate, pt)) ?? null
}
