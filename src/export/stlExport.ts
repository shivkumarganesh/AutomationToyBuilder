import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Mesh, Object3D, Shape } from 'three'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { AutomatonSpec, CharacterSpec, LimbSpec } from '../model/types'
import { camAngularRate, camShaftY, outputChannels } from '../model/types'
import { camOutline } from '../kinematics/camProfile'
import { gearOutline } from '../kinematics/gearProfile'
import { displacementTable } from '../kinematics/follower'
import type { ChannelSignal } from '../kinematics/channels'
import { channelSignals } from '../kinematics/channels'
import { rockerPivotY } from '../scene/rockerLayout'
import {
  bodyBaseY,
  HINGE_HEIGHT,
  LIMB_AXLE_DIAMETER,
  LIMB_PIN_DIAMETER,
  limbPinRests,
  limbPivotFrac,
  limbPlateOutline,
  sourceTipRestY,
  standHeight,
} from '../scene/figureLayout'
import {
  bevelMeshY,
  CROWN_DISC_THICKNESS,
  CROWN_TOOTH_LENGTH,
  crownPitchRadius,
  drivenDiscRadius,
  GENEVA_PIN_RADIUS,
  GENEVA_WHEEL_THICKNESS,
  genevaWheelOutline,
  genevaWheelY,
  PINION_THICKNESS,
} from '../scene/spinnerLayout'

/**
 * 3D-printable parts (binary STL, mm, Z-up, laid flat on the build plate):
 * the D-profile camshaft, the crank, one pushrod per channel, the cams
 * (D-hole enlarged by the FDM clearance so they key onto the shaft), and
 * the character figure blocks.
 *
 * The D-flat sits at 0.55 × radius — the same proportion the laser-cut
 * cam holes use, so printed and cut parts are interchangeable.
 */

const FLAT_RATIO = 0.55
const PAD_THICKNESS = 4

/** Cross-section of the shaft: circle with a flat chord (prints cleanly lying down). */
function dShape(radius: number, segments = 48): Shape {
  const flatY = radius * FLAT_RATIO
  const start = Math.asin(flatY / radius)
  const shape = new Shape()
  const sweep = Math.PI + 2 * start
  for (let i = 0; i <= segments; i++) {
    const a = Math.PI - start + (i / segments) * sweep
    const x = radius * Math.cos(a)
    const y = radius * Math.sin(a)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return shape
}

/** D-shaped hole path (shaft radius + clearance) for keyed printed parts. */
function dHole(radius: number): Shape {
  return dShape(radius)
}

function place(geo: BufferGeometry, x: number, y: number, z: number): BufferGeometry {
  geo.translate(x, y, z)
  return geo
}

/** mergeGeometries requires consistent indexing — normalise to non-indexed. */
function merge(geos: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(
    geos.map((g) => (g.index ? g.toNonIndexed() : g)),
    false,
  )
  if (!merged) throw new Error('Failed to merge part geometries')
  return merged
}

/** Build every printable part, laid out flat with spacing on the plate. */
export function buildPrintParts(spec: AutomatonSpec): { name: string; geometry: BufferGeometry }[] {
  const mech = spec.mechanism
  const clearance = spec.export.fdmClearance
  const shaftR = mech.shaftDiameter / 2
  const parts: { name: string; geometry: BufferGeometry }[] = []

  // Camshaft: D-profile rod spanning the box plus the crank overhang.
  const shaftLength = spec.frame.width + 24
  {
    const geo = new ExtrudeGeometry(dShape(shaftR), { depth: shaftLength, bevelEnabled: false })
    // lie along X, flat facing up for support-free printing
    geo.rotateY(Math.PI / 2)
    parts.push({ name: 'camshaft', geometry: geo })
  }

  // Crank: hub with D-hole, arm, and grip handle — printed flat.
  {
    const { armLength, handleLength, handleDiameter } = mech.crank
    const hubR = shaftR + 4
    const hub = new Shape()
    hub.absarc(0, 0, hubR, 0, Math.PI * 2, false)
    hub.holes.push(dHole(shaftR + clearance))
    const hubGeo = new ExtrudeGeometry(hub, { depth: 6, bevelEnabled: false })

    const arm = new Shape()
    arm.moveTo(-4, 0)
    arm.lineTo(4, 0)
    arm.lineTo(4, armLength)
    arm.lineTo(-4, armLength)
    arm.closePath()
    const armGeo = new ExtrudeGeometry(arm, { depth: 6, bevelEnabled: false })

    const grip = new CylinderGeometry(handleDiameter / 2, handleDiameter / 2, handleLength, 24)
    grip.rotateX(Math.PI / 2) // axis along Z (upward off the plate)
    place(grip, 0, armLength, handleLength / 2)

    parts.push({ name: 'crank', geometry: merge([hubGeo, armGeo, grip]) })
  }

  // Pushrods: square rod + flat follower pad, printed lying down.
  for (const ch of outputChannels(spec)) {
    if (ch.kind !== 'lift') continue
    const { rodWidth, padWidth, length } = ch.pushrod
    const pad = new BoxGeometry(padWidth, PAD_THICKNESS, ch.cam.thickness + 2)
    place(pad, 0, PAD_THICKNESS / 2, 0)
    const rod = new BoxGeometry(rodWidth, length, rodWidth)
    place(rod, 0, PAD_THICKNESS + length / 2, 0)
    const geo = merge([pad, rod])
    geo.rotateX(Math.PI / 2) // lay the assembly flat (length along Y → plate)
    parts.push({ name: `pushrod-${ch.id}`, geometry: geo })
  }

  // Cams: exact simulated profile, D-hole with FDM clearance.
  for (const cam of mech.cams) {
    const pts = camOutline(cam, 128)
    const shape = new Shape()
    shape.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y)
    shape.closePath()
    shape.holes.push(dHole(shaftR + clearance))
    const geo = new ExtrudeGeometry(shape, { depth: cam.thickness, bevelEnabled: false })
    parts.push({ name: `cam-${cam.id}`, geometry: geo })
  }

  // Gear pair + layshaft: same tooth profiles as the scene, keyed D-holes.
  if (mech.gearTrain) {
    const g = mech.gearTrain
    for (const [name, teeth] of [
      ['gear-drive', g.teethDrive],
      ['gear-driven', g.teethDriven],
    ] as const) {
      const pts = gearOutline(teeth, g.module)
      const shape = new Shape()
      shape.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y)
      shape.closePath()
      shape.holes.push(dHole(shaftR + clearance))
      parts.push({
        name,
        geometry: new ExtrudeGeometry(shape, { depth: 6, bevelEnabled: false }),
      })
    }
    const lay = new ExtrudeGeometry(dShape(shaftR), { depth: spec.frame.width + 10, bevelEnabled: false })
    lay.rotateY(Math.PI / 2)
    parts.push({ name: 'layshaft', geometry: lay })
  }

  // Rocker levers: beam + follower pad, printed flat, plus the fulcrum
  // post and the link rod up to the figure — heights DERIVED from the cam
  // follower's mid-travel, the same anchoring the 3D scene uses.
  const stageTop = spec.frame.height + spec.frame.materialThickness
  for (const rocker of mech.rockers) {
    const beam = new BoxGeometry(6, 4, rocker.leverLength + 12)
    const pad = new BoxGeometry(10, 3, rocker.padWidth)
    place(pad, 0, -3.5, rocker.leverLength / 2 + 3)
    parts.push({ name: `rocker-lever-${rocker.id}`, geometry: merge([beam, pad]) })

    const cam = mech.cams.find((c) => c.id === rocker.camId)
    if (cam) {
      const lift = displacementTable(cam, rocker.padWidth, camAngularRate(mech, cam))
      const pivotY = rockerPivotY(lift, camShaftY(mech, cam))
      const post = new BoxGeometry(6, 6, pivotY)
      parts.push({ name: `rocker-post-${rocker.id}`, geometry: post })
      // link rod: beam end (rest = pivot height) up through the stage to
      // the figure underside at stageTop + 6
      const linkLen = stageTop + 6 - pivotY
      if (linkLen > 0) {
        const link = new CylinderGeometry(1.6, 1.6, linkLen, 12)
        link.rotateX(Math.PI / 2) // axis along Z: prints standing, like the spindles
        parts.push({ name: `rocker-link-${rocker.id}`, geometry: link })
      }
    }
  }

  // Spinners: keyed drive wheel + spindle assembly (rod, driven disc, platform).
  for (const sp of mech.spinners) {
    if (sp.drive === 'geneva') {
      // driver: keyed disc with the pin printed on
      const Rd = sp.wheelRadius - 6
      const discShape = new Shape()
      discShape.absarc(0, 0, Rd, 0, Math.PI * 2, false)
      discShape.holes.push(dHole(shaftR + clearance))
      const disc = new ExtrudeGeometry(discShape, { depth: 5, bevelEnabled: false })
      const pin = new CylinderGeometry(GENEVA_PIN_RADIUS, GENEVA_PIN_RADIUS, 12, 16)
      pin.rotateX(Math.PI / 2) // along the disc plane's radial direction after placement
      place(pin, Rd, 0, 2.5)
      pin.rotateZ(0)
      parts.push({ name: `geneva-driver-${sp.id}`, geometry: merge([disc, pin]) })

      // star wheel + spindle + platform printed as one piece
      const pts = genevaWheelOutline(sp)
      const wheelShape = new Shape()
      wheelShape.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) wheelShape.lineTo(pts[i].x, pts[i].y)
      wheelShape.closePath()
      const wheel = new ExtrudeGeometry(wheelShape, {
        depth: GENEVA_WHEEL_THICKNESS,
        bevelEnabled: false,
      })
      const wheelY = genevaWheelY(sp, mech.shaftHeight)
      const top = spec.frame.height + spec.frame.materialThickness + 8
      const rodLen = top - wheelY + GENEVA_WHEEL_THICKNESS / 2
      const rod = new CylinderGeometry(3, 3, rodLen, 20)
      rod.rotateX(Math.PI / 2)
      place(rod, 0, 0, rodLen / 2)
      const platform = new CylinderGeometry(sp.platformRadius, sp.platformRadius, 4, 48)
      platform.rotateX(Math.PI / 2)
      place(platform, 0, 0, rodLen - 2)
      parts.push({ name: `spinner-spindle-${sp.id}`, geometry: merge([wheel, rod, platform]) })
      continue
    }
    if (sp.drive === 'bevel') {
      // crown gear: keyed disc with axial teeth on the rim
      const Rc = crownPitchRadius(sp)
      const discShape = new Shape()
      discShape.absarc(0, 0, Rc, 0, Math.PI * 2, false)
      discShape.holes.push(dHole(shaftR + clearance))
      const disc = new ExtrudeGeometry(discShape, {
        depth: CROWN_DISC_THICKNESS,
        bevelEnabled: false,
      })
      const teethGeos: BufferGeometry[] = [disc]
      const teeth = sp.crownTeeth!
      const toothW = ((2 * Math.PI * Rc) / teeth) * 0.45
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * Math.PI * 2
        const tooth = new BoxGeometry(toothW, 4, CROWN_TOOTH_LENGTH)
        tooth.rotateZ(a + Math.PI / 2)
        tooth.translate(
          (Rc - 2) * Math.cos(a),
          (Rc - 2) * Math.sin(a),
          CROWN_DISC_THICKNESS + CROWN_TOOTH_LENGTH / 2,
        )
        teethGeos.push(tooth)
      }
      parts.push({ name: `crown-${sp.id}`, geometry: merge(teethGeos) })

      // spindle printed as one piece: pinion, rod, platform
      const pts = gearOutline(sp.pinionTeeth!, sp.module!)
      const pinShape = new Shape()
      pinShape.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) pinShape.lineTo(pts[i].x, pts[i].y)
      pinShape.closePath()
      const pinion = new ExtrudeGeometry(pinShape, {
        depth: PINION_THICKNESS,
        bevelEnabled: false,
      })
      const meshY = bevelMeshY(sp, mech.shaftHeight)
      const top = spec.frame.height + spec.frame.materialThickness + 8
      const rodLen = top - meshY + PINION_THICKNESS / 2
      const rod = new CylinderGeometry(3, 3, rodLen, 20)
      rod.rotateX(Math.PI / 2)
      place(rod, 0, 0, rodLen / 2)
      const platform = new CylinderGeometry(sp.platformRadius, sp.platformRadius, 4, 48)
      platform.rotateX(Math.PI / 2)
      place(platform, 0, 0, rodLen - 2)
      parts.push({ name: `spinner-spindle-${sp.id}`, geometry: merge([pinion, rod, platform]) })
      continue
    }
    const wheelShape = new Shape()
    wheelShape.absarc(0, 0, sp.wheelRadius, 0, Math.PI * 2, false)
    wheelShape.holes.push(dHole(shaftR + clearance))
    const wheel = new ExtrudeGeometry(wheelShape, { depth: 8, bevelEnabled: false })
    parts.push({ name: `spinner-wheel-${sp.id}`, geometry: wheel })

    const spindleLength =
      spec.frame.height + spec.frame.materialThickness + 8 - (mech.shaftHeight + sp.wheelRadius)
    const rod = new CylinderGeometry(3, 3, spindleLength, 20)
    rod.rotateX(Math.PI / 2) // axis along Z: prints standing up
    place(rod, 0, 0, spindleLength / 2)
    const driven = new CylinderGeometry(drivenDiscRadius(sp), drivenDiscRadius(sp), 4, 32)
    driven.rotateX(Math.PI / 2)
    place(driven, 0, 0, 2)
    const platform = new CylinderGeometry(sp.platformRadius, sp.platformRadius, 4, 48)
    platform.rotateX(Math.PI / 2)
    place(platform, 0, 0, spindleLength - 2)
    parts.push({ name: `spinner-spindle-${sp.id}`, geometry: merge([rod, driven, platform]) })
  }

  // Character figures, printed upright.
  //
  // Block figures on tilt channels also get their hinge stand. Articulated
  // figures ship as a complete kit: body WITH ITS STAND (height derived
  // from the drive tip's rest height, so the linkage geometry works off
  // the printer), one flat plate per limb with pivot/pin holes exactly
  // crankArm apart, a pivot axle per limb, and the WIRE CRANKS that carry
  // each channel's motion to its pins — the internal connections the 3D
  // scene shows, as printable parts with derived run lengths.
  const signals = channelSignals(spec)
  for (const c of spec.characters) {
    const body = new BoxGeometry(c.width, c.depth, c.height)
    place(body, 0, 0, c.height / 2)
    const bodyPieces = [body]
    const hasHeadLimb = c.kind === 'articulated' && (c.limbs ?? []).some((l) => l.kind === 'head')
    if (!hasHeadLimb) {
      const headSize = c.width * 0.55
      const head = new BoxGeometry(headSize, headSize, headSize)
      place(head, 0, 0, c.height + headSize / 2)
      bodyPieces.push(head)
    }

    if (c.kind !== 'articulated') {
      parts.push({ name: `figure-${c.id}`, geometry: merge(bodyPieces) })
      // tilt-riding blocks rock on a hinge stand fixed to the stage
      const signal = signals.find((s) => s.channel.id === c.channelId)
      if (signal?.kind === 'tilt') {
        const stand = new BoxGeometry(c.width * 0.6, 5, HINGE_HEIGHT)
        parts.push({ name: `hinge-stand-${c.id}`, geometry: stand })
      }
      continue
    }

    // stand merged under the body: the figure prints as one piece that
    // glues to the stage at exactly the derived height
    const standH = Math.max(standHeight(spec, c, signals), 2)
    const stand = new BoxGeometry(8, 8, standH)
    place(stand, 0, 0, -standH / 2)
    parts.push({ name: `figure-${c.id}`, geometry: merge([...bodyPieces, stand]) })

    for (const limb of c.limbs ?? []) {
      const plate = limbPlate(limb, clearance)
      if (limb.kind === 'wings') {
        // the plate is symmetric about its centreline, so the left wing is
        // the same flat part flipped over — print two identical plates
        parts.push({ name: `${limb.id}-left`, geometry: plate })
        parts.push({ name: `${limb.id}-right`, geometry: plate.clone() })
      } else {
        parts.push({ name: limb.id, geometry: plate })
      }

      // pivot axle: through both shoulders for wings, stub for head/tail
      const axleLen =
        limb.kind === 'wings' ? c.width + 2 * LIMB_PLATE_THICKNESS + 6 : 14
      const axle = new CylinderGeometry(LIMB_AXLE_DIAMETER / 2, LIMB_AXLE_DIAMETER / 2, axleLen, 16)
      parts.push({ name: `axle-${limb.id}`, geometry: axle })

      const wire = wireCrank(spec, c, limb, signals, clearance)
      if (wire) parts.push({ name: `wire-${limb.id}`, geometry: wire })
    }
  }

  return parts
}

const WIRE_SECTION = 2.5

/**
 * Printable wire crank for one limb: the rigid link from the channel's
 * output tip to the limb's drive pin(s). Every dimension is derived from
 * the rest geometry the scene renders:
 *  - vertical run = pin rest height − drive tip rest height
 *  - reach = horizontal distance from the source tip to the pin
 * Wings get a yoke: a top plate with one slot per pin (slots absorb the
 * pins' horizontal drift as they arc). Head/tail get a flat L-crank
 * ending in a washer that drops over the pin.
 */
function wireCrank(
  spec: AutomatonSpec,
  character: CharacterSpec,
  limb: LimbSpec,
  signals: ChannelSignal[],
  clearance: number,
): BufferGeometry | null {
  const signal = signals.find((s) => s.channel.id === limb.channelId)
  if (!signal || signal.kind === 'spin') return null
  const tipRest = sourceTipRestY(spec, signal)
  if (tipRest === null) return null

  const base = bodyBaseY(spec, character, signals)
  const pinRestY = base + limbPivotFrac(limb.kind) * character.height
  const run = pinRestY - tipRest
  if (run <= 0) return null

  const primary = signals.find((s) => s.channel.id === character.channelId)
  const originX = primary ? primary.channel.x : signal.channel.x
  const sx = signal.channel.x - originX
  const pins = limbPinRests(character, limb)

  if (limb.kind === 'wings') {
    // yoke plate spanning both pins, one slot per pin, riser bar below
    const xs = pins.map((p) => p.x - sx)
    const zs = pins.map((p) => p.z)
    const margin = 5
    const minX = Math.min(...xs, 0) - margin
    const maxX = Math.max(...xs, 0) + margin
    const minZ = Math.min(...zs) - margin
    const maxZ = Math.max(...zs) + margin
    const plate = new Shape()
    plate.moveTo(minX, minZ)
    plate.lineTo(maxX, minZ)
    plate.lineTo(maxX, maxZ)
    plate.lineTo(minX, maxZ)
    plate.closePath()
    const slotHalfW = LIMB_PIN_DIAMETER / 2 + clearance
    const slotHalfL = 4 // absorbs the pins' cos-drift along X
    for (const [i, px] of xs.entries()) {
      const slot = new Shape()
      const pz = zs[i]
      slot.moveTo(px - slotHalfL, pz - slotHalfW)
      slot.lineTo(px + slotHalfL, pz - slotHalfW)
      slot.lineTo(px + slotHalfL, pz + slotHalfW)
      slot.lineTo(px - slotHalfL, pz + slotHalfW)
      slot.closePath()
      plate.holes.push(slot)
    }
    const yoke = new ExtrudeGeometry(plate, { depth: WIRE_SECTION, bevelEnabled: false })
    // riser: from the rod tip up to the yoke underside
    const riser = new BoxGeometry(WIRE_SECTION, WIRE_SECTION, run)
    place(riser, 0, 0, -run / 2)
    // mounting pad that glues onto the rod tip
    const pad = new BoxGeometry(6, 6, 3)
    place(pad, 0, 0, -run - 1.5)
    return merge([yoke, riser, pad])
  }

  // head/tail: flat L-crank in one plane — vertical run, horizontal
  // reach, washer end that drops over the pin
  const pin = pins[0]
  const reach = Math.hypot(pin.x - sx, pin.z)
  const shape = new Shape()
  const h = WIRE_SECTION
  shape.moveTo(-h / 2, 0)
  shape.lineTo(h / 2, 0)
  shape.lineTo(h / 2, run - h)
  shape.lineTo(reach, run - h)
  shape.lineTo(reach, run)
  shape.lineTo(-h / 2, run)
  shape.closePath()
  const washer = new Shape()
  washer.absarc(reach, run - h / 2, 3, 0, Math.PI * 2, false)
  const washerHole = new Shape()
  washerHole.absarc(reach, run - h / 2, LIMB_PIN_DIAMETER / 2 + clearance, 0, Math.PI * 2, true)
  washer.holes.push(washerHole)
  const arm = new ExtrudeGeometry(shape, { depth: WIRE_SECTION, bevelEnabled: false })
  const end = new ExtrudeGeometry(washer, { depth: WIRE_SECTION, bevelEnabled: false })
  return merge([arm, end])
}

const LIMB_PLATE_THICKNESS = 3

/**
 * Flat limb plate: rounded paddle from the drive pin hole (at −crankArm)
 * through the pivot hole (at the origin) out to the tip (at +length),
 * printed flat. Same outline the laser exporter cuts; hole spacing IS
 * the linkage geometry.
 */
function limbPlate(
  limb: { length: number; width: number; crankArm: number },
  clearance: number,
): BufferGeometry {
  const pts = limbPlateOutline(limb)
  const shape = new Shape()
  shape.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y)
  shape.closePath()
  const pivot = new Shape()
  pivot.absarc(0, 0, LIMB_AXLE_DIAMETER / 2 + clearance, 0, Math.PI * 2, true)
  const pin = new Shape()
  pin.absarc(-limb.crankArm, 0, LIMB_PIN_DIAMETER / 2 + clearance, 0, Math.PI * 2, true)
  shape.holes.push(pivot, pin)
  return new ExtrudeGeometry(shape, { depth: LIMB_PLATE_THICKNESS, bevelEnabled: false })
}

/** Single binary STL with all parts spaced out on the build plate. */
export function exportStl(spec: AutomatonSpec): DataView {
  const parts = buildPrintParts(spec)
  const root = new Object3D()
  let cursorX = 0
  for (const part of parts) {
    part.geometry.computeBoundingBox()
    const bb = part.geometry.boundingBox!
    const mesh = new Mesh(part.geometry)
    // rest the part on the plate and step along X with a gap
    mesh.position.set(cursorX - bb.min.x, -bb.min.y, -bb.min.z)
    cursorX += bb.max.x - bb.min.x + 10
    root.add(mesh)
  }
  root.updateMatrixWorld(true)
  const exporter = new STLExporter()
  return exporter.parse(root, { binary: true }) as unknown as DataView
}
