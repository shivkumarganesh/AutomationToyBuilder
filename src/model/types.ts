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
  /**
   * Which shaft carries this cam: the hand-cranked camshaft (default) or
   * the gear-driven layshaft. Requires a gear train when 'lay'.
   */
  shaft?: 'crank' | 'lay'
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
 * square slot in the stage. One pushrod = one LIFT output channel.
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

/**
 * A pivoted lever riding its cam: the cam's lift becomes a rocking angle
 * (nodding motion). One rocker = one TILT output channel, in degrees.
 */
export interface RockerSpec {
  id: string
  /** The cam that drives this lever. */
  camId: string
  /** Horizontal distance from the pivot to the follower contact point. */
  leverLength: number
  /** Width of the flat follower pad on the cam end of the lever. */
  padWidth: number
}

/**
 * A drive on the camshaft turning a vertical spindle up through the
 * stage. One spinner = one SPIN output channel: continuous rotation.
 *
 * Two drive styles:
 *  - friction (default): a wheel rubs the spindle's driven disc at a
 *    contact radius derived from `ratio` (offset = wheelRadius / ratio)
 *  - bevel: a crown gear on the camshaft meshes a horizontal pinion at
 *    the spindle base — positive tooth drive, 90° transfer. The ratio is
 *    DERIVED as crownTeeth / pinionTeeth (never free); the spindle axis
 *    sits one pinion pitch radius from the crown plane and the mesh
 *    height one crown pitch radius above the camshaft.
 */
export interface SpinnerSpec {
  id: string
  /** Position of the spindle axis along the shaft, fraction of interior width. */
  position: number
  /** friction drive only: output revolutions per crank revolution. */
  ratio: number
  /** friction drive only: radius of the drive wheel on the camshaft. */
  wheelRadius: number
  /** Radius of the platform disc above the stage. */
  platformRadius: number
  /** Drive style; omitted means friction (pre-bevel saves). */
  drive?: 'friction' | 'bevel' | 'geneva'
  /** bevel drive: teeth on the crown gear (camshaft). */
  crownTeeth?: number
  /** bevel drive: teeth on the spindle pinion. */
  pinionTeeth?: number
  /** bevel drive: module shared by crown and pinion. */
  module?: number
  /** geneva drive: stations per full spindle revolution (steps). */
  stations?: number
}

/**
 * Output revolutions per crank revolution — derived from teeth for bevel
 * drives; the AVERAGE rate (one station per crank turn) for geneva drives.
 */
export function spinnerRatio(spinner: SpinnerSpec): number {
  if (spinner.drive === 'bevel') {
    if (!spinner.crownTeeth || !spinner.pinionTeeth)
      throw new Error(`bevel spinner ${spinner.id} is missing tooth counts`)
    return spinner.crownTeeth / spinner.pinionTeeth
  }
  if (spinner.drive === 'geneva') {
    if (!spinner.stations) throw new Error(`geneva spinner ${spinner.id} is missing stations`)
    return 1 / spinner.stations
  }
  return spinner.ratio
}

export interface CrankSpec {
  /** Distance from shaft axis to the handle axis. */
  armLength: number
  /** Length of the grip cylinder. */
  handleLength: number
  handleDiameter: number
}

/**
 * A spur gear pair: the drive gear on the crankshaft meshes with the
 * driven gear on a parallel LAYSHAFT mounted directly below it. Every
 * mesh property is derived, never free:
 *   - pitch radius r = module × teeth / 2
 *   - centre distance = r_drive + r_driven exactly (sets the layshaft height)
 *   - speed ratio = teethDrive / teethDriven — an INTEGER, so layshaft cam
 *     motion repeats every crank revolution and stays chartable
 *   - the shafts counter-rotate
 */
export interface GearTrainSpec {
  /** Teeth on the crankshaft (drive) gear. Must be an integer multiple of teethDriven. */
  teethDrive: number
  /** Teeth on the layshaft (driven) gear. */
  teethDriven: number
  /** Module: mm of pitch diameter per tooth. Meshing gears must share it. */
  module: number
  /** Position along the shafts, fraction of the interior width. */
  position: number
}

/**
 * A crank-rocker four-bar linkage in the vertical plane at `position`:
 * a short crank arm on the camshaft (input) drives a coupler whose far
 * end rides a rocker swinging on a fixed post. The COUPLER POINT — the
 * coupler extended past the rocker pin — traces a closed 2D curve, and
 * a rigid wand on the coupler carries the figure up through an elongated
 * stage slot. One linkage = one PATH output channel: 2D trajectory plus
 * the coupler's pitch.
 *
 * Plane coordinates: u along the box depth (world Z), v vertical, origin
 * at the shaft axis. The rocker's fixed pivot sits at (groundLen, 0) —
 * one ground-link length along +Z from the shaft, same height.
 *
 * Grashof crank-rocker condition (the crank must rotate fully):
 * crankRadius is the SHORTEST link and
 * crankRadius + longest ≤ sum of the two remaining links.
 */
export interface LinkageSpec {
  id: string
  /** Position of the linkage plane along the shaft, fraction of interior width. */
  position: number
  /** Input crank radius r2 (shaft axis to crank pin A). */
  crankRadius: number
  /** Coupler length r3 (crank pin A to rocker pin B). */
  couplerLen: number
  /** Rocker length r4 (fixed pivot O4 to rocker pin B). */
  rockerLen: number
  /** Ground link g: O4 offset from the shaft axis along +Z, same height. */
  groundLen: number
  /** Coupler-point extension past B along the A→B line. */
  couplerExt: number
  /** Wand length from the coupler point up to the figure mount. */
  wandLen: number
  /** Phase of the crank pin on the shaft, degrees. */
  phaseDeg: number
}

/** Everything below the stage plate. */
export interface MechanismSpec {
  shaftDiameter: number
  /** Height of the shaft axis above the ground plane. */
  shaftHeight: number
  crank: CrankSpec
  /** Optional gear pair driving the layshaft; absent = single-shaft toy. */
  gearTrain?: GearTrainSpec
  cams: CamSpec[]
  pushrods: PushrodSpec[]
  rockers: RockerSpec[]
  spinners: SpinnerSpec[]
  /** Four-bar linkages; absent on pre-linkage saves. */
  linkages?: LinkageSpec[]
}

export type LimbKind = 'wings' | 'head' | 'tail'

/**
 * A pivot-jointed limb on an articulated figure, driven by one output
 * channel through a pin-and-wire linkage: the wire from the channel's
 * output tip ends in a pin riding the limb's crank arm, so a vertical
 * displacement d rotates the joint by asin(d / crankArm). The crank arm
 * is the ONLY linkage dimension — the whole motion mapping derives from
 * it and the channel's displacement table, never from free numbers.
 */
export interface LimbSpec {
  id: string
  /** Output channel whose displacement drives this joint. */
  channelId: string
  kind: LimbKind
  /** Pivot-to-tip length of the limb plate. */
  length: number
  /** Chord (width) of the limb plate. */
  width: number
  /** Pivot-to-drive-pin distance. Must exceed the channel's half-travel or the linkage locks. */
  crankArm: number
}

/** Everything above the stage plate. */
export interface CharacterSpec {
  id: string
  /** Output channel this character stands over (and its default limb driver). */
  channelId: string
  /**
   * block: a rigid figure riding its channel bodily.
   * articulated: a figure fixed on a stand whose LIMBS move — each limb
   * pivots on the body and is driven by a channel through a wire linkage.
   */
  kind: 'block' | 'articulated'
  width: number
  height: number
  depth: number
  color: string
  label: string
  /** articulated only: the jointed limbs. */
  limbs?: LimbSpec[]
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
 * The stage-interface contract: where a channel surfaces on the stage,
 * what motion it carries, and what drives it. Derived from the spec,
 * consumed by scene + analysis + exports.
 *
 *  - lift: vertical displacement in mm (cam + pushrod)
 *  - tilt: rocking angle in degrees (cam + pivoted lever)
 *  - spin: continuous rotation, `ratio` output revs per crank rev
 */
export type OutputChannel =
  | { kind: 'lift'; id: string; x: number; cam: CamSpec; pushrod: PushrodSpec }
  | { kind: 'tilt'; id: string; x: number; cam: CamSpec; rocker: RockerSpec }
  | { kind: 'spin'; id: string; x: number; spinner: SpinnerSpec }
  | { kind: 'path'; id: string; x: number; linkage: LinkageSpec }

/** Interior width between the two side panels. */
export function interiorWidth(frame: FrameSpec): number {
  return frame.width - 2 * frame.materialThickness
}

/** World X of a cam centre given its fractional position on the shaft. */
export function camWorldX(frame: FrameSpec, position: number): number {
  const inner = interiorWidth(frame)
  return -inner / 2 + position * inner
}

/** Resolve the spec's stage interface: one output channel per output device. */
export function outputChannels(spec: AutomatonSpec): OutputChannel[] {
  const camById = (id: string, owner: string): CamSpec => {
    const cam = spec.mechanism.cams.find((c) => c.id === id)
    if (!cam) throw new Error(`${owner} references unknown cam ${id}`)
    return cam
  }
  return [
    ...spec.mechanism.pushrods.map((rod): OutputChannel => {
      const cam = camById(rod.camId, `Pushrod ${rod.id}`)
      return { kind: 'lift', id: rod.id, cam, pushrod: rod, x: camWorldX(spec.frame, cam.position) }
    }),
    ...spec.mechanism.rockers.map((rocker): OutputChannel => {
      const cam = camById(rocker.camId, `Rocker ${rocker.id}`)
      return { kind: 'tilt', id: rocker.id, cam, rocker, x: camWorldX(spec.frame, cam.position) }
    }),
    ...spec.mechanism.spinners.map(
      (spinner): OutputChannel => ({
        kind: 'spin',
        id: spinner.id,
        spinner,
        x: camWorldX(spec.frame, spinner.position),
      }),
    ),
    ...(spec.mechanism.linkages ?? []).map(
      (linkage): OutputChannel => ({
        kind: 'path',
        id: linkage.id,
        linkage,
        x: camWorldX(spec.frame, linkage.position),
      }),
    ),
  ]
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

/** Pitch radius of a gear: module × teeth / 2. */
export function pitchRadius(module: number, teeth: number): number {
  return (module * teeth) / 2
}

/** Layshaft revolutions per crank revolution (always an integer ≥ 1). */
export function gearRatio(gear: GearTrainSpec): number {
  return gear.teethDrive / gear.teethDriven
}

/**
 * Height of the layshaft axis: exactly one centre distance (r1 + r2)
 * below the camshaft, so the gears mesh by construction.
 */
export function layshaftY(mech: MechanismSpec): number {
  const gear = mech.gearTrain
  if (!gear) throw new Error('no gear train in this mechanism')
  return (
    mech.shaftHeight -
    pitchRadius(gear.module, gear.teethDrive) -
    pitchRadius(gear.module, gear.teethDriven)
  )
}

/** Height of the shaft that carries a given cam. */
export function camShaftY(mech: MechanismSpec, cam: CamSpec): number {
  return cam.shaft === 'lay' ? layshaftY(mech) : mech.shaftHeight
}

/**
 * Signed cam revolutions per crank revolution: 1 on the crankshaft,
 * −ratio on the counter-rotating layshaft.
 */
export function camAngularRate(mech: MechanismSpec, cam: CamSpec): number {
  if (cam.shaft !== 'lay') return 1
  if (!mech.gearTrain) throw new Error(`cam ${cam.id} is on the layshaft but there is no gear train`)
  return -gearRatio(mech.gearTrain)
}
