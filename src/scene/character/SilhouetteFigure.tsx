import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ExtrudeGeometry, Shape, type Group } from 'three'
import type { CharacterSpec } from '../../model/types'
import { camShaftY } from '../../model/types'
import type { ChannelSignal } from '../../kinematics/channels'
import { channelValue } from '../../kinematics/channels'
import { samplePath } from '../../kinematics/linkage'
import { DEFAULT_FIGURE_SHAPE, figureOutline } from '../../model/figures'
import { HINGE_HEIGHT } from '../figureLayout'
import { useDesignerStore } from '../../model/store'

const PAD_THICKNESS = 4
/** Cut/print thickness of the silhouette plate (one sheet). */
export const SILHOUETTE_THICKNESS = 4

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
    const pts = figureOutline(shapeId, width, height)
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
  }, [shapeId, width, height])

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

  const plate = (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} />
    </mesh>
  )

  if (signal.kind === 'tilt') {
    const hingeZ = depth / 2 - 2
    return (
      <group position={[channel.x, 0, zOffset]}>
        <mesh position={[0, stageTop + HINGE_HEIGHT / 2, hingeZ]}>
          <boxGeometry args={[width * 0.6, HINGE_HEIGHT, 5]} />
          <meshStandardMaterial color="#3a2d1c" />
        </mesh>
        <group ref={group} position={[0, stageTop + HINGE_HEIGHT, hingeZ]}>
          <group position={[0, 0, -hingeZ]}>{plate}</group>
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
