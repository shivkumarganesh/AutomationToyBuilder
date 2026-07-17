import type { LimbSpec } from '../model/types'
import type { ChannelSignal } from './channels'
import { channelValue } from './channels'

/**
 * Articulated-limb kinematics: how an output channel's motion becomes a
 * joint rotation.
 *
 * The linkage is the classic automaton pin-and-wire: the channel's output
 * tip (pushrod top, or rocker beam end) carries a stiff wire whose upper
 * end is a pin riding the limb's crank arm at radius `crankArm` from the
 * joint pivot. The pin is constrained to the wire tip's height, so a
 * vertical displacement d about mid-travel rotates the joint by exactly
 *
 *     angle = asin(d / crankArm)
 *
 * Spin channels have no vertical displacement — a spin-driven limb turns
 * continuously with its spindle instead (a pinwheel joint).
 */

const DEG = Math.PI / 180

/**
 * Vertical displacement (mm) the channel's output tip presents to a wire,
 * measured about its mid-travel rest position.
 *
 *  - lift: follower height minus mid-travel — the pushrod tip's motion.
 *  - tilt: the rocker beam end rises sin(angle)·leverLength above its
 *    mid-travel; identical to the beam-end geometry the scene renders.
 *  - spin: 0 — spindles do not translate.
 */
export function channelDisplacement(signal: ChannelSignal, theta: number): number {
  switch (signal.kind) {
    case 'lift': {
      const mid = (signal.table.min + signal.table.max) / 2
      return channelValue(signal, theta) - mid
    }
    case 'tilt': {
      const L = signal.channel.rocker.leverLength
      const midDeg = (signal.table.min + signal.table.max) / 2
      return (Math.sin(channelValue(signal, theta) * DEG) - Math.sin(midDeg * DEG)) * L
    }
    case 'spin':
      return 0
  }
}

/** Half the channel's total vertical travel (mm) — the displacement amplitude. */
export function channelHalfTravel(signal: ChannelSignal): number {
  switch (signal.kind) {
    case 'lift':
      return signal.table.lift / 2
    case 'tilt': {
      const L = signal.channel.rocker.leverLength
      return ((Math.sin(signal.table.max * DEG) - Math.sin(signal.table.min * DEG)) * L) / 2
    }
    case 'spin':
      return 0
  }
}

/**
 * Joint angle (radians) of a limb at crank angle theta. Displacement-driven
 * limbs follow the pin-on-wire model; spin-driven limbs rotate continuously
 * with their spindle (including geneva stepping).
 */
export function limbJointAngle(signal: ChannelSignal, limb: LimbSpec, theta: number): number {
  if (signal.kind === 'spin') return channelValue(signal, theta) * DEG
  const d = channelDisplacement(signal, theta)
  return Math.asin(Math.max(-1, Math.min(1, d / limb.crankArm)))
}

/** Peak joint angle (radians) the linkage reaches over a revolution. */
export function limbMaxAngle(signal: ChannelSignal, limb: LimbSpec): number {
  return Math.asin(Math.min(1, channelHalfTravel(signal) / limb.crankArm))
}

/**
 * True when the linkage can never lock: the crank arm must exceed the
 * channel's half-travel, or the pin would be asked to rise beyond the arc
 * it can reach and the joint would jam at ±90°.
 */
export function limbLinkageOk(signal: ChannelSignal, limb: LimbSpec): boolean {
  if (signal.kind === 'spin') return true
  return limb.crankArm > channelHalfTravel(signal)
}
