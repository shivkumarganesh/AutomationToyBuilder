import type { FrameSpec, PropSpec } from '../model/types'
import type { Point2 } from '../model/figures'
import { propOutline } from '../model/props'

/**
 * Shared scenery geometry — the 3D scene, the laser flat-pack and the
 * STL kit all place and shape props from these functions, so a prop's
 * tabs always land in the slots the stage is cut with.
 *
 * A prop is a plate of the SAME sheet thickness as the box, standing in
 * a row parallel to the camshaft: 'front' (towards the viewer, +Z) or
 * 'back'. Rows sit PROP_ROW_INSET inside the front/back walls, clear of
 * the wall-tab slots along the stage edge and of the channel openings
 * on the stage centreline.
 */

/** Row centreline distance inside the inner face of the front/back wall. */
export const PROP_ROW_INSET = 6
/** Tab width for wide props (narrow bases use the whole base as the tab). */
export const PROP_TAB_WIDTH = 8
/** Bases at most this wide become a single full-width tab (trunks, posts). */
const NARROW_BASE = 12

/** World Z of a prop row's plate centreline. */
export function propRowZ(frame: FrameSpec, row: PropSpec['row']): number {
  const z = frame.depth / 2 - frame.materialThickness - PROP_ROW_INSET
  return row === 'front' ? z : -z
}

/** World X of a prop's centre. */
export function propWorldX(frame: FrameSpec, prop: PropSpec): number {
  return -frame.width / 2 + prop.position * frame.width
}

/** Extent of the flat base (y = 0 run) of a prop outline, in mm about its centre. */
export function propBase(prop: PropSpec): { minX: number; maxX: number } {
  const base = propOutline(prop.shape, prop.width, prop.height).filter((p) => p.y < 1e-6)
  if (base.length < 2) throw new Error(`prop shape ${prop.shape} has no flat base`)
  return { minX: Math.min(...base.map((p) => p.x)), maxX: Math.max(...base.map((p) => p.x)) }
}

/** Mounting tabs along the base: centre offset from the prop centre + width (mm). */
export function propTabs(prop: PropSpec): { cx: number; width: number }[] {
  const { minX, maxX } = propBase(prop)
  const baseWidth = maxX - minX
  const mid = (minX + maxX) / 2
  if (baseWidth <= NARROW_BASE) return [{ cx: mid, width: baseWidth }]
  if (baseWidth < 40) return [{ cx: mid, width: PROP_TAB_WIDTH }]
  return [
    { cx: mid - baseWidth / 4, width: PROP_TAB_WIDTH },
    { cx: mid + baseWidth / 4, width: PROP_TAB_WIDTH },
  ]
}

/**
 * The cut/print outline: the library shape with its tabs hanging
 * `tabDepth` (one sheet thickness) below the base line y = 0.
 */
export function propPlateOutline(prop: PropSpec, tabDepth: number): Point2[] {
  const pts = propOutline(prop.shape, prop.width, prop.height)
  const isBase = (p: Point2) => p.y < 1e-6
  const n = pts.length
  // the base run is contiguous (cyclically) and travels +x on a CCW outline
  let start = -1
  for (let i = 0; i < n; i++) {
    if (isBase(pts[i]) && !isBase(pts[(i - 1 + n) % n])) start = i
  }
  if (start < 0) throw new Error(`prop shape ${prop.shape} has no flat base`)
  const upper: Point2[] = []
  for (let k = 0; k < n; k++) {
    const p = pts[(start + k) % n]
    if (!isBase(p)) upper.push(p)
  }
  const { minX, maxX } = propBase(prop)
  const base: Point2[] = [{ x: minX, y: 0 }]
  for (const tab of propTabs(prop)) {
    const a = tab.cx - tab.width / 2
    const b = tab.cx + tab.width / 2
    base.push({ x: a, y: 0 }, { x: a, y: -tabDepth }, { x: b, y: -tabDepth }, { x: b, y: 0 })
  }
  base.push({ x: maxX, y: 0 })
  // drop coincident neighbours (a full-width tab shares the base corners)
  const out: Point2[] = []
  for (const p of [...base, ...upper]) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-6) out.push(p)
  }
  return out
}

/** Stage slot footprints (world X/Z centres + nominal size) for one prop. */
export function propStageSlots(
  frame: FrameSpec,
  prop: PropSpec,
): { x: number; z: number; width: number; depth: number }[] {
  const x0 = propWorldX(frame, prop)
  const z = propRowZ(frame, prop.row)
  return propTabs(prop).map((tab) => ({
    x: x0 + tab.cx,
    z,
    width: tab.width,
    depth: frame.materialThickness,
  }))
}

/** Does the prop (and its tabs) stay on the stage plate between the side walls? */
export function propFitsStage(frame: FrameSpec, prop: PropSpec): boolean {
  const x0 = propWorldX(frame, prop)
  const limit = frame.width / 2 - frame.materialThickness - 1
  return propStageSlots(frame, prop).every(
    (s) => s.x - s.width / 2 >= -limit && s.x + s.width / 2 <= limit,
  ) && Math.abs(x0) <= frame.width / 2
}
