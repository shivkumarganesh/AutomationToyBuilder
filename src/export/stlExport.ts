import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Mesh, Object3D, Shape } from 'three'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { AutomatonSpec } from '../model/types'
import { outputChannels } from '../model/types'
import { camOutline } from '../kinematics/camProfile'
import { gearOutline } from '../kinematics/gearProfile'
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

  // Rocker levers: beam + follower pad, printed flat.
  for (const rocker of mech.rockers) {
    const beam = new BoxGeometry(6, 4, rocker.leverLength + 12)
    const pad = new BoxGeometry(10, 3, rocker.padWidth)
    place(pad, 0, -3.5, rocker.leverLength / 2 + 3)
    parts.push({ name: `rocker-lever-${rocker.id}`, geometry: merge([beam, pad]) })
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

  // Character figures, printed upright. Articulated figures ship as a
  // body (with its static head only when no head limb replaces it) plus
  // one flat plate per limb, each carrying a pivot hole and a drive-pin
  // hole exactly crankArm apart — the joint geometry is cut into the part.
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
    parts.push({ name: `figure-${c.id}`, geometry: merge(bodyPieces) })

    if (c.kind !== 'articulated') continue
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
    }
  }

  return parts
}

const LIMB_PLATE_THICKNESS = 3
const LIMB_PIVOT_HOLE_R = 1.5
const LIMB_PIN_HOLE_R = 1.2

/**
 * Flat limb plate: rounded paddle from the drive pin hole (at −crankArm)
 * through the pivot hole (at the origin) out to the tip (at +length),
 * printed flat. Hole spacing IS the linkage geometry.
 */
function limbPlate(
  limb: { length: number; width: number; crankArm: number },
  clearance: number,
): BufferGeometry {
  const halfW = Math.max(limb.width / 2, 4)
  const shape = new Shape()
  shape.moveTo(-limb.crankArm, -halfW / 2)
  shape.lineTo(limb.length, -halfW)
  shape.absarc(limb.length, 0, halfW, -Math.PI / 2, Math.PI / 2, false)
  shape.lineTo(-limb.crankArm, halfW / 2)
  shape.absarc(-limb.crankArm, 0, halfW / 2, Math.PI / 2, (3 * Math.PI) / 2, false)
  shape.closePath()
  const pivot = new Shape()
  pivot.absarc(0, 0, LIMB_PIVOT_HOLE_R + clearance, 0, Math.PI * 2, true)
  const pin = new Shape()
  pin.absarc(-limb.crankArm, 0, LIMB_PIN_HOLE_R + clearance, 0, Math.PI * 2, true)
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
