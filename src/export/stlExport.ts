import { BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Mesh, Object3D, Shape } from 'three'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { AutomatonSpec } from '../model/types'
import { outputChannels } from '../model/types'
import { camOutline } from '../kinematics/camProfile'

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

  // Rocker levers: beam + follower pad, printed flat.
  for (const rocker of mech.rockers) {
    const beam = new BoxGeometry(6, 4, rocker.leverLength + 12)
    const pad = new BoxGeometry(10, 3, rocker.padWidth)
    place(pad, 0, -3.5, rocker.leverLength / 2 + 3)
    parts.push({ name: `rocker-lever-${rocker.id}`, geometry: merge([beam, pad]) })
  }

  // Spinners: keyed drive wheel + spindle assembly (rod, driven disc, platform).
  for (const sp of mech.spinners) {
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
    const driven = new CylinderGeometry(sp.wheelRadius * 0.9, sp.wheelRadius * 0.9, 4, 32)
    driven.rotateX(Math.PI / 2)
    place(driven, 0, 0, 2)
    const platform = new CylinderGeometry(sp.platformRadius, sp.platformRadius, 4, 48)
    platform.rotateX(Math.PI / 2)
    place(platform, 0, 0, spindleLength - 2)
    parts.push({ name: `spinner-spindle-${sp.id}`, geometry: merge([rod, driven, platform]) })
  }

  // Character figure blocks: body + head, printed upright.
  for (const c of spec.characters) {
    const body = new BoxGeometry(c.width, c.depth, c.height)
    place(body, 0, 0, c.height / 2)
    const headSize = c.width * 0.55
    const head = new BoxGeometry(headSize, headSize, headSize)
    place(head, 0, 0, c.height + headSize / 2)
    parts.push({ name: `figure-${c.id}`, geometry: merge([body, head]) })
  }

  return parts
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
