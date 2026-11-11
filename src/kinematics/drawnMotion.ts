import type { CamSpec, CustomCamSpec } from '../model/types'
import { MAX_PRESSURE_ANGLE, steepestClimb } from './camProfile'
import { displacementTable, sampleDisplacement } from './follower'

/**
 * Motion-first cam design: start from the motion you want — a curve of
 * height against crank angle — and let the cam follow from it.
 */

/** Control heights a drawn motion is edited with (every 30° of crank). */
export const DRAWN_POINTS = 12
/** Tallest motion the editor allows, mm. */
export const DRAWN_MAX_LIFT = 18
const TWO_PI = Math.PI * 2

/**
 * Turn any cam into a drawn one that starts out doing what the cam does
 * now: its real follower motion, sampled at the control angles.
 */
export function drawnFrom(cam: CamSpec, padWidth: number, rate: number): CustomCamSpec {
  const base = {
    id: cam.id,
    position: cam.position,
    phaseDeg: cam.phaseDeg,
    thickness: cam.thickness,
    ...(cam.shaft ? { shaft: cam.shaft } : {}),
  }
  if (cam.kind === 'custom') return cam
  const table = displacementTable(cam, padWidth, rate)
  const phase = (cam.phaseDeg * Math.PI) / 180
  const lifts = Array.from({ length: DRAWN_POINTS }, (_, i) => {
    // the table already includes the cam's phase; a drawn cam keeps its
    // phase too, so sample the un-phased motion
    const theta = (i / DRAWN_POINTS) * TWO_PI - phase / (rate || 1)
    return Math.round(Math.min(DRAWN_MAX_LIFT, sampleDisplacement(table, theta) - table.min) * 2) / 2
  })
  return { ...base, kind: 'custom', baseRadius: Math.max(12, Math.round(table.min)), lifts }
}

export interface MotionPreset {
  id: string
  label: string
  /** Heights as a fraction of full travel at the control angles. */
  shape: number[]
}

/** Starting points for a drawn motion. All climb gently enough to turn freely. */
export const MOTION_PRESETS: MotionPreset[] = [
  { id: 'wave', label: 'Wave', shape: [0, 0.07, 0.25, 0.5, 0.75, 0.93, 1, 0.93, 0.75, 0.5, 0.25, 0.07] },
  { id: 'hops', label: 'Two hops', shape: [0, 0.5, 1, 0.5, 0, 0, 0, 0.5, 1, 0.5, 0, 0] },
  { id: 'peck', label: 'Rise & drop', shape: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 0.5] },
  { id: 'pause', label: 'Hold at the top', shape: [0, 0.3, 0.7, 1, 1, 1, 1, 1, 0.7, 0.3, 0, 0] },
  { id: 'jitter', label: 'Shiver', shape: [0.3, 0.7, 0.3, 0.7, 0.3, 0.7, 0.3, 0.7, 0.3, 0.7, 0.3, 0.7] },
]

export function presetLifts(preset: MotionPreset, travel: number): number[] {
  return preset.shape.map((v) => Math.round(v * travel * 2) / 2)
}

/** Plain-language problems with a drawn cam; empty when it will turn freely. */
export function drawnCamIssues(cam: CustomCamSpec): string[] {
  const issues: string[] = []
  const travel = Math.max(...cam.lifts) - Math.min(...cam.lifts)
  if (travel < 1) issues.push('This motion is almost flat — the figure will barely move.')
  const climb = steepestClimb(cam)
  if (climb > MAX_PRESSURE_ANGLE)
    issues.push(
      `One climb is too steep (${Math.round(climb)}°, the limit is ${MAX_PRESSURE_ANGLE}°) — the rod would jam. Spread that rise over more of the turn, lower it, or make the cam bigger. Drops can be as sudden as you like.`,
    )
  return issues
}
