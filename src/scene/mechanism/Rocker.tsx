import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'
import type { ChannelSignal } from '../../kinematics/channels'
import { displacementTable, sampleDisplacement } from '../../kinematics/follower'
import { camAngularRate, camShaftY } from '../../model/types'
import { useDesignerStore } from '../../model/store'
import { BEAM_THICKNESS, PAD_THICKNESS, rockerAngle, rockerPivotY } from '../rockerLayout'

/**
 * Pivoted lever riding its cam: fulcrum post at the back, follower pad
 * resting on the cam surface at the front, and a vertical link rod from
 * the beam's follower end up through the stage to the nodding figure —
 * the tilt output channel, with every joint visibly connected.
 */
export function Rocker({ signal }: { signal: ChannelSignal & { kind: 'tilt' } }) {
  const frame = useDesignerStore((s) => s.spec.frame)
  const mech = useDesignerStore((s) => s.spec.mechanism)
  const beam = useRef<Group>(null)
  const link = useRef<Mesh>(null)
  const { channel } = signal
  const { leverLength, padWidth } = channel.rocker
  const shaftHeight = camShaftY(mech, channel.cam)

  // lift table of the underlying cam follower — sets the true contact height
  const liftTable = useMemo(
    () => displacementTable(channel.cam, padWidth, camAngularRate(mech, channel.cam)),
    [channel.cam, padWidth, mech],
  )
  const pivotY = rockerPivotY(liftTable, shaftHeight)
  const stageTop = frame.height + frame.materialThickness
  const linkTopY = stageTop + 6 // meets the figure's underside above the stage

  useFrame(() => {
    const theta = useDesignerStore.getState().crankAngle
    const s = sampleDisplacement(liftTable, theta)
    const angle = rockerAngle(liftTable, leverLength, s)
    if (beam.current) beam.current.rotation.x = -angle
    if (link.current) {
      // the link hangs from the figure down to the beam's follower end
      const beamEndY = pivotY + Math.sin(angle) * leverLength
      link.current.position.y = (beamEndY + linkTopY) / 2
      link.current.scale.y = Math.max(linkTopY - beamEndY, 1)
    }
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
          <boxGeometry args={[6, BEAM_THICKNESS, leverLength + 10]} />
          <meshStandardMaterial color="#9c8060" />
        </mesh>
        {/* follower pad resting on the cam surface */}
        <mesh position={[0, -(BEAM_THICKNESS + PAD_THICKNESS) / 2, leverLength]}>
          <boxGeometry args={[channel.cam.thickness + 2, PAD_THICKNESS, padWidth]} />
          <meshStandardMaterial color="#9c8060" />
        </mesh>
      </group>
      {/* link rod: beam end → through the stage → figure (unit height, scaled per frame) */}
      <mesh ref={link} position={[0, (pivotY + linkTopY) / 2, 0]}>
        <cylinderGeometry args={[1.6, 1.6, 1, 12]} />
        <meshStandardMaterial color="#b59775" />
      </mesh>
    </group>
  )
}
