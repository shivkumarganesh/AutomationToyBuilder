import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'
import type { ChannelSignal } from '../../kinematics/channels'
import { channelValue } from '../../kinematics/channels'
import { useDesignerStore } from '../../model/store'

const SPINDLE_RADIUS = 3
const DISC_THICKNESS = 4

/**
 * Friction drive: a wheel on the camshaft rubs a horizontal disc at the
 * base of a vertical spindle, which carries a platform up through the
 * stage — the spin output channel.
 */
export function Spinner({ signal }: { signal: ChannelSignal & { kind: 'spin' } }) {
  const frame = useDesignerStore((s) => s.spec.frame)
  const shaftHeight = useDesignerStore((s) => s.spec.mechanism.shaftHeight)
  const wheel = useRef<Mesh>(null)
  const spindle = useRef<Group>(null)
  const { channel } = signal
  const { wheelRadius, platformRadius } = channel.spinner

  const discY = shaftHeight + wheelRadius + DISC_THICKNESS / 2
  const stageTop = frame.height + frame.materialThickness
  const platformY = stageTop + 8

  useFrame(() => {
    const theta = useDesignerStore.getState().crankAngle
    if (wheel.current) wheel.current.rotation.x = theta
    if (spindle.current)
      spindle.current.rotation.y = (channelValue(signal, theta) * Math.PI) / 180
  })

  return (
    <group position={[channel.x, 0, 0]}>
      {/* drive wheel on the camshaft */}
      <mesh ref={wheel} position={[0, shaftHeight, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[wheelRadius, wheelRadius, 8, 32]} />
        <meshStandardMaterial color="#5a8296" />
      </mesh>
      {/* vertical spindle: driven disc + rod + platform, all spinning together */}
      <group ref={spindle}>
        <mesh position={[0, discY, 0]}>
          <cylinderGeometry args={[wheelRadius * 0.9, wheelRadius * 0.9, DISC_THICKNESS, 32]} />
          <meshStandardMaterial color="#96755a" />
        </mesh>
        <mesh position={[0, (discY + platformY) / 2, 0]}>
          <cylinderGeometry args={[SPINDLE_RADIUS, SPINDLE_RADIUS, platformY - discY, 16]} />
          <meshStandardMaterial color="#8d6e63" />
        </mesh>
        <mesh position={[0, platformY, 0]}>
          <cylinderGeometry args={[platformRadius, platformRadius, DISC_THICKNESS, 40]} />
          <meshStandardMaterial color="#c9a06a" />
        </mesh>
      </group>
    </group>
  )
}
