import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ExtrudeGeometry, Shape, type Group } from 'three'
import type { ChannelSignal } from '../../kinematics/channels'
import { channelValue } from '../../kinematics/channels'
import { gearOutline } from '../../kinematics/gearProfile'
import { useDesignerStore } from '../../model/store'
import {
  bevelMeshY,
  contactOffset,
  CROWN_DISC_THICKNESS,
  CROWN_TOOTH_LENGTH,
  crownPitchRadius,
  crownPlaneOffset,
  DISC_THICKNESS,
  drivenDiscRadius,
  PINION_THICKNESS,
  SPINDLE_RADIUS,
} from '../spinnerLayout'

/**
 * Vertical spindle drive, in either style:
 *
 *  - friction: wheel on the camshaft rubs the driven disc OFF-AXIS
 *    (contact radius realises the ratio)
 *  - bevel: crown gear on the camshaft meshes a horizontal pinion at the
 *    spindle base; the spindle axis sits one pinion pitch radius from the
 *    crown plane, the mesh one crown pitch radius above the shaft, and
 *    the ratio is crownTeeth / pinionTeeth by construction
 */
export function Spinner({ signal }: { signal: ChannelSignal & { kind: 'spin' } }) {
  const frame = useDesignerStore((s) => s.spec.frame)
  const shaftHeight = useDesignerStore((s) => s.spec.mechanism.shaftHeight)
  const driveRef = useRef<Group>(null)
  const spindle = useRef<Group>(null)
  const { channel } = signal
  const spinner = channel.spinner

  const stageTop = frame.height + frame.materialThickness
  const platformY = stageTop + 8

  useFrame(() => {
    const theta = useDesignerStore.getState().crankAngle
    if (driveRef.current) driveRef.current.rotation.x = theta
    if (spindle.current)
      spindle.current.rotation.y = (channelValue(signal, theta) * Math.PI) / 180
  })

  const isBevel = spinner.drive === 'bevel'

  const pinionGeo = useMemo(() => {
    if (!isBevel) return null
    const pts = gearOutline(spinner.pinionTeeth!, spinner.module!)
    const shape = new Shape()
    shape.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y)
    shape.closePath()
    const geo = new ExtrudeGeometry(shape, { depth: PINION_THICKNESS, bevelEnabled: false })
    geo.translate(0, 0, -PINION_THICKNESS / 2)
    geo.rotateX(-Math.PI / 2) // lie horizontal, spin about Y
    return geo
  }, [isBevel, spinner.pinionTeeth, spinner.module])

  if (isBevel) {
    const Rc = crownPitchRadius(spinner)
    const meshY = bevelMeshY(spinner, shaftHeight)
    const crownX = -crownPlaneOffset(spinner) // spindle axis is the group origin
    const teeth = spinner.crownTeeth!
    const toothW = ((2 * Math.PI * Rc) / teeth) * 0.45

    return (
      <group position={[channel.x, 0, 0]}>
        {/* crown gear on the camshaft: disc + axial teeth facing the spindle */}
        <group ref={driveRef} position={[crownX, shaftHeight, 0]}>
          <mesh rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[Rc, Rc, CROWN_DISC_THICKNESS, 40]} />
            <meshStandardMaterial color="#c96f4f" />
          </mesh>
          {Array.from({ length: teeth }, (_, i) => {
            const a = (i / teeth) * Math.PI * 2
            return (
              <mesh
                key={i}
                position={[
                  CROWN_DISC_THICKNESS / 2 + CROWN_TOOTH_LENGTH / 2,
                  (Rc - 2) * Math.cos(a),
                  (Rc - 2) * Math.sin(a),
                ]}
                rotation-x={a}
              >
                <boxGeometry args={[CROWN_TOOTH_LENGTH, 4, toothW]} />
                <meshStandardMaterial color="#c96f4f" />
              </mesh>
            )
          })}
        </group>
        {/* vertical spindle: pinion at the mesh height, rod, platform */}
        <group ref={spindle}>
          {pinionGeo && (
            <mesh geometry={pinionGeo} position={[0, meshY, 0]}>
              <meshStandardMaterial color="#4f9fc9" />
            </mesh>
          )}
          <mesh position={[0, (meshY + platformY) / 2, 0]}>
            <cylinderGeometry
              args={[SPINDLE_RADIUS, SPINDLE_RADIUS, platformY - meshY, 16]}
            />
            <meshStandardMaterial color="#8d6e63" />
          </mesh>
          <mesh position={[0, platformY, 0]}>
            <cylinderGeometry
              args={[spinner.platformRadius, spinner.platformRadius, DISC_THICKNESS, 40]}
            />
            <meshStandardMaterial color="#c9a06a" />
          </mesh>
        </group>
      </group>
    )
  }

  // friction drive
  const wheelX = -contactOffset(spinner)
  const discRadius = drivenDiscRadius(spinner)
  const discY = shaftHeight + spinner.wheelRadius + DISC_THICKNESS / 2

  return (
    <group position={[channel.x, 0, 0]}>
      <mesh ref={driveRef as never} position={[wheelX, shaftHeight, 0]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[spinner.wheelRadius, spinner.wheelRadius, 8, 32]} />
        <meshStandardMaterial color="#5a8296" />
      </mesh>
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
            args={[spinner.platformRadius, spinner.platformRadius, DISC_THICKNESS, 40]}
          />
          <meshStandardMaterial color="#c9a06a" />
        </mesh>
      </group>
    </group>
  )
}
