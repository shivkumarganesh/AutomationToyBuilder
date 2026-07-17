import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { CharacterSpec } from '../../model/types'
import type { ChannelSignal } from '../../kinematics/channels'
import { channelValue } from '../../kinematics/channels'
import { camShaftY } from '../../model/types'
import { useDesignerStore } from '../../model/store'

const PAD_THICKNESS = 4
const HINGE_HEIGHT = 4

/**
 * A character-zone figure riding an output channel. It knows nothing
 * about cams — only the channel signal it is bound to, and the motion
 * kind that signal carries:
 *
 *  - lift: rides its pushrod up and down
 *  - tilt: nods on a hinge stand at its front edge, pushed by the rocker's
 *    link rod from below
 *  - spin: rides the carousel platform, orbiting the spindle
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
  const frame = useDesignerStore((s) => s.spec.frame)
  const mech = useDesignerStore((s) => s.spec.mechanism)
  const group = useRef<Group>(null)
  const { channel } = signal
  const stageTop = frame.height + frame.materialThickness
  const { width, height, depth, color } = character

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
        // link up (positive angle) lifts the back edge — the figure tips forward
        group.current.rotation.x = (value * Math.PI) / 180
        break
      case 'spin':
        group.current.rotation.y = (value * Math.PI) / 180
        break
    }
  })

  const body = (
    <>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* head — keeps the unpainted block reading as a figure */}
      <mesh position={[0, height + width * 0.28, 0]}>
        <boxGeometry args={[width * 0.55, width * 0.55, width * 0.55]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </>
  )

  if (signal.kind === 'tilt') {
    const hingeZ = depth / 2 - 2
    return (
      <group position={[channel.x, 0, zOffset]}>
        {/* hinge stand fixed to the stage at the figure's front edge */}
        <mesh position={[0, stageTop + HINGE_HEIGHT / 2, hingeZ]}>
          <boxGeometry args={[width * 0.6, HINGE_HEIGHT, 5]} />
          <meshStandardMaterial color="#3a2d1c" />
        </mesh>
        {/* figure rocks about the hinge axis; the link rod pushes it from below */}
        <group ref={group} position={[0, stageTop + HINGE_HEIGHT, hingeZ]}>
          <group position={[0, 0, -hingeZ]}>{body}</group>
        </group>
      </group>
    )
  }

  if (signal.kind === 'spin') {
    // stand off-centre on the platform so the figure orbits
    const spinOffset = Math.max(0, signal.channel.spinner.platformRadius - width)
    return (
      <group ref={group} position={[channel.x, stageTop + 10, zOffset]}>
        <group position={[spinOffset, 0, 0]}>{body}</group>
      </group>
    )
  }

  return (
    <group ref={group} position={[channel.x, 0, zOffset]}>
      {body}
    </group>
  )
}
