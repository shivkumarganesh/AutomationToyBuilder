/**
 * Core parametric model for the automaton designer.
 *
 * An automaton is modeled as two worlds joined by an interface:
 *
 *  - MECHANISM ZONE (inside the box): crank, camshaft, cams, followers.
 *    It produces named *output channels* — displacement as a function of
 *    crank angle, surfaced at a physical position on the stage.
 *
 *  - CHARACTER ZONE (above the stage): the visible figures. Characters
 *    bind to output channels by id, never to cams directly, so the
 *    mechanism internals can change without touching the characters.
 *
 *  - STAGE INTERFACE: each pushrod passes through a guide slot in the
 *    stage plate and *is* one output channel.
 *
 * All dimensions are millimetres. All angles in the spec are degrees.
 *
 * 3D coordinate system: Y up, camshaft along X, origin at the centre of
 * the box footprint on the ground plane.
 */

/** The rigid enclosure: side panels carry the shaft, the top plate is the stage. */
export interface FrameSpec {
  /** Outer width along the camshaft (X). */
  width: number
  /** Outer depth (Z). */
  depth: number
  /** Outer height of the box body (Y); the stage plate sits on top. */
  height: number
  /** Sheet material thickness (laser-cut stock). */
  materialThickness: number
}

export type CamKind = 'eccentric' | 'petal' | 'snail'

interface CamBase {
  id: string
  kind: CamKind
  /**
   * Position of the cam centre along the shaft, as a fraction of the
   * interior width (0 = left interior wall, 1 = right interior wall).
   */
  position: number
  /** Phase offset on the shaft, degrees. */
  phaseDeg: number
  /** Extruded thickness of the cam disc. */
  thickness: number
}

/** Circular disc mounted off-centre — smooth simple-harmonic rise and fall. */
export interface EccentricCamSpec extends CamBase {
  kind: 'eccentric'
  radius: number
  /** Distance from disc centre to shaft axis. Follower lift = 2 × eccentricity. */
  eccentricity: number
}

/** Multiple rounded lobes — rapid repeating bounces. */
export interface PetalCamSpec extends CamBase {
  kind: 'petal'
  baseRadius: number
  /** Radial height of each lobe above the base circle. */
  lift: number
  lobes: number
}

/** Spiral rise with a sharp drop — hammering / pecking motion. */
export interface SnailCamSpec extends CamBase {
  kind: 'snail'
  baseRadius: number
  /** Radial rise over one revolution before the drop. */
  lift: number
}

export type CamSpec = EccentricCamSpec | PetalCamSpec | SnailCamSpec

/**
 * A vertical rod riding its cam through a flat follower pad, guided by a
 * square slot in the stage. One pushrod = one output channel.
 */
export interface PushrodSpec {
  id: string
  /** The cam that drives this rod. */
  camId: string
  /** Side length of the square rod section. */
  rodWidth: number
  /** Width of the flat follower pad at the bottom of the rod. */
  padWidth: number
  /** Rod length from the follower pad top to the rod tip above the stage. */
  length: number
}

export interface CrankSpec {
  /** Distance from shaft axis to the handle axis. */
  armLength: number
  /** Length of the grip cylinder. */
  handleLength: number
  handleDiameter: number
}

/** Everything below the stage plate. */
export interface MechanismSpec {
  shaftDiameter: number
  /** Height of the shaft axis above the ground plane. */
  shaftHeight: number
  crank: CrankSpec
  cams: CamSpec[]
  pushrods: PushrodSpec[]
}

/** Everything above the stage plate. */
export interface CharacterSpec {
  id: string
  /** Output channel (pushrod id) this character rides. */
  channelId: string
  /** v1 ships simple blocks; articulated figures come with later toys. */
  kind: 'block'
  width: number
  height: number
  depth: number
  color: string
  label: string
}

export interface ExportSettings {
  /** Laser kerf (material burned away), split half per side of the cut. */
  kerf: number
  /** Radial clearance added to holes in 3D-printed parts for FDM fit. */
  fdmClearance: number
}

export interface AutomatonSpec {
  name: string
  frame: FrameSpec
  mechanism: MechanismSpec
  characters: CharacterSpec[]
  export: ExportSettings
}

/**
 * The stage-interface contract: where a channel surfaces on the stage and
 * what drives it. Derived from the spec, consumed by scene + exports.
 */
export interface OutputChannel {
  id: string
  cam: CamSpec
  pushrod: PushrodSpec
  /** Channel position along the shaft in world X (mm, box-centre origin). */
  x: number
}

/** Interior width between the two side panels. */
export function interiorWidth(frame: FrameSpec): number {
  return frame.width - 2 * frame.materialThickness
}

/** World X of a cam centre given its fractional position on the shaft. */
export function camWorldX(frame: FrameSpec, position: number): number {
  const inner = interiorWidth(frame)
  return -inner / 2 + position * inner
}

/** Resolve the spec's stage interface: one output channel per pushrod. */
export function outputChannels(spec: AutomatonSpec): OutputChannel[] {
  return spec.mechanism.pushrods.map((rod) => {
    const cam = spec.mechanism.cams.find((c) => c.id === rod.camId)
    if (!cam) throw new Error(`Pushrod ${rod.id} references unknown cam ${rod.camId}`)
    return { id: rod.id, cam, pushrod: rod, x: camWorldX(spec.frame, cam.position) }
  })
}

/** Largest radius the cam profile reaches — used for clearances and layout. */
export function camMaxRadius(cam: CamSpec): number {
  switch (cam.kind) {
    case 'eccentric':
      return cam.radius + cam.eccentricity
    case 'petal':
      return cam.baseRadius + cam.lift
    case 'snail':
      return cam.baseRadius + cam.lift
  }
}
