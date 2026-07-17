import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { ChannelSignal } from '../../kinematics/channels'
import { channelValue } from '../../kinematics/channels'
import { camMaxRadius } from '../../model/types'
import { useDesignerStore } from '../../model/store'

/**
 * Pivoted lever riding its cam: the follower end rests on the cam, the
 * pivot post stands one lever-length behind it (along Z), and the whole
 * beam rocks as the cam turns — the tilt output channel.
 */
export function Rocker({ signal }: { signal: ChannelSignal & { kind: 'tilt' } }) {
  const shaftHeight = useDesignerStore((s) => s.spec.mechanism.shaftHeight)
  const beam = useRef<Group>(null)
  const { channel } = signal
  const { leverLength, padWidth } = channel.rocker
  const pivotY = shaftHeight + camMaxRadius(channel.cam) + 5

  useFrame(() => {
    if (!beam.current) return
    const theta = useDesignerStore.getState().crankAngle
    const tiltRad = (channelValue(signal, theta) * Math.PI) / 180
    beam.current.rotation.x = -tiltRad
  })

  return (
    <group position={[channel.x, 0, 0]}>
      {/* fulcrum post */}
      <mesh position={[0, pivotY / 2, -leverLength]}>
        <boxGeometry args={[6, pivotY, 6]} />
        <meshStandardMaterial color="#7a6248" />
      </mesh>
      {/* rocking beam, pivoted at the post top; follower end over the cam */}
      <group ref={beam} position={[0, pivotY, -leverLength]}>
        <mesh position={[0, 0, leverLength / 2]}>
          <boxGeometry args={[6, 4, leverLength + 10]} />
          <meshStandardMaterial color="#9c8060" />
        </mesh>
        {/* follower pad resting on the cam */}
        <mesh position={[0, -3, leverLength]}>
          <boxGeometry args={[channel.cam.thickness + 2, 3, padWidth]} />
          <meshStandardMaterial color="#9c8060" />
        </mesh>
      </group>
    </group>
  )
}
