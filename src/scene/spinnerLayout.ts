import type { SpinnerSpec } from '../model/types'

/**
 * Geometry of the friction drive, shared by the 3D scene, the exports,
 * and their tests.
 *
 * The drive wheel's rim meets the horizontal driven disc at a contact
 * point that must sit OFF the spindle axis — at the axis the rim velocity
 * produces zero torque and nothing turns. The contact radius is what sets
 * the transmission:
 *
 *    ω_out = ω_in · (wheelRadius / contactRadius)
 *
 * so the contact offset is derived from the requested ratio, and the
 * drive wheel is shifted along the camshaft by that amount relative to
 * the spindle axis. Faster ratios contact closer to the axis (never at
 * it), slower ratios closer to the disc rim.
 */

export const WHEEL_THICKNESS = 8
export const DISC_THICKNESS = 4
export const SPINDLE_RADIUS = 3

/** Distance along the shaft from the spindle axis to the wheel's contact plane. */
export function contactOffset(spinner: SpinnerSpec): number {
  return spinner.wheelRadius / spinner.ratio
}

/** Driven disc must reach past the contact point with a gripping margin. */
export function drivenDiscRadius(spinner: SpinnerSpec): number {
  return Math.abs(contactOffset(spinner)) + 4
}

/* ------------------------------------------------------------------ *
 * Bevel (crown + pinion) drive — every dimension derived from teeth:
 *   crown pitch radius Rc = module · crownTeeth / 2   (on the camshaft)
 *   pinion pitch radius Rp = module · pinionTeeth / 2 (on the spindle)
 *   mesh point: one Rc above the camshaft, one Rp from the crown plane —
 *   so the spindle axis is offset from the crown plane by exactly Rp,
 *   and pitch-line speeds match: ω_spindle · Rp = ω_crank · Rc.
 * ------------------------------------------------------------------ */

export const CROWN_TOOTH_LENGTH = 5
export const CROWN_DISC_THICKNESS = 4
export const PINION_THICKNESS = 5

function bevel(spinner: SpinnerSpec) {
  if (spinner.drive !== 'bevel' || !spinner.crownTeeth || !spinner.pinionTeeth || !spinner.module)
    throw new Error(`spinner ${spinner.id} is not a fully-specified bevel drive`)
  return { crownTeeth: spinner.crownTeeth, pinionTeeth: spinner.pinionTeeth, module: spinner.module }
}

export function crownPitchRadius(spinner: SpinnerSpec): number {
  const b = bevel(spinner)
  return (b.module * b.crownTeeth) / 2
}

export function pinionPitchRadius(spinner: SpinnerSpec): number {
  const b = bevel(spinner)
  return (b.module * b.pinionTeeth) / 2
}

/**
 * X distance from the spindle axis back to the crown gear's CENTRE plane.
 * The engagement happens in the crown's tooth ring (disc face + tooth
 * length), so the centre plane sits far enough back that the pinion's
 * pitch circle passes through the middle of that ring, while the ring's
 * near edge still clears the pinion's root circle.
 */
export function crownPlaneOffset(spinner: SpinnerSpec): number {
  return pinionPitchRadius(spinner) + CROWN_DISC_THICKNESS / 2 + CROWN_TOOTH_LENGTH / 2 + 1
}

/**
 * The crown's tooth ring along the shaft, relative to the spindle axis
 * (negative X = toward the crown). Tests assert the pinion's teeth reach
 * into this zone and its root circle stays out of it.
 */
export function crownToothZone(spinner: SpinnerSpec): { near: number; far: number } {
  const c = crownPlaneOffset(spinner)
  return {
    far: -c + CROWN_DISC_THICKNESS / 2,
    near: -c + CROWN_DISC_THICKNESS / 2 + CROWN_TOOTH_LENGTH,
  }
}

/** Height of the mesh point (and pinion mid-plane) above the ground. */
export function bevelMeshY(spinner: SpinnerSpec, shaftHeight: number): number {
  return shaftHeight + crownPitchRadius(spinner)
}

/**
 * Tooth-schedule alignment at the mesh point, pitch-normalised (0 = a
 * crown tooth / pinion gap is exactly at the mesh point). A crown tooth
 * arrives every 2π/crownTeeth of crank; a pinion gap every
 * (2π/pinionTeeth)/ratio — the same interval, so with the pinion baked
 * half a pitch back the two schedules stay locked at every crank angle.
 */
export function bevelAlignment(spinner: SpinnerSpec, theta: number): { crown: number; pinion: number } {
  const b = bevel(spinner)
  const pc = (2 * Math.PI) / b.crownTeeth
  const pp = (2 * Math.PI) / b.pinionTeeth
  const ratio = b.crownTeeth / b.pinionTeeth
  const crown = frac(theta / pc)
  const pinion = frac((ratio * theta) / pp)
  return { crown, pinion }
}

function frac(v: number): number {
  const m = v - Math.floor(v)
  return Math.min(m, 1 - m)
}

/* ------------------------------------------------------------------ *
 * Geneva (pin indexer) drive — intermittent stepping, every dimension
 * derived from the pin circle radius R (= wheelRadius) and the station
 * count N:
 *   engagement depth p: the pin protrudes p above the star wheel plane
 *     at the top of its arc, so the wheel plane sits at shaft + R − p
 *   chord half-length c = sqrt(R² − (R − p)²): the pin's path across the
 *     wheel plane
 *   spindle offset e = c / tan(π/N): places the spindle axis so the pin's
 *     sweep through a radial slot turns the wheel EXACTLY one station
 *     (2·atan(c/e) = 2π/N) per crank revolution — off-axis by
 *     construction, so torque always transfers
 * Between engagements a detent holds the wheel parked (dwell).
 * ------------------------------------------------------------------ */

export const GENEVA_ENGAGE_DEPTH = 4
export const GENEVA_WHEEL_THICKNESS = 4
export const GENEVA_PIN_RADIUS = 2

/** Half-length of the pin's chord across the star wheel plane. */
export function genevaChord(spinner: SpinnerSpec): number {
  const R = spinner.wheelRadius
  const p = GENEVA_ENGAGE_DEPTH
  return Math.sqrt(Math.max(R * R - (R - p) * (R - p), 0))
}

/** X distance from the spindle axis back to the driver pin plane. */
export function genevaOffset(spinner: SpinnerSpec): number {
  if (!spinner.stations) throw new Error(`geneva spinner ${spinner.id} is missing stations`)
  return genevaChord(spinner) / Math.tan(Math.PI / spinner.stations)
}

/** Star wheel outer radius: covers the pin's furthest reach plus rim. */
export function genevaWheelRadius(spinner: SpinnerSpec): number {
  const c = genevaChord(spinner)
  const e = genevaOffset(spinner)
  return Math.hypot(c, e) + 5
}

/** Height of the star wheel's mid-plane above the ground. */
export function genevaWheelY(spinner: SpinnerSpec, shaftHeight: number): number {
  return shaftHeight + spinner.wheelRadius - GENEVA_ENGAGE_DEPTH
}

/**
 * Spindle rotation (radians, accumulating) at crank angle theta.
 * Dwell — engagement sweep (atan profile) — dwell, advancing exactly
 * 2π/N per crank revolution. The engagement window is where the pin's
 * tip rides above the wheel plane.
 */
export function genevaAngle(spinner: SpinnerSpec, theta: number): number {
  const N = spinner.stations!
  const R = spinner.wheelRadius
  const p = GENEVA_ENGAGE_DEPTH
  const e = genevaOffset(spinner)
  const station = (2 * Math.PI) / N
  const psi1 = Math.asin((R - p) / R) // window entry (pin rising through plane)
  const psi2 = Math.PI - psi1 // window exit

  const revs = Math.floor(theta / (2 * Math.PI))
  const psi = theta - revs * 2 * Math.PI
  let within: number
  if (psi < psi1) within = 0
  else if (psi > psi2) within = station
  else within = Math.PI / N - Math.atan((R * Math.cos(psi)) / e)
  return revs * station + within
}

/** Width of the star wheel's radial slots — pin diameter plus sliding slack. */
export function genevaSlotWidth(): number {
  return 2 * GENEVA_PIN_RADIUS + 1.5
}

/**
 * Star wheel polygon: a disc with N radial slots open at the rim, slot 0
 * centred toward the driver (−X) rotated half a station, matching the
 * rest position genevaAngle produces. Shared by the 3D extrusion and the
 * laser export.
 */
export function genevaWheelOutline(
  spinner: SpinnerSpec,
): { x: number; y: number }[] {
  const N = spinner.stations!
  const Rg = genevaWheelRadius(spinner)
  const w = genevaSlotWidth()
  const rIn = Math.max(genevaOffset(spinner) - 4, 5)
  const delta = Math.asin(w / 2 / Rg)
  const lRim = Math.sqrt(Rg * Rg - (w / 2) * (w / 2))
  const pts: { x: number; y: number }[] = []
  const base = Math.PI + Math.PI / N // slot 0 aims at the pin's entry side
  for (let k = 0; k < N; k++) {
    const g = base + (k * 2 * Math.PI) / N
    const u = { x: Math.cos(g), y: Math.sin(g) }
    const v = { x: -Math.sin(g), y: Math.cos(g) }
    // slot walked CCW: outer right → inner right → inner left → outer left
    pts.push({ x: u.x * lRim - (v.x * w) / 2, y: u.y * lRim - (v.y * w) / 2 })
    pts.push({ x: u.x * rIn - (v.x * w) / 2, y: u.y * rIn - (v.y * w) / 2 })
    pts.push({ x: u.x * rIn + (v.x * w) / 2, y: u.y * rIn + (v.y * w) / 2 })
    pts.push({ x: u.x * lRim + (v.x * w) / 2, y: u.y * lRim + (v.y * w) / 2 })
    // rim arc to the next slot
    const gNext = g + (2 * Math.PI) / N
    const a0 = g + delta
    const a1 = gNext - delta
    for (let i = 1; i <= 10; i++) {
      const a = a0 + ((a1 - a0) * i) / 10
      pts.push({ x: Rg * Math.cos(a), y: Rg * Math.sin(a) })
    }
  }
  return pts
}
