import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { ChannelSignal } from '../../kinematics/channels'
import { sampleDisplacement } from '../../kinematics/follower'
import { useDesignerStore } from '../../model/store'

const PAD_THICKNESS = 4

/**
 * Vertical pushrod with its flat follower pad — the physical carrier of
 * one output channel through the stage guide slot.
 */
export function Pushrod({ signal }: { signal: ChannelSignal & { kind: 'lift' } }) {
  const shaftHeight = useDesignerStore((s) => s.spec.mechanism.shaftHeight)
  const group = useRef<Group>(null)
  const { channel, table } = signal
  const { rodWidth, padWidth, length } = channel.pushrod

  useFrame(() => {
    if (!group.current) return
    const theta = useDesignerStore.getState().crankAngle
    group.current.position.y = shaftHeight + sampleDisplacement(table, theta)
  })

  return (
    <group ref={group} position={[channel.x, shaftHeight, 0]}>
      {/* flat follower pad resting on the cam; its width spans world Z,
          matching the cam profile plane */}
      <mesh position={[0, PAD_THICKNESS / 2, 0]}>
        <boxGeometry args={[channel.cam.thickness + 2, PAD_THICKNESS, padWidth]} />
        <meshStandardMaterial color="#9c8060" />
      </mesh>
      <mesh position={[0, PAD_THICKNESS + length / 2, 0]}>
        <boxGeometry args={[rodWidth, length, rodWidth]} />
        <meshStandardMaterial color="#b59775" />
      </mesh>
    </group>
  )
}
