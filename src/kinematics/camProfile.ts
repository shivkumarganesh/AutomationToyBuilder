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
  }
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
