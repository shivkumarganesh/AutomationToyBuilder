import type { LinkageSpec } from '../model/types'

/**
 * Crank-rocker four-bar position analysis.
 *
 * Local plane coordinates (u along world Z, v vertical), origin at the
 * shaft axis:
 *
 *   A  = crank pin      = r2 · (cos α, sin α),  α = crank angle + phase
 *   O4 = rocker pivot   = (g, 0)
 *   B  = rocker pin     = the circle-circle intersection of (A, r3) and
 *        (O4, r4) — the upper branch, chosen once and kept, so the
 *        mechanism never snaps between assembly modes
 *   P  = coupler point  = A + (r3 + ext) · (A→B unit)
 *   mount = P + wandLen · (direction that is vertical at the MEAN coupler
 *        angle) — the wand is welded to the coupler, so the figure both
 *        rides the coupler curve and pitches with it.
 *
 * Everything downstream (scene, chart, exports, characters) reads the
 * precomputed PathTable — one math path.
 */

const TWO_PI = Math.PI * 2

/** True when the linkage is a Grashof crank-rocker with running margin. */
export function grashofOk(l: LinkageSpec): boolean {
  const { crankRadius: r2, couplerLen: r3, rockerLen: r4, groundLen: g } = l
  const links = [r2, r3, r4, g]
  if (r2 !== Math.min(...links)) return false
  const longest = Math.max(...links)
  const rest = r3 + r4 + g - longest
  // strict margin keeps the mechanism away from the change-point singularity
  return r2 + longest <= rest - 1
}

export interface PathTable {
  /** mount u (world Z offset from the shaft axis) per step. */
  u: number[]
  /** mount v (height above the shaft axis) per step. */
  v: number[]
  /** coupler pitch about its mean, degrees, per step. */
  pitchDeg: number[]
  uMin: number
  uMax: number
  vMin: number
  vMax: number
  /** false when the requested lengths cannot assemble at every crank angle. */
  valid: boolean
}

interface Pose {
  a: { u: number; v: number }
  b: { u: number; v: number }
  p: { u: number; v: number }
  phi: number
  clamped: boolean
}

function solvePose(l: LinkageSpec, alpha: number): Pose {
  const { crankRadius: r2, couplerLen: r3, rockerLen: r4, groundLen: g } = l
  const a = { u: r2 * Math.cos(alpha), v: r2 * Math.sin(alpha) }
  const du = g - a.u
  const dv = -a.v
  const dist = Math.hypot(du, dv)
  // circle-circle intersection; clamp instead of exploding when the user
  // drags the sliders through a non-assemblable configuration
  const along = (r3 * r3 - r4 * r4 + dist * dist) / (2 * dist)
  const hSq = r3 * r3 - along * along
  const clamped = hSq < 0
  const h = Math.sqrt(Math.max(hSq, 0))
  const ux = du / dist
  const uy = dv / dist
  // upper branch: rotate the A→O4 direction +90° for the perpendicular
  const b = {
    u: a.u + along * ux - h * uy,
    v: a.v + along * uy + h * ux,
  }
  const phi = Math.atan2(b.v - a.v, b.u - a.u)
  const reach = r3 + l.couplerExt
  const p = { u: a.u + reach * Math.cos(phi), v: a.v + reach * Math.sin(phi) }
  return { a, b, p, phi, clamped }
}

/** Mean coupler angle over a revolution (circular mean — safe near ±π). */
export function meanCouplerAngle(l: LinkageSpec, steps = 180): number {
  let su = 0
  let sv = 0
  for (let i = 0; i < steps; i++) {
    const { phi } = solvePose(l, (i / steps) * TWO_PI)
    su += Math.cos(phi)
    sv += Math.sin(phi)
  }
  return Math.atan2(sv, su)
}

/** Full linkage state at one crank angle — the scene draws bars from this. */
export interface LinkagePose {
  /** crank pin A, plane coords about the shaft axis. */
  a: { u: number; v: number }
  /** rocker pin B. */
  b: { u: number; v: number }
  /** coupler point P (wand root). */
  p: { u: number; v: number }
  /** figure mount (wand tip). */
  mount: { u: number; v: number }
  /** coupler angle, radians. */
  phi: number
  /** pitch about the mean coupler angle, radians. */
  pitch: number
}

export function linkagePose(l: LinkageSpec, theta: number, phiMean: number): LinkagePose {
  const alpha = theta + (l.phaseDeg * Math.PI) / 180
  const pose = solvePose(l, alpha)
  const pitch = pose.phi - phiMean
  // wand direction: vertical at the mean coupler angle, welded to the coupler
  const wandAngle = Math.PI / 2 + pitch
  const mount = {
    u: pose.p.u + l.wandLen * Math.cos(wandAngle),
    v: pose.p.v + l.wandLen * Math.sin(wandAngle),
  }
  return { a: pose.a, b: pose.b, p: pose.p, mount, phi: pose.phi, pitch }
}

/** Precomputed mount trajectory + pitch for one crank revolution. */
export function pathTable(l: LinkageSpec, steps = 360): PathTable {
  const phiMean = meanCouplerAngle(l)
  const u: number[] = new Array(steps)
  const v: number[] = new Array(steps)
  const pitchDeg: number[] = new Array(steps)
  let uMin = Infinity
  let uMax = -Infinity
  let vMin = Infinity
  let vMax = -Infinity
  let valid = grashofOk(l)
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * TWO_PI
    const alpha = theta + (l.phaseDeg * Math.PI) / 180
    if (solvePose(l, alpha).clamped) valid = false
    const pose = linkagePose(l, theta, phiMean)
    u[i] = pose.mount.u
    v[i] = pose.mount.v
    pitchDeg[i] = (pose.pitch * 180) / Math.PI
    uMin = Math.min(uMin, u[i])
    uMax = Math.max(uMax, u[i])
    vMin = Math.min(vMin, v[i])
    vMax = Math.max(vMax, v[i])
  }
  return { u, v, pitchDeg, uMin, uMax, vMin, vMax, valid }
}

/**
 * Range of u (depth) positions where the wand pierces a horizontal plane
 * at `planeV` above the shaft axis — this DERIVES the stage guide slot:
 * the slot must span exactly the wand's travel at stage level.
 */
export function wandPlaneCrossing(
  l: LinkageSpec,
  planeV: number,
  steps = 180,
): { min: number; max: number } {
  const phiMean = meanCouplerAngle(l)
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < steps; i++) {
    const pose = linkagePose(l, (i / steps) * TWO_PI, phiMean)
    const { p, mount } = pose
    if (mount.v === p.v) continue
    const t = (planeV - p.v) / (mount.v - p.v)
    if (t < 0 || t > 1) continue
    const u = p.u + t * (mount.u - p.u)
    min = Math.min(min, u)
    max = Math.max(max, u)
  }
  return { min, max }
}

/** Pin diameter for the linkage's revolute joints (A, B, O4). */
export const LINK_PIN_DIAMETER = 3
/** Half-width of the coupler/rocker bars in the cut parts. */
const BAR_HALF = 4
/** Half-width of the wand arm in the cut parts. */
const WAND_HALF = 2.5

/**
 * Flat coupler part: the bar from the crank pin (hole at 0) through the
 * rocker pin (hole at couplerLen) to the coupler point, PLUS the wand
 * arm — one rigid L-shaped piece. The arm leaves the coupler point at
 * the DERIVED angle (π/2 − mean coupler angle), so the assembled wand
 * stands vertical at mid-swing exactly as simulated. Local X runs along
 * the coupler; holes belong at (0,0) and (couplerLen, 0).
 */
export function couplerPlateOutline(l: LinkageSpec): { x: number; y: number }[] {
  const reach = l.couplerLen + l.couplerExt
  const x0 = -(BAR_HALF + 1)
  const x1 = reach + BAR_HALF + 1
  // arm angle from the bar axis, clamped away from grazing the bar
  const beta = Math.min(
    Math.max(Math.PI / 2 - meanCouplerAngle(l), 0.35),
    Math.PI - 0.35,
  )
  const cb = Math.cos(beta)
  const sb = Math.sin(beta)
  const L = l.wandLen
  // arm edges (right = clockwise side), from the coupler point (reach, 0)
  const baseRx = reach + WAND_HALF * sb
  const baseRy = -WAND_HALF * cb
  const baseLx = reach - WAND_HALF * sb
  const baseLy = WAND_HALF * cb
  const sR = (BAR_HALF - baseRy) / sb
  const sL = (BAR_HALF - baseLy) / sb
  return [
    { x: x0, y: -BAR_HALF },
    { x: x1, y: -BAR_HALF },
    { x: x1, y: BAR_HALF },
    { x: baseRx + sR * cb, y: BAR_HALF },
    { x: baseRx + L * cb, y: baseRy + L * sb },
    { x: baseLx + L * cb, y: baseLy + L * sb },
    { x: baseLx + sL * cb, y: BAR_HALF },
    { x: x0, y: BAR_HALF },
  ]
}

/** Interpolated mount position + pitch at crank angle theta (radians). */
export function samplePath(
  table: PathTable,
  theta: number,
): { u: number; v: number; pitchDeg: number } {
  const n = table.u.length
  const t = (((theta % TWO_PI) + TWO_PI) % TWO_PI) / TWO_PI
  const f = t * n
  const i = Math.floor(f) % n
  const j = (i + 1) % n
  const frac = f - Math.floor(f)
  const lerp = (arr: number[]) => arr[i] * (1 - frac) + arr[j] * frac
  return { u: lerp(table.u), v: lerp(table.v), pitchDeg: lerp(table.pitchDeg) }
}
