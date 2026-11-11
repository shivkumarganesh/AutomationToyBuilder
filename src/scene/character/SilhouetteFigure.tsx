import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape, type Group } from 'three'
import type { CharacterSpec } from '../../model/types'
import { camShaftY } from '../../model/types'
import type { ChannelSignal } from '../../kinematics/channels'
import { channelValue } from '../../kinematics/channels'
import { samplePath } from '../../kinematics/linkage'
import {
  DEFAULT_FIGURE_SHAPE,
  figureEngraving,
  figureLayers,
  characterOutline,
} from '../../model/figures'
import { HINGE_HEIGHT } from '../figureLayout'
import { useDesignerStore } from '../../model/store'

const PAD_THICKNESS = 4
/** Cut/print thickness of the silhouette plate (one sheet). */
export const SILHOUETTE_THICKNESS = 4

/** Thickness of a glued-on detail plate (one sheet). */
const LAYER_THICKNESS = 3

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
  const { width, height, depth, color } = character
  const shapeId = character.shape ?? DEFAULT_FIGURE_SHAPE

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

  // raised detail plates, one on each face, and the engraved lines
  const detail = useMemo(() => {
    const plates = figureLayers(shapeId, width, height).map((pts) => {
      const shape = new Shape()
      shape.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y)
      shape.closePath()
      return new ExtrudeGeometry(shape, { depth: LAYER_THICKNESS, bevelEnabled: false })
    })
    const positions: number[] = []
    for (const z of [SILHOUETTE_THICKNESS / 2 + 0.06, -SILHOUETTE_THICKNESS / 2 - 0.06]) {
      for (const line of figureEngraving(shapeId, width, height)) {
        for (let i = 0; i + 1 < line.length; i++) {
          positions.push(line[i].x, line[i].y, z, line[i + 1].x, line[i + 1].y, z)
        }
      }
    }
    const lines = new BufferGeometry()
    lines.setAttribute('position', new Float32BufferAttribute(positions, 3))
    return { plates, lines, hasLines: positions.length > 0 }
  }, [shapeId, width, height])

  const plate = (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={color} />
      </mesh>
      {detail.plates.map((geo, i) => (
        <group key={i}>
          <mesh geometry={geo} position={[0, 0, SILHOUETTE_THICKNESS / 2]}>
            <meshStandardMaterial color={shade(color)} />
          </mesh>
          <mesh geometry={geo} position={[0, 0, -SILHOUETTE_THICKNESS / 2 - LAYER_THICKNESS]}>
            <meshStandardMaterial color={shade(color)} />
          </mesh>
        </group>
      ))}
      {detail.hasLines && (
        <lineSegments geometry={detail.lines}>
          <lineBasicMaterial color="#2b1a0e" transparent opacity={0.75} />
        </lineSegments>
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
