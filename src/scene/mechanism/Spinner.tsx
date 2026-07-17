import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'
import type { ChannelSignal } from '../../kinematics/channels'
import { channelValue } from '../../kinematics/channels'
import { useDesignerStore } from '../../model/store'
import {
  contactOffset,
  DISC_THICKNESS,
  drivenDiscRadius,
  SPINDLE_RADIUS,
  WHEEL_THICKNESS,
} from '../spinnerLayout'

/**
 * Friction drive: a wheel on the camshaft rubs the horizontal driven disc
 * at the base of a vertical spindle. The wheel sits OFFSET along the
 * shaft from the spindle axis — contact at the axis would transmit zero
 * torque — and that contact radius is exactly what realises the spin
 * ratio (ω_out = ω_in · wheelRadius / contactRadius).
 */
export function Spinner({ signal }: { signal: ChannelSignal & { kind: 'spin' } }) {
  const frame = useDesignerStore((s) => s.spec.frame)
  const shaftHeight = useDesignerStore((s) => s.spec.mechanism.shaftHeight)
  const wheel = useRef<Mesh>(null)
  const spindle = useRef<Group>(null)
  const { channel } = signal
  const { wheelRadius } = channel.spinner

  // the wheel's contact plane sits this far from the spindle axis
  const wheelX = -contactOffset(channel.spinner)
  const discRadius = drivenDiscRadius(channel.spinner)

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
      {/* drive wheel on the camshaft, offset so its rim grips the disc off-axis */}
      <mesh ref={wheel} position={[wheelX, shaftHeight, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[wheelRadius, wheelRadius, WHEEL_THICKNESS, 32]} />
        <meshStandardMaterial color="#5a8296" />
      </mesh>
      {/* vertical spindle: driven disc + rod + platform, all spinning together */}
      <group ref={spindle}>
        <mesh position={[0, discY, 0]}>
          <cylinderGeometry args={[discRadius, discRadius, DISC_THICKNESS, 40]} />
          <meshStandardMaterial color="#96755a" />
        </mesh>
        <mesh position={[0, (discY + platformY) / 2, 0]}>
          <cylinderGeometry
            args={[SPINDLE_RADIUS, SPINDLE_RADIUS, platformY - discY, 16]}
          />
          <meshStandardMaterial color="#8d6e63" />
        </mesh>
        <mesh position={[0, platformY, 0]}>
          <cylinderGeometry
            args={[channel.spinner.platformRadius, channel.spinner.platformRadius, DISC_THICKNESS, 40]}
          />
          <meshStandardMaterial color="#c9a06a" />
        </mesh>
      </group>
    </group>
  )
}
