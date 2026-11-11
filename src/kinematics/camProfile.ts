import type { CamSpec } from '../model/types'

const TWO_PI = Math.PI * 2

/**
 * Polar radius of the cam profile at angle phi (cam-local frame, radians).
 *
 * The profile is defined at phase 0; the cam's phaseDeg and the crank angle
 * are applied later as a rigid rotation of the whole outline.
 */
export function camRadius(cam: CamSpec, phi: number): number {
  const a = ((phi % TWO_PI) + TWO_PI) % TWO_PI
  switch (cam.kind) {
    case 'eccentric': {
      // Circle of radius R whose centre sits `e` from the shaft axis along
      // the local +X direction: r(phi) = e·cos(phi) + sqrt(R² − e²·sin²(phi)).
      const { radius: R, eccentricity: e } = cam
      const s = e * Math.sin(a)
      return e * Math.cos(a) + Math.sqrt(Math.max(R * R - s * s, 0))
    }
    case 'petal': {
      // n rounded lobes: valleys at the base circle, tips at base + lift.
      const { baseRadius, lift, lobes } = cam
      return baseRadius + (lift / 2) * (1 - Math.cos(lobes * a))
    }
    case 'snail': {
      // Archimedean spiral, wound so the follower always rises gradually
      // and drops off the step — never the reverse, which would jam. The
      // crankshaft turns counterclockwise; the gear-driven layshaft
      // counter-rotates, so a layshaft snail winds the opposite way.
      const { baseRadius, lift } = cam
      const t = cam.shaft === 'lay' ? a / TWO_PI : 1 - a / TWO_PI
      return baseRadius + lift * t
    }
    case 'custom': {
      // The follower sits on top of the cam (local angle 90° at crank 0).
      // After the crank turns by θ the point under it is the one drawn at
      // 90° − θ, so the height wanted at crank angle θ goes there. The
      // counter-rotating layshaft plays the profile the other way round.
      const theta = cam.shaft === 'lay' ? a - Math.PI / 2 : Math.PI / 2 - a
      return cam.baseRadius + drawnLift(cam.lifts, theta)
    }
  }
}

/**
 * The drawn motion as a smooth periodic curve: height (mm) wanted at
 * crank angle theta, through the control heights (closed Catmull-Rom,
 * never below zero).
 */
export function drawnLift(lifts: number[], theta: number): number {
  const n = lifts.length
  const u = ((((theta % TWO_PI) + TWO_PI) % TWO_PI) / TWO_PI) * n
  const i = Math.floor(u) % n
  const t = u - Math.floor(u)
  const p0 = lifts[(i - 1 + n) % n]
  const p1 = lifts[i]
  const p2 = lifts[(i + 1) % n]
  const p3 = lifts[(i + 2) % n]
  const v =
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
  return Math.max(0, v)
}

/** Steepest climb a flat follower will ride without jamming (degrees). */
export const MAX_PRESSURE_ANGLE = 38

/**
 * The steepest CLIMB of a drawn motion, as a pressure angle in degrees:
 * atan(rise per radian / radius). Falls are free — a follower can drop
 * off a cliff — but a climb steeper than MAX_PRESSURE_ANGLE pushes the
 * rod sideways instead of up, and the crank jams.
 */
export function steepestClimb(cam: Extract<CamSpec, { kind: 'custom' }>): number {
  let worst = 0
  const N = 720
  for (let k = 0; k < N; k++) {
    const th = (k / N) * TWO_PI
    const s0 = drawnLift(cam.lifts, th)
    const s1 = drawnLift(cam.lifts, th + TWO_PI / N)
    const slope = (s1 - s0) / (TWO_PI / N)
    if (slope > 0) worst = Math.max(worst, Math.atan(slope / (cam.baseRadius + s0)))
  }
  return (worst * 180) / Math.PI
}

export interface Point2 {
  x: number
  y: number
}

/**
 * Sample the cam profile as a closed polygon in the cam-local XY frame.
 * Shared by the 3D extrusion, the SVG cut path, and the follower solver.
 */
export function camOutline(cam: CamSpec, samples = 256): Point2[] {
  const pts: Point2[] = []
  for (let i = 0; i < samples; i++) {
    const phi = (i / samples) * TWO_PI
    const r = camRadius(cam, phi)
    pts.push({ x: r * Math.cos(phi), y: r * Math.sin(phi) })
  }
  return pts
}
