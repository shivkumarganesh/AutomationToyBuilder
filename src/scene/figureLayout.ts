import type { AutomatonSpec, CharacterSpec, LimbSpec } from '../model/types'
import { camAngularRate, camShaftY } from '../model/types'
import type { ChannelSignal } from '../kinematics/channels'
import { channelDisplacement } from '../kinematics/articulation'
import { displacementTable } from '../kinematics/follower'
import { rockerPivotY } from './rockerLayout'

/**
 * Geometry of an articulated figure, shared by the 3D scene, the STL
 * exporter, and the tests.
 *
 * The body stands on a fixed stand over its primary channel; limbs pivot
 * on the body and are driven by wires rising from channel output tips.
 * Every vertical dimension is DERIVED: the shoulder pivot height comes
 * from the drive tip's mid-travel rest height plus a fixed wire run, and
 * the stand fills whatever gap remains down to the stage — the same
 * mid-travel anchoring the rocker pivot uses.
 */

export const LIMB_THICKNESS = 3
export const WIRE_RADIUS = 1
/** Rest length of the wire run from the primary drive tip up to its pin. */
export const WIRE_REST_RUN = 10
/** Fallback stand height when the body is not anchored to a lift/tilt tip. */
export const DEFAULT_STAND = 6
/** Drive pins are staggered ±z so crossing wing arms never collide. */
export const PIN_STAGGER = 2

/** Pushrod follower pad thickness (matches Pushrod.tsx / stlExport). */
const PAD_THICKNESS = 4

/** Shoulder / neck / tail pivot heights as fractions of body height. */
export function limbPivotFrac(kind: LimbSpec['kind']): number {
  switch (kind) {
    case 'wings':
      return 0.78
    case 'head':
      return 1
    case 'tail':
      return 0.55
  }
}

/**
 * World rest height of a channel's output tip — where a drive wire starts.
 * lift: the pushrod top at mid-travel. tilt: the rocker beam end (its rest
 * height IS the pivot height). spin: no tip — spindles don't translate.
 */
export function sourceTipRestY(spec: AutomatonSpec, signal: ChannelSignal): number | null {
  const mech = spec.mechanism
  switch (signal.kind) {
    case 'lift': {
      const mid = (signal.table.min + signal.table.max) / 2
      return (
        camShaftY(mech, signal.channel.cam) +
        mid +
        PAD_THICKNESS +
        signal.channel.pushrod.length
      )
    }
    case 'tilt': {
      const { cam, rocker } = signal.channel
      const lift = displacementTable(cam, rocker.padWidth, camAngularRate(mech, cam))
      return rockerPivotY(lift, camShaftY(mech, cam))
    }
    case 'path':
      // the wand's figure mount at mid vertical travel
      return mech.shaftHeight + (signal.table.vMin + signal.table.vMax) / 2
    case 'spin':
      return null
  }
}

/** World position of a channel's output tip at crank angle theta. */
export function sourceTipY(spec: AutomatonSpec, signal: ChannelSignal, theta: number): number | null {
  const rest = sourceTipRestY(spec, signal)
  if (rest === null) return null
  return rest + channelDisplacement(signal, theta)
}

/** The limb that anchors the body height: first limb on the figure's own channel. */
export function primaryLimb(character: CharacterSpec): LimbSpec | undefined {
  const limbs = character.limbs ?? []
  return limbs.find((l) => l.channelId === character.channelId) ?? limbs[0]
}

/**
 * World Y of the body's base (stand top). Anchored so the primary limb's
 * pin rest position sits exactly one wire run above its drive tip's rest
 * position; without a displacement-driven primary limb the body gets the
 * default stand.
 */
export function bodyBaseY(
  spec: AutomatonSpec,
  character: CharacterSpec,
  signals: ChannelSignal[],
): number {
  const stageTop = spec.frame.height + spec.frame.materialThickness
  const anchor = primaryLimb(character)
  if (anchor) {
    const signal = signals.find((s) => s.channel.id === anchor.channelId)
    const rest = signal ? sourceTipRestY(spec, signal) : null
    if (rest !== null && rest !== undefined) {
      const pivotY = rest + WIRE_REST_RUN
      return Math.max(stageTop + 2, pivotY - limbPivotFrac(anchor.kind) * character.height)
    }
  }
  return stageTop + DEFAULT_STAND
}

/**
 * Joint rotation signs — the see-saw conventions the scene applies, kept
 * here so the tests can pin them down:
 *  - wings rotate about Z, mirrored, drive pins on the inner arms
 *  - head nods about X, pin on a rear arm behind the neck (see-saw)
 *  - tail wags about X, pin ON the tail blade just behind the back face —
 *    outside the body, so the wire is visibly hooked, never buried
 * In every case pin rise = crankArm · sin(a) = the wire displacement.
 */
export function wingRotations(a: number): { left: number; right: number } {
  return { left: a, right: -a }
}

export function headRotation(a: number): number {
  return a
}

export function tailRotation(a: number): number {
  return a
}

/** Vertical rise of a drive pin at joint angle a — identical for every limb kind. */
export function pinRise(a: number, crankArm: number): number {
  return crankArm * Math.sin(a)
}

/** Vertical rise of a wing tip: opposite the pin, scaled by the lever ratio. */
export function wingTipRise(a: number, length: number): number {
  return -length * Math.sin(a)
}

/** Height of the hinge stand under tilt-riding block figures (FigureBlock). */
export const HINGE_HEIGHT = 4

/**
 * Depth-plane a REMOTE drive wire (source channel ≠ the figure's own
 * channel) rises in. Wings sweep the z-band around the body (± their
 * chord), so a remote wire must set back to the pin's depth FIRST — at
 * rod-tip level, below the sweep — then rise and run to the pin entirely
 * behind the flapping plane.
 */
export function remoteWireZ(character: CharacterSpec, limb: LimbSpec): number {
  return limb.kind === 'head' ? -limb.crankArm : -character.depth / 2 - limb.crankArm
}

/**
 * Lowest point the wing plates ever sweep (world Y): the shoulder pivot
 * minus the full plate reach at the peak flap angle, minus the plate
 * half-thickness. Everything a neighbouring channel raises (rod tops,
 * wire setbacks) must stay BELOW this line.
 */
export function wingSweepMinY(pivotY: number, wings: LimbSpec, maxAngle: number): number {
  return pivotY - (wings.length + 2) * Math.sin(maxAngle) - LIMB_THICKNESS / 2
}

/** Limb pivot axle diameter — plates and body holes are sized around it. */
export const LIMB_AXLE_DIAMETER = 3
/** Drive pin diameter (the scene renders r = 1.2 pins). */
export const LIMB_PIN_DIAMETER = 2.4

/** Stand height under an articulated body — derived, may be clamped ≥ 2. */
export function standHeight(
  spec: AutomatonSpec,
  character: CharacterSpec,
  signals: ChannelSignal[],
): number {
  const stageTop = spec.frame.height + spec.frame.materialThickness
  return bodyBaseY(spec, character, signals) - stageTop
}

/**
 * Drive-pin rest positions relative to the figure origin (x along the
 * shaft, z toward the viewer), one per pin. Mirrors the scene geometry:
 * wing pins sit crankArm inboard of the shoulders (staggered ±z), the
 * head pin one crankArm behind the neck, the tail pin one crankArm
 * beyond the back face on the blade.
 */
export function limbPinRests(
  character: CharacterSpec,
  limb: LimbSpec,
): { x: number; z: number }[] {
  const { width, depth } = character
  switch (limb.kind) {
    case 'wings': {
      const px = width / 2 - limb.crankArm
      return [
        { x: px, z: -PIN_STAGGER },
        { x: -px, z: PIN_STAGGER },
      ]
    }
    case 'head':
      return [{ x: 0, z: -limb.crankArm }]
    case 'tail':
      return [{ x: 0, z: -depth / 2 - limb.crankArm }]
  }
}

/**
 * Flat limb plate outline, shared by the laser and print exporters: a
 * tapered paddle from the drive-pin end (rounded cap at −crankArm)
 * through the pivot (origin) to the rounded tip (+length). Hole spacing
 * — pivot at 0, pin at −crankArm — IS the linkage geometry.
 */
export function limbPlateOutline(
  limb: Pick<LimbSpec, 'length' | 'width' | 'crankArm'>,
  arcSegments = 12,
): { x: number; y: number }[] {
  const halfW = Math.max(limb.width / 2, 4)
  const pts: { x: number; y: number }[] = []
  pts.push({ x: -limb.crankArm, y: -halfW / 2 })
  pts.push({ x: limb.length, y: -halfW })
  for (let i = 1; i < arcSegments; i++) {
    const a = -Math.PI / 2 + (i / arcSegments) * Math.PI
    pts.push({ x: limb.length + halfW * Math.cos(a), y: halfW * Math.sin(a) })
  }
  pts.push({ x: limb.length, y: halfW })
  pts.push({ x: -limb.crankArm, y: halfW / 2 })
  for (let i = 1; i < arcSegments; i++) {
    const a = Math.PI / 2 + (i / arcSegments) * Math.PI
    pts.push({ x: -limb.crankArm + (halfW / 2) * Math.cos(a), y: (halfW / 2) * Math.sin(a) })
  }
  return pts
}
