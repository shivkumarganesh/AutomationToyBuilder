import type { CharacterSpec } from '../model/types'
import { characterOutline, DEFAULT_FIGURE_SHAPE, figureEngraving, figureLayers, type Point2 } from '../model/figures'
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
}

export interface FigureStack {
  /** The figure's own plate, mm. */
  outline: Point2[]
  /** Depth levels, lowest first; each level is one or more plates. */
  levels: Point2[][][]
  /** Hand-made detail plates, each on the highest level it touches. */
  details: Placed<Point2[]>[]
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

/** Cut a polyline where it crosses a step: one run per stretch on a single level. */
function runs(levels: Point2[][][], line: Point2[], keep: (level: number) => boolean = () => true): Placed<Point2[]>[] {
  const out: Placed<Point2[]>[] = []
  let run: Point2[] = []
  let at = -1
  const flush = () => {
    if (run.length >= 2 && keep(at)) out.push({ item: run, level: at })
    run = []
  }
  for (const pt of walk(line)) {
    const level = levelAt(levels, pt)
    if (level !== at) flush()
    at = level
    run.push(pt)
  }
  flush()
  return out
}

function build(outline: Point2[], levels: Point2[][][], details: Point2[][], lines: Point2[][]): FigureStack {
  const placed = details.map((item) => ({
    item,
    level: Math.max(...walk([...item, item[0]]).map((pt) => levelAt(levels, pt)), levelAt(levels, centreOf(item))),
  }))
  // a line under a detail plate is hidden by it: it is not engraved
  const engraving = lines.flatMap((line) => runs(levels, line))
  const scores = [
    ...engraving,
    // where the next level is glued: always wholly on the level below
    ...levels.flatMap((plates, k) => plates.map((pl) => ({ item: [...pl, pl[0]], level: k }))),
    // where a detail plate is glued: only the part of its edge that is on its level
    ...placed.flatMap((d) => runs(levels, [...d.item, d.item[0]], (level) => level === d.level)),
  ]
  return { outline, levels, details: placed, engraving, scores }
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
    return build(outline, levels, figureLayers(shapeId, c.width, c.height), figureEngraving(shapeId, c.width, c.height))
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
