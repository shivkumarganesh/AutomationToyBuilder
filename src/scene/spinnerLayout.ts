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
