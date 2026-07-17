import type { DisplacementTable } from '../kinematics/follower'

/**
 * Geometry of the rocker linkage, shared by the 3D scene and its tests.
 *
 * The beam is a horizontal lever: fulcrum post at one end, follower pad at
 * the other, resting on the cam. The pivot height is chosen so the pad
 * face touches the cam surface at the follower's mid-travel when the beam
 * is level; as the beam rocks, the pad end tracks the cam surface (the
 * sine-vs-linear error stays well under a millimetre for real lever
 * proportions).
 */

export const BEAM_THICKNESS = 4
export const PAD_THICKNESS = 3

/** Vertical distance from the beam's centreline down to the pad's contact face. */
export const PIVOT_TO_PAD_FACE = BEAM_THICKNESS / 2 + PAD_THICKNESS

/** Height of the beam's pivot axis above the ground plane. */
export function rockerPivotY(liftTable: DisplacementTable, shaftHeight: number): number {
  const mid = (liftTable.min + liftTable.max) / 2
  return shaftHeight + mid + PIVOT_TO_PAD_FACE
}

/** Beam rock angle (radians) that keeps the pad on the cam surface. */
export function rockerAngle(
  liftTable: DisplacementTable,
  leverLength: number,
  displacement: number,
): number {
  const mid = (liftTable.min + liftTable.max) / 2
  return Math.atan2(displacement - mid, leverLength)
}

/** World Y of the pad's contact face at a given rock angle. */
export function padFaceY(
  liftTable: DisplacementTable,
  shaftHeight: number,
  leverLength: number,
  angle: number,
): number {
  return rockerPivotY(liftTable, shaftHeight) + Math.sin(angle) * leverLength - PIVOT_TO_PAD_FACE
}
