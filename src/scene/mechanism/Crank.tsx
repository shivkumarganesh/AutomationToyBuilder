import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { useDesignerStore } from '../../model/store'

/**
 * Hand crank on the right side of the box. Its rotation IS the crank angle
 * — every cam and channel derives from it.
 */
export function Crank() {
  const frame = useDesignerStore((s) => s.spec.frame)
  const mech = useDesignerStore((s) => s.spec.mechanism)
  const group = useRef<Group>(null)

  useFrame(() => {
    if (group.current) group.current.rotation.x = useDesignerStore.getState().crankAngle
  })

  const { armLength, handleLength, handleDiameter } = mech.crank
  const armThickness = 6
  const x = frame.width / 2 + 12

  return (
    <group ref={group} position={[x, mech.shaftHeight, 0]}>
      {/* arm from shaft to handle; rotated group spins about world X */}
      <group rotation-y={Math.PI / 2}>
        <mesh position={[0, armLength / 2, 0]}>
          <boxGeometry args={[armThickness, armLength + armThickness, armThickness]} />
          <meshStandardMaterial color="#6d4c41" />
        </mesh>
      </group>
      {/* grip cylinder pointing outward along +X at the arm tip */}
      <group rotation-y={Math.PI / 2}>
        <mesh position={[0, armLength, 0]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[handleDiameter / 2, handleDiameter / 2, handleLength, 20]} />
          <meshStandardMaterial color="#d84f43" />
        </mesh>
      </group>
    </group>
  )
}
