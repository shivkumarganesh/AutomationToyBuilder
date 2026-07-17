import type { GearTrainSpec } from '../model/types'
import { gearRatio, pitchRadius } from '../model/types'
import type { Point2 } from './camProfile'

/**
 * Simplified spur gear geometry (trapezoidal teeth on standard
 * addendum/dedendum circles) shared by the 3D scene, both exporters, and
 * the mesh tests.
 *
 * Meshing is correct by construction:
 *  - both gears share the module, so tooth pitch matches at the pitch circles
 *  - the centre distance equals r1 + r2 (see layshaftY), so pitch circles touch
 *  - pitch-line speeds match because ratio = N1/N2 exactly
 *  - the initial rotations (meshPhases) put a DRIVE tooth centre and a DRIVEN
 *    tooth GAP exactly on the mesh line at crank angle 0; equal pitch speeds
 *    keep them interleaved forever after
 */

const TWO_PI = Math.PI * 2

/** Tooth outline of a gear centred on the origin, tooth 0 centred at angle 0. */
export function gearOutline(teeth: number, module: number): Point2[] {
  const pitch = pitchRadius(module, teeth)
  const tip = pitch + module // addendum
  const root = pitch - 1.25 * module // dedendum
  const p = TWO_PI / teeth
  const pts: Point2[] = []
  for (let i = 0; i < teeth; i++) {
    const c = i * p
    // trapezoid tooth: root shoulder → tip flank → tip flank → root shoulder
    const angles: [number, number][] = [
      [c - 0.45 * p, root],
      [c - 0.2 * p, tip],
      [c + 0.2 * p, tip],
      [c + 0.45 * p, root],
    ]
    for (const [a, r] of angles) {
      pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) })
    }
  }
  return pts
}

/** Outer (tip) radius — for clearance checks and part layout. */
export function gearTipRadius(teeth: number, module: number): number {
  return pitchRadius(module, teeth) + module
}

/**
 * Initial rotations that lock the mesh: at crank angle 0 the drive gear
 * has a tooth centre pointing straight down (toward the layshaft) and the
 * driven gear has a tooth gap pointing straight up (toward the camshaft).
 */
export function meshPhases(gear: GearTrainSpec): { drive: number; driven: number } {
  const pDriven = TWO_PI / gear.teethDriven
  return {
    drive: -Math.PI / 2,
    driven: Math.PI / 2 - pDriven / 2,
  }
}

/** Rotation of each gear at crank angle theta (radians, counter-rotating). */
export function gearAngles(gear: GearTrainSpec, theta: number): { drive: number; driven: number } {
  const base = meshPhases(gear)
  return {
    drive: base.drive + theta,
    driven: base.driven - theta * gearRatio(gear),
  }
}

/**
 * Angular distance from the mesh line to the nearest tooth CENTRE of the
 * drive gear and the nearest tooth GAP of the driven gear, at crank angle
 * theta. Both stay locked to the mesh line as the train turns — this is
 * the invariant the tests check.
 */
export function meshAlignment(gear: GearTrainSpec, theta: number): { drive: number; driven: number } {
  const { drive, driven } = gearAngles(gear, theta)
  const p1 = TWO_PI / gear.teethDrive
  const p2 = TWO_PI / gear.teethDriven
  // drive gear: tooth centres at i·p1 + drive; mesh line at −π/2
  const d1 = angularDistance(-Math.PI / 2 - drive, p1)
  // driven gear: tooth gaps at (i+0.5)·p2 + driven; mesh line at +π/2
  const d2 = angularDistance(Math.PI / 2 - (driven + p2 / 2), p2)
  return { drive: d1, driven: d2 }
}

/** Distance from `a` to the nearest multiple of `period`. */
function angularDistance(a: number, period: number): number {
  const m = ((a % period) + period) % period
  return Math.min(m, period - m)
}
