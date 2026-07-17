import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ExtrudeGeometry, Shape, type Group } from 'three'
import type { CamSpec } from '../../model/types'
import { camOutline } from '../../kinematics/camProfile'
import { useDesignerStore } from '../../model/store'

const CAM_COLORS: Record<CamSpec['kind'], string> = {
  eccentric: '#e0b64f',
  petal: '#4fb06a',
  snail: '#b04f9e',
}

/**
 * One cam disc on the shaft. The extruded profile is the same sampled
 * outline the follower solver and the SVG export use, so what you see is
 * exactly what gets cut.
 */
export function Cam({ cam, x }: { cam: CamSpec; x: number }) {
  const shaftHeight = useDesignerStore((s) => s.spec.mechanism.shaftHeight)
  const group = useRef<Group>(null)
  const phase = (cam.phaseDeg * Math.PI) / 180

  const geometry = useMemo(() => {
    const pts = camOutline(cam, 128)
    const shape = new Shape()
    shape.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y)
    shape.closePath()
    const geo = new ExtrudeGeometry(shape, { depth: cam.thickness, bevelEnabled: false })
    geo.translate(0, 0, -cam.thickness / 2)
    return geo
  }, [cam])

  useFrame(() => {
    if (group.current)
      group.current.rotation.x = useDesignerStore.getState().crankAngle + phase
  })

  return (
    <group position={[x, shaftHeight, 0]}>
      <group ref={group}>
        {/* rotation-y maps the profile plane onto world YZ so that a +X
            spin matches the kinematics' theta exactly */}
        <group rotation-y={Math.PI / 2}>
          <mesh geometry={geometry}>
            <meshStandardMaterial color={CAM_COLORS[cam.kind]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
