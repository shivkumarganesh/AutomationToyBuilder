import type { AutomatonSpec, CharacterSpec } from '../model/types'
import { camShaftY } from '../model/types'
import type { Point2 } from '../model/figures'
import { FLYER_SHAPES } from '../model/flyers'
import type { ChannelSignal } from '../kinematics/channels'
import { sampleDisplacement } from '../kinematics/follower'

/**
 * Shared geometry of a FLYER — a flat body on a fixed post with hinged
 * wing plates resting on pushrod tips. The scene, both exporters, the
 * basswood audit and the tests all read these functions, so the wing a
 * user sees is the wing the sheet cuts.
 *
 * Everything is DERIVED from the mechanism, never free:
 *  - the body centre is midway between the two inner rods;
 *  - each rod's lever arm is its horizontal distance from the hinge;
 *  - the hinge height is the inner rods' mid-travel tip height, so the
 *    wings sit level at mid-stroke;
 *  - a second wing plate hinges midway between its two rods.
 *
 * Hinges are tape/cloth hinges on the UNDERSIDE of the plates, so the
 * hinge axis lies in the underside plane and a rod tip touching the
 * underside at horizontal distance a sets the plate angle exactly:
 *     angle = atan2(tipHeight − hingeHeight, a)
 * Plates are spaced HINGE_GAP apart so their top edges clear when a
 * wing lifts; that gap sets the largest angle a hinge can fold.
 */

/** Gap between hinged plates, bridged by the hinge tape. */
export const HINGE_GAP = 2
/** Width (along the body) of the post plate and of its two tabs. */
export const FLYER_POST_WIDTH = 14
export const FLYER_TAB_WIDTH = 8
/** Follower pad height: rod tip = follower height + pad + rod length. */
const ROD_PAD = 4
/** Smallest lever arm that keeps a rod clear of the hinge and the body. */
export const MIN_ROD_ARM = 8
/** Smallest spacing between the two rods of a two-plate wing. */
export const MIN_ROD_SPACING = 12

type LiftSignal = Extract<ChannelSignal, { kind: 'lift' }>

export interface FlyerSide {
  /** −1 = left wing (towards −X), +1 = right wing. */
  sign: -1 | 1
  /** World X of the root hinge axis. */
  hingeX: number
  signals: LiftSignal[]
  /** Horizontal distance of each rod from the root hinge, inner → outer. */
  rods: number[]
  /** Distance from the root hinge to each plate's own hinge: [0] or [0, L1]. */
  hinges: number[]
  /** Distance from the root hinge to the wing tip. */
  span: number
}

export interface FlyerGeometry {
  /** World X of the body centreline / post. */
  xc: number
  /** World Y of the hinge axes = underside of the level plates. */
  axisY: number
  left: FlyerSide
  right: FlyerSide
}

/** Largest fold (radians) a taped hinge allows before the plate edges meet. */
export function hingeLimit(sheet: number): number {
  return Math.atan(HINGE_GAP / sheet)
}

function liftSignal(signals: ChannelSignal[], id: string): LiftSignal | null {
  const s = signals.find((x) => x.channel.id === id)
  return s && s.kind === 'lift' ? s : null
}

/** World Y of a pushrod's tip for a given follower height. */
function tipY(spec: AutomatonSpec, s: LiftSignal, follower: number): number {
  return camShaftY(spec.mechanism, s.channel.cam) + follower + ROD_PAD + s.channel.pushrod.length
}

function restTipY(spec: AutomatonSpec, s: LiftSignal): number {
  return tipY(spec, s, (s.table.min + s.table.max) / 2)
}

/** Resolve a flyer's geometry, or null if its channels are missing / not lift channels. */
export function flyerGeometry(
  spec: AutomatonSpec,
  c: CharacterSpec,
  signals: ChannelSignal[],
): FlyerGeometry | null {
  if (c.kind !== 'flyer' || !c.flyer) return null
  const L = c.flyer.left.map((id) => liftSignal(signals, id))
  const R = c.flyer.right.map((id) => liftSignal(signals, id))
  if (L.length === 0 || L.length !== R.length || [...L, ...R].some((s) => s === null)) return null
  const left = L as LiftSignal[]
  const right = R as LiftSignal[]
  const xc = (left[0].channel.x + right[0].channel.x) / 2
  const axisY = (restTipY(spec, left[0]) + restTipY(spec, right[0])) / 2
  const side = (sign: -1 | 1, sigs: LiftSignal[]): FlyerSide => {
    const hingeX = xc + sign * (c.width / 2 + HINGE_GAP / 2)
    const rods = sigs.map((s) => sign * (s.channel.x - hingeX))
    const hinges = rods.length > 1 ? [0, (rods[0] + rods[1]) / 2] : [0]
    return { sign, hingeX, signals: sigs, rods, hinges, span: rods[rods.length - 1] + c.height }
  }
  return { xc, axisY, left: side(-1, left), right: side(1, right) }
}

/**
 * Absolute angle (radians, + = tip up) of each plate of one wing at
 * crank angle theta. The second plate hangs from the first plate's
 * moving tip hinge and rests on its own rod.
 */
export function flyerAngles(
  spec: AutomatonSpec,
  geo: FlyerGeometry,
  side: FlyerSide,
  theta: number,
): number[] {
  const tips = side.signals.map((s) => tipY(spec, s, sampleDisplacement(s.table, theta)))
  const a1 = Math.atan2(tips[0] - geo.axisY, side.rods[0])
  if (side.rods.length < 2) return [a1]
  const L1 = side.hinges[1]
  const hx = L1 * Math.cos(a1)
  const hy = geo.axisY + L1 * Math.sin(a1)
  return [a1, Math.atan2(tips[1] - hy, side.rods[1] - hx)]
}

/** Extremes over a full crank turn, for validation. */
export function flyerSweep(spec: AutomatonSpec, geo: FlyerGeometry) {
  let maxRoot = 0
  let maxFold = 0
  for (const side of [geo.left, geo.right]) {
    for (let i = 0; i < 360; i += 2) {
      const a = flyerAngles(spec, geo, side, (i * Math.PI) / 180)
      maxRoot = Math.max(maxRoot, Math.abs(a[0]))
      if (a.length > 1) maxFold = Math.max(maxFold, Math.abs(a[1] - a[0]))
    }
  }
  return { maxRoot, maxFold }
}

/** Plain-language problems with a flyer's current mechanism, empty when buildable. */
export function flyerIssues(
  spec: AutomatonSpec,
  c: CharacterSpec,
  signals: ChannelSignal[],
): string[] {
  const geo = flyerGeometry(spec, c, signals)
  if (!geo) return ['Its wing rods are missing — each wing plate needs its own pushrod.']
  const issues: string[] = []
  for (const side of [geo.left, geo.right]) {
    const name = side.sign < 0 ? 'left' : 'right'
    if (side.rods[0] < MIN_ROD_ARM)
      issues.push(`The ${name} inner rod is too close to the body — move its cam outwards or narrow the body.`)
    if (side.rods.length > 1 && side.rods[1] - side.rods[0] < MIN_ROD_SPACING)
      issues.push(`The ${name} wing's two rods are too close together.`)
  }
  if (issues.length === 0) {
    const limit = hingeLimit(spec.frame.materialThickness)
    const sweep = flyerSweep(spec, geo)
    if (sweep.maxRoot > limit || sweep.maxFold > limit)
      issues.push('The wings fold further than the hinges allow — reduce the cam travel or move the rods outwards.')
  }
  return issues
}

/** Clip a polygon to the half-plane x ≥ c (keep = 1) or x ≤ c (keep = −1). */
function clipX(poly: Point2[], c: number, keep: 1 | -1): Point2[] {
  const inside = (p: Point2) => keep * (p.x - c) >= -1e-9
  const out: Point2[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const ia = inside(a)
    const ib = inside(b)
    if (ia) out.push(a)
    if (ia !== ib) {
      const t = (c - a.x) / (b.x - a.x)
      out.push({ x: c, y: a.y + (b.y - a.y) * t })
    }
  }
  // drop coincident neighbours
  return out.filter((p, i) => {
    const q = out[(i + 1) % out.length]
    return Math.hypot(p.x - q.x, p.y - q.y) > 1e-6
  })
}

/** Body outline in mm: x across (centred), y along the body from the wing-root middle. */
export function flyerBodyOutline(c: CharacterSpec): Point2[] {
  const shape = FLYER_SHAPES[c.shape ?? '']
  if (!shape) throw new Error(`unknown flyer shape ${c.shape}`)
  const mid = flyerRootMid(c)
  return shape.body.map((p) => ({ x: p.x * c.width, y: p.y * c.depth - mid }))
}

/** Distance along the body (from its tail) of the middle of the wing root = the post. */
function flyerRootMid(c: CharacterSpec): number {
  const shape = FLYER_SHAPES[c.shape ?? '']
  const chord = shape.chord * c.depth
  return shape.wingY0 * c.depth + ((shape.root[0] + shape.root[1]) / 2) * chord
}

/**
 * Outline of one wing plate in mm, in the wing's own frame: x out from
 * the root hinge axis (always +, mirror for the left wing), y along the
 * body from the wing-root middle. Plates stop HINGE_GAP/2 short of each
 * hinge so neighbours never touch.
 */
export function flyerWingPlate(c: CharacterSpec, side: FlyerSide, index: number): Point2[] {
  const shape = FLYER_SHAPES[c.shape ?? '']
  if (!shape) throw new Error(`unknown flyer shape ${c.shape}`)
  const chord = shape.chord * c.depth
  const mid = flyerRootMid(c)
  const whole = shape.wing.map((p) => ({
    x: p.x * side.span,
    y: shape.wingY0 * c.depth + p.y * chord - mid,
  }))
  const from = side.hinges[index] + HINGE_GAP / 2
  const to = index + 1 < side.hinges.length ? side.hinges[index + 1] - HINGE_GAP / 2 : Infinity
  let plate = clipX(whole, from, 1)
  if (Number.isFinite(to)) plate = clipX(plate, to, -1)
  return plate
}

/** Diameter of the stitch holes a wire-loop hinge passes through. */
export const STITCH_HOLE = 1.2
/** How far a stitch hole sits in from the hinged edge (leaves 2 mm+ of wood). */
export const STITCH_INSET = 3

export interface HingeLine {
  /** Distance of the hinge axis from the root hinge (0 = body-to-wing). */
  at: number
  /** Extent of the hinged edges along the body, in the plate frame. */
  from: number
  to: number
  /** Where along the body the stitch holes sit (one or two per hinge). */
  stitches: number[]
}

/**
 * Every hinge of one wing: where it is, how long it is, and where its
 * stitch holes go. Both ways of making a hinge read this — tape is
 * stuck along [from, to]; a wire or thread loop passes through the pair
 * of holes facing each other across the gap at each stitch position.
 */
export function flyerHingeLines(c: CharacterSpec, side: FlyerSide): HingeLine[] {
  return side.hinges.map((at, i) => {
    const plate = flyerWingPlate(c, side, i)
    const minX = Math.min(...plate.map((p) => p.x))
    const edge = plate.filter((p) => p.x - minX < 1e-6)
    let from = Math.min(...edge.map((p) => p.y))
    let to = Math.max(...edge.map((p) => p.y))
    if (i > 0) {
      // the inner plate's outer edge may be shorter: hinge only where both exist
      const inner = flyerWingPlate(c, side, i - 1)
      const maxX = Math.max(...inner.map((p) => p.x))
      const innerEdge = inner.filter((p) => maxX - p.x < 1e-6)
      from = Math.max(from, Math.min(...innerEdge.map((p) => p.y)))
      to = Math.min(to, Math.max(...innerEdge.map((p) => p.y)))
    }
    const len = to - from
    const stitches = len >= 14 ? [from + len * 0.25, from + len * 0.75] : [from + len / 2]
    return { at, from, to, stitches }
  })
}

/**
 * Stitch-hole centres on one wing plate, in flyerWingPlate's frame: a
 * row just inside its inner hinged edge and, if another plate hangs
 * from it, a row just inside its outer edge.
 */
export function flyerWingStitches(c: CharacterSpec, side: FlyerSide, index: number): Point2[] {
  const lines = flyerHingeLines(c, side)
  const out: Point2[] = []
  for (const y of lines[index].stitches)
    out.push({ x: lines[index].at + HINGE_GAP / 2 + STITCH_INSET, y })
  if (index + 1 < lines.length)
    for (const y of lines[index + 1].stitches)
      out.push({ x: lines[index + 1].at - HINGE_GAP / 2 - STITCH_INSET, y })
  return out
}

/** Stitch-hole centres on the body, in flyerBodyOutline's frame (both sides). */
export function flyerBodyStitches(c: CharacterSpec, geo: FlyerGeometry): Point2[] {
  const out: Point2[] = []
  for (const side of [geo.left, geo.right]) {
    const root = flyerHingeLines(c, side)[0]
    for (const y of root.stitches) out.push({ x: side.sign * (c.width / 2 - STITCH_INSET), y })
  }
  return out
}

/** Keep the parts of a polyline with from ≤ x ≤ to, as separate runs. */
function clipLineX(line: Point2[], from: number, to: number): Point2[][] {
  const runs: Point2[][] = []
  let run: Point2[] = []
  const inside = (p: Point2) => p.x >= from && p.x <= to
  const cross = (a: Point2, b: Point2, x: number): Point2 => ({
    x,
    y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x),
  })
  for (let i = 0; i + 1 < line.length; i++) {
    let a = line[i]
    let b = line[i + 1]
    if ((a.x < from && b.x < from) || (a.x > to && b.x > to)) {
      if (run.length > 1) runs.push(run)
      run = []
      continue
    }
    if (!inside(a)) a = cross(a, b, a.x < from ? from : to)
    const bIn = inside(b)
    if (!bIn) b = cross(line[i], b, b.x < from ? from : to)
    if (run.length === 0) run.push(a)
    run.push(b)
    if (!bIn) {
      if (run.length > 1) runs.push(run)
      run = []
    }
  }
  if (run.length > 1) runs.push(run)
  return runs
}

/** Engraved lines on the body's top face, in flyerBodyOutline's frame. */
export function flyerBodyEngraving(c: CharacterSpec): Point2[][] {
  const shape = FLYER_SHAPES[c.shape ?? '']
  if (!shape) return []
  const mid = flyerRootMid(c)
  return (shape.bodyEngrave ?? []).map((line) =>
    line.map((p) => ({ x: p.x * c.width, y: p.y * c.depth - mid })),
  )
}

/** Engraved ribs on one wing plate, clipped to it, in flyerWingPlate's frame. */
export function flyerWingEngraving(c: CharacterSpec, side: FlyerSide, index: number): Point2[][] {
  const shape = FLYER_SHAPES[c.shape ?? '']
  if (!shape) return []
  const chord = shape.chord * c.depth
  const mid = flyerRootMid(c)
  const from = side.hinges[index] + HINGE_GAP / 2 + 1
  const to =
    index + 1 < side.hinges.length ? side.hinges[index + 1] - HINGE_GAP / 2 - 1 : Infinity
  return (shape.wingEngrave ?? []).flatMap((line) =>
    clipLineX(
      line.map((p) => ({ x: p.x * side.span, y: shape.wingY0 * c.depth + p.y * chord - mid })),
      from,
      to,
    ),
  )
}

/**
 * The post plate, standing: a shouldered strip with a tab at each end —
 * the bottom tab drops through the stage, the top tab through the body.
 * x across the plate, y up from the stage top.
 */
export function flyerPostOutline(postHeight: number, sheet: number): Point2[] {
  const w = FLYER_POST_WIDTH / 2
  const tab = FLYER_TAB_WIDTH / 2
  return [
    { x: -tab, y: -sheet },
    { x: tab, y: -sheet },
    { x: tab, y: 0 },
    { x: w, y: 0 },
    { x: w, y: postHeight },
    { x: tab, y: postHeight },
    { x: tab, y: postHeight + sheet },
    { x: -tab, y: postHeight + sheet },
    { x: -tab, y: postHeight },
    { x: -w, y: postHeight },
    { x: -w, y: 0 },
    { x: -tab, y: 0 },
  ]
}

/** Height of the post between the stage top and the underside of the body. */
export function flyerPostHeight(spec: AutomatonSpec, geo: FlyerGeometry): number {
  return geo.axisY - (spec.frame.height + spec.frame.materialThickness)
}
