import { useDesignerStore } from '../../model/store'

/** The horizontal drive shaft spanning the box, extended for the crank. */
export function Camshaft() {
  const frame = useDesignerStore((s) => s.spec.frame)
  const mech = useDesignerStore((s) => s.spec.mechanism)
  const overhang = 12
  const length = frame.width + overhang
  return (
    <mesh
      position={[overhang / 2, mech.shaftHeight, 0]}
      rotation-z={Math.PI / 2}
    >
      <cylinderGeometry args={[mech.shaftDiameter / 2, mech.shaftDiameter / 2, length, 24]} />
      <meshStandardMaterial color="#8d6e63" />
    </mesh>
  )
}
