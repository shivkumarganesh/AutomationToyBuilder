import type { CamSpec } from '../model/types'
import { camOutline, type Point2 } from './camProfile'

const TWO_PI = Math.PI * 2

/**
 * Height of a flat-faced follower pad resting on the cam.
 *
 * The pad is horizontal, translates only vertically, and is centred on the
 * shaft axis. Its resting height is the highest profile point that lies
 * under the pad: rotate the outline by theta, keep points whose x falls
 * within the pad extent, take the max y. Exact for any profile shape,
 * including the snail cam's step and multi-lobed petals (where a wide pad
 * correctly bridges adjacent lobe tips).
 */
export function followerHeight(outline: Point2[], theta: number, padHalfWidth: number): number {
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  let best = -Infinity
  let nearestX = Infinity
  let nearestY = 0
  for (const p of outline) {
    const x = p.x * cos - p.y * sin
    const y = p.x * sin + p.y * cos
    if (Math.abs(x) <= padHalfWidth) {
      if (y > best) best = y
    } else if (Math.abs(x) < nearestX) {
      nearestX = Math.abs(x)
      nearestY = y
    }
  }
  // A pad narrower than the sampling pitch might miss every sample; rest it
  // on the sample closest to the pad edge instead.
  return best === -Infinity ? nearestY : best
}

/**
 * Precomputed displacement curve for one cam/pushrod pair: follower height
 * (relative to the shaft axis) for one full crank revolution.
 *
 * This table is the mechanism's output-channel signal — the 3D scene, the
 * displacement chart, and export validation all read from it.
 */
export interface DisplacementTable {
  /** heights[i] = follower height at theta = i / heights.length * 2π. */
  heights: number[]
  min: number
  max: number
  /** Follower lift = max − min. */
  lift: number
}

export function displacementTable(
  cam: CamSpec,
  padWidth: number,
  steps = 360,
  outlineSamples = 256,
): DisplacementTable {
  const outline = camOutline(cam, outlineSamples)
  const phase = (cam.phaseDeg * Math.PI) / 180
  const heights: number[] = new Array(steps)
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * TWO_PI + phase
    const h = followerHeight(outline, theta, padWidth / 2)
    heights[i] = h
    if (h < min) min = h
    if (h > max) max = h
  }
  return { heights, min, max, lift: max - min }
}

/** Linearly interpolated lookup of a displacement table at crank angle theta (radians). */
export function sampleDisplacement(table: DisplacementTable, theta: number): number {
  const n = table.heights.length
  const t = (((theta % TWO_PI) + TWO_PI) % TWO_PI) / TWO_PI
  const f = t * n
  const i = Math.floor(f) % n
  const j = (i + 1) % n
  const frac = f - Math.floor(f)
  return table.heights[i] * (1 - frac) + table.heights[j] * frac
}
