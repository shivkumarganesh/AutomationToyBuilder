import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ExtrudeGeometry, Shape, type Group } from 'three'
import type { GearTrainSpec } from '../../model/types'
import { layshaftY } from '../../model/types'
import { gearAngles, gearOutline } from '../../kinematics/gearProfile'
import { useDesignerStore } from '../../model/store'

const GEAR_THICKNESS = 6

function gearGeometry(teeth: number, module: number) {
  const pts = gearOutline(teeth, module)
  const shape = new Shape()
  shape.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y)
  shape.closePath()
  const geo = new ExtrudeGeometry(shape, { depth: GEAR_THICKNESS, bevelEnabled: false })
  geo.translate(0, 0, -GEAR_THICKNESS / 2)
  return geo
}

/**
 * The spur gear pair and its layshaft. Centre distance, ratio, and tooth
 * phase all come from gearProfile/types helpers — the mesh is correct by
 * construction and the same outlines go to the exports.
 */
export function GearTrain({ gear, x }: { gear: GearTrainSpec; x: number }) {
  const mech = useDesignerStore((s) => s.spec.mechanism)
  const frame = useDesignerStore((s) => s.spec.frame)
  const drive = useRef<Group>(null)
  const driven = useRef<Group>(null)

  const layY = layshaftY(mech)
  const driveGeo = useMemo(() => gearGeometry(gear.teethDrive, gear.module), [gear.teethDrive, gear.module])
  const drivenGeo = useMemo(() => gearGeometry(gear.teethDriven, gear.module), [gear.teethDriven, gear.module])

  useFrame(() => {
    const theta = useDesignerStore.getState().crankAngle
    const angles = gearAngles(gear, theta)
    if (drive.current) drive.current.rotation.x = angles.drive
    if (driven.current) driven.current.rotation.x = angles.driven
  })

  return (
    <group>
      {/* drive gear on the crankshaft */}
      <group position={[x, mech.shaftHeight, 0]}>
        <group ref={drive}>
          <group rotation-y={Math.PI / 2}>
            <mesh geometry={driveGeo}>
              <meshStandardMaterial color="#c96f4f" />
            </mesh>
          </group>
        </group>
      </group>
      {/* driven gear on the layshaft, one centre distance below */}
      <group position={[x, layY, 0]}>
        <group ref={driven}>
          <group rotation-y={Math.PI / 2}>
            <mesh geometry={drivenGeo}>
              <meshStandardMaterial color="#4f9fc9" />
            </mesh>
          </group>
        </group>
      </group>
      {/* the layshaft itself, spanning the box on its own wall bearings */}
      <mesh position={[0, layY, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[mech.shaftDiameter / 2, mech.shaftDiameter / 2, frame.width, 24]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      {[-(frame.width - frame.materialThickness) / 2, (frame.width - frame.materialThickness) / 2].map(
        (bx) => (
          <mesh key={bx} position={[bx, layY, 0]} rotation-y={Math.PI / 2}>
            <torusGeometry args={[mech.shaftDiameter / 2 + 1, 1, 12, 32]} />
            <meshStandardMaterial color="#3a2d1c" />
          </mesh>
        ),
      )}
    </group>
  )
}
