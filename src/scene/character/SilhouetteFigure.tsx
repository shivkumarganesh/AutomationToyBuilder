import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, ExtrudeGeometry, Shape, type Group } from 'three'
import type { CharacterSpec } from '../../model/types'
import { camShaftY } from '../../model/types'
import type { ChannelSignal } from '../../kinematics/channels'
import { channelValue } from '../../kinematics/channels'
import { samplePath } from '../../kinematics/linkage'
import { characterOutline } from '../../model/figures'
import { centreOf } from '../../model/relief'
import { domeHeightAt, figureStack, stackDome } from '../reliefLayout'
import { BURNT, ribbonGeometry, SCORCH_WIDTH, SCORE_WIDTH } from '../ribbons'
import { useUiStore } from '../../ui/uiStore'
import { HINGE_HEIGHT } from '../figureLayout'
import { useDesignerStore } from '../../model/store'

const PAD_THICKNESS = 4
/** Cut/print thickness of the silhouette plate (one sheet). */
export const SILHOUETTE_THICKNESS = 4

/** Thickness of a glued-on depth or detail plate (one sheet). */
const LAYER_THICKNESS = 3
/** Height of a printed detail above its surface. */
const PRINT_RELIEF = 1.2

/** A slightly deeper tone of a colour, for raised detail. */
function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.round(v * 0.8)
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`
}

/**
 * A flat silhouette figure from the curated library, standing upright
 * facing the viewer and riding its channel exactly like a block:
 * lift bobs it, tilt nods it on a hinge stand, spin carries it around
 * the platform, path swoops it on the linkage wand. Same one motion
 * contract, recognisable character.
 */
export function SilhouetteFigure({
  character,
  signal,
  zOffset = 0,
}: {
  character: CharacterSpec
  signal: ChannelSignal
  zOffset?: number
}) {
  const frame = useDesignerStore((s) => s.spec.frame)
  const mech = useDesignerStore((s) => s.spec.mechanism)
  const group = useRef<Group>(null)
  const { channel } = signal
  const stageTop = frame.height + frame.materialThickness
  const { width, depth, color } = character

  const geometry = useMemo(() => {
    const pts = characterOutline(character)
    const shape = new Shape()
    shape.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y)
    shape.closePath()
    const geo = new ExtrudeGeometry(shape, {
      depth: SILHOUETTE_THICKNESS,
      bevelEnabled: false,
    })
    // centre the plate thickness on the figure plane
    geo.translate(0, 0, -SILHOUETTE_THICKNESS / 2)
    return geo
  }, [character])

  useFrame(() => {
    if (!group.current) return
    const theta = useDesignerStore.getState().crankAngle
    const value = channelValue(signal, theta)
    switch (signal.kind) {
      case 'lift': {
        const rodTopOffset = PAD_THICKNESS + signal.channel.pushrod.length
        group.current.position.y = camShaftY(mech, signal.channel.cam) + value + rodTopOffset
        break
      }
      case 'tilt':
        group.current.rotation.x = (value * Math.PI) / 180
        break
      case 'spin':
        group.current.rotation.y = (value * Math.PI) / 180
        break
      case 'path': {
        const p = samplePath(signal.table, theta)
        group.current.position.y = mech.shaftHeight + p.v
        group.current.position.z = p.u + zOffset
        group.current.rotation.x = -(p.pitchDeg * Math.PI) / 180
        break
      }
    }
  })

  // everything on the faces: depth levels (stepped plates for the laser
  // route, a smooth dome for the print route), the detail plates and the
  // engraved lines — each sitting on the level under it, on both faces
  const method = useUiStore((s) => s.method)
  const detail = useMemo(() => {
    const stack = figureStack(character)
    const half = SILHOUETTE_THICKNESS / 2
    const extrude = (pts: { x: number; y: number }[], depth: number) => {
      const shape = new Shape()
      shape.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y)
      shape.closePath()
      return new ExtrudeGeometry(shape, { depth, bevelEnabled: false })
    }
    const plates: { geo: ExtrudeGeometry; z: number; depth: number; detail: boolean }[] = []
    let heightOf: (pt: { x: number; y: number }, level: number) => number
    if (method === 'print') {
      const dome = stackDome(stack, character, LAYER_THICKNESS)
      for (const slice of dome)
        for (const o of slice.outlines)
          plates.push({ geo: extrude(o, slice.to - slice.from), z: slice.from, depth: slice.to - slice.from, detail: false })
      heightOf = (pt) => domeHeightAt(dome, pt)
    } else {
      stack.levels.forEach((level, k) =>
        level.forEach((o) =>
          plates.push({ geo: extrude(o, LAYER_THICKNESS), z: k * LAYER_THICKNESS, depth: LAYER_THICKNESS, detail: false }),
        ),
      )
      heightOf = (_pt, level) => level * LAYER_THICKNESS
    }
    const detailDepth = method === 'print' ? PRINT_RELIEF : LAYER_THICKNESS
    for (const d of stack.details)
      plates.push({ geo: extrude(d.item, detailDepth), z: heightOf(centreOf(d.item), d.level), depth: detailDepth, detail: true })
    // scored lines exist only on the laser route (the print file carries none)
    const lines =
      method === 'print'
        ? []
        : stack.engraving.map((e) => ({ line: e.item, lift: half + e.level * LAYER_THICKNESS + 0.06 }))
    const both = (width: number) =>
      [1, -1].map((face) => ribbonGeometry(lines, width, (pt, lift) => [pt.x, pt.y, face * lift]))
    return { plates, score: both(SCORE_WIDTH), scorch: both(SCORCH_WIDTH) }
  }, [character, method])

  const half = SILHOUETTE_THICKNESS / 2
  const plate = (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={color} />
      </mesh>
      {detail.plates.map((pl, i) => (
        <group key={i}>
          <mesh geometry={pl.geo} position={[0, 0, half + pl.z]}>
            <meshStandardMaterial color={pl.detail ? shade(color) : color} />
          </mesh>
          <mesh geometry={pl.geo} position={[0, 0, -half - pl.z - pl.depth]}>
            <meshStandardMaterial color={pl.detail ? shade(color) : color} />
          </mesh>
        </group>
      ))}
      {detail.scorch.map(
        (geo, i) =>
          geo && (
            <mesh key={`h${i}`} geometry={geo}>
              <meshBasicMaterial color={BURNT} transparent opacity={0.16} side={DoubleSide} depthWrite={false} />
            </mesh>
          ),
      )}
      {detail.score.map(
        (geo, i) =>
          geo && (
            <mesh key={`s${i}`} geometry={geo}>
              <meshBasicMaterial color={BURNT} transparent opacity={0.88} side={DoubleSide} />
            </mesh>
          ),
      )}
    </group>
  )

  if (signal.kind === 'tilt') {
    const hingeZ = depth / 2 - 2
    // plate turned into the nod plane (Z-Y): the profile's +x points at
    // the hinge, so the tilt reads as a peck in the figure's own plane
    return (
      <group position={[channel.x, 0, zOffset]}>
        <mesh position={[0, stageTop + HINGE_HEIGHT / 2, hingeZ]}>
          <boxGeometry args={[10, HINGE_HEIGHT, 5]} />
          <meshStandardMaterial color="#3a2d1c" />
        </mesh>
        <group ref={group} position={[0, stageTop + HINGE_HEIGHT, hingeZ]}>
          <group position={[0, 0, -hingeZ]} rotation-y={-Math.PI / 2}>
            {plate}
          </group>
        </group>
      </group>
    )
  }

  if (signal.kind === 'spin') {
    // stand off-centre so the silhouette orbits the spindle, profile out
    const spinOffset = Math.max(0, signal.channel.spinner.platformRadius - width * 0.7)
    return (
      <group ref={group} position={[channel.x, stageTop + 10, zOffset]}>
        <group position={[spinOffset, 0, 0]} rotation-y={Math.PI / 2}>
          {plate}
        </group>
      </group>
    )
  }

  return (
    <group ref={group} position={[channel.x, 0, zOffset]}>
      {plate}
    </group>
  )
}
