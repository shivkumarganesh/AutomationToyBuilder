import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { CharacterSpec } from '../../model/types'
import type { ChannelSignal } from '../../kinematics/channels'
import { channelValue } from '../../kinematics/channels'
import { useDesignerStore } from '../../model/store'

const PAD_THICKNESS = 4

/**
 * A character-zone figure riding an output channel. It knows nothing
 * about cams — only the channel signal it is bound to, and the motion
 * kind that signal carries:
 *
 *  - lift: rides its pushrod up and down
 *  - tilt: nods around its base on a rocking post above the stage
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
  const shaftHeight = useDesignerStore((s) => s.spec.mechanism.shaftHeight)
  const group = useRef<Group>(null)
  const { channel } = signal
  const stageTop = frame.height + frame.materialThickness

  useFrame(() => {
    if (!group.current) return
    const theta = useDesignerStore.getState().crankAngle
    const value = channelValue(signal, theta)
    switch (signal.kind) {
      case 'lift': {
        const rodTopOffset = PAD_THICKNESS + signal.channel.pushrod.length
        group.current.position.y = shaftHeight + value + rodTopOffset
        break
      }
      case 'tilt':
        group.current.position.y = stageTop + 2
        group.current.rotation.x = (-value * Math.PI) / 180
        break
      case 'spin':
        group.current.position.y = stageTop + 10
        group.current.rotation.y = (value * Math.PI) / 180
        break
    }
  })

  const { width, height, depth, color } = character
  // spin figures stand off-centre on the platform so they orbit
  const spinOffset =
    signal.kind === 'spin' ? Math.max(0, signal.channel.spinner.platformRadius - width) : 0

  return (
    <group ref={group} position={[channel.x, 0, zOffset]}>
      <group position={[spinOffset, 0, 0]}>
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
    </group>
  )
}
