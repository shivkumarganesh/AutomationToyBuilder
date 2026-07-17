import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { CharacterSpec } from '../../model/types'
import type { ChannelSignal } from '../../kinematics/channels'
import { sampleDisplacement } from '../../kinematics/follower'
import { useDesignerStore } from '../../model/store'

const PAD_THICKNESS = 4

/**
 * A character-zone figure block riding an output channel. It knows nothing
 * about cams — only the channel signal it is bound to.
 */
export function FigureBlock({
  character,
  signal,
  zOffset = 0,
}: {
  character: CharacterSpec
  signal: ChannelSignal
  zOffset?: number
}) {
  const shaftHeight = useDesignerStore((s) => s.spec.mechanism.shaftHeight)
  const group = useRef<Group>(null)
  const { channel, table } = signal
  const rodTopOffset = PAD_THICKNESS + channel.pushrod.length

  useFrame(() => {
    if (!group.current) return
    const theta = useDesignerStore.getState().crankAngle
    group.current.position.y = shaftHeight + sampleDisplacement(table, theta) + rodTopOffset
  })

  const { width, height, depth, color } = character
  return (
    <group ref={group} position={[channel.x, 0, zOffset]}>
      {/* body */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* head — keeps the unpainted block reading as a figure */}
      <mesh position={[0, height + width * 0.28, 0]}>
        <boxGeometry args={[width * 0.55, width * 0.55, width * 0.55]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}
