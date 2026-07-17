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
