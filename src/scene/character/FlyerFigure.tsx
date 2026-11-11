import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ExtrudeGeometry, Shape, type Group } from 'three'
import type { CharacterSpec } from '../../model/types'
import type { Point2 } from '../../model/figures'
import type { ChannelSignal } from '../../kinematics/channels'
import {
  FLYER_POST_WIDTH,
  flyerAngles,
  flyerBodyOutline,
  flyerGeometry,
  flyerPostHeight,
  flyerWingPlate,
  type FlyerSide,
} from '../flyerLayout'
import { useDesignerStore } from '../../model/store'

/** Extrude a top-view outline (x across, y along the body) into a level plate. */
function plateGeometry(pts: Point2[], thickness: number): ExtrudeGeometry {
  const shape = new Shape()
  shape.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y)
  shape.closePath()
  const geo = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  // shape y → world +Z (nose towards the viewer); the extrusion then runs
  // downwards, so lift it to sit ON the hinge plane y = 0
  geo.rotateX(Math.PI / 2)
  geo.translate(0, thickness, 0)
  return geo
}

function darker(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.round(v * 0.72)
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`
}

/**
 * A flyer: body plate level on its post, wing plates hinged in a chain
 * each side, every plate resting on its own pushrod tip. Angles come
 * straight from flyerAngles — the same solve the tests validate.
 */
export function FlyerFigure({
  character,
  signals,
}: {
  character: CharacterSpec
  signals: ChannelSignal[]
}) {
  const spec = useDesignerStore((s) => s.spec)
  const t = spec.frame.materialThickness
  const geo = useMemo(() => flyerGeometry(spec, character, signals), [spec, character, signals])
  const refs = useRef<Record<string, Group | null>>({})

  const meshes = useMemo(() => {
    if (!geo) return null
    const wing = (side: FlyerSide) =>
      side.hinges.map((h, i) => {
        const pts = flyerWingPlate(character, side, i).map((p) => ({
          // plate-local: measured from this plate's own hinge, mirrored for the left wing
          x: side.sign * (p.x - h),
          y: p.y,
        }))
        return plateGeometry(pts, t)
      })
    return {
      body: plateGeometry(flyerBodyOutline(character), t),
      left: wing(geo.left),
      right: wing(geo.right),
    }
  }, [geo, character, t])

  useFrame(() => {
    if (!geo) return
    const theta = useDesignerStore.getState().crankAngle
    for (const side of [geo.left, geo.right]) {
      const key = side.sign < 0 ? 'L' : 'R'
      const a = flyerAngles(spec, geo, side, theta)
      const root = refs.current[`${key}0`]
      if (root) root.rotation.z = side.sign * a[0]
      const outer = refs.current[`${key}1`]
      if (outer && a.length > 1) outer.rotation.z = side.sign * (a[1] - a[0])
    }
  })

  if (!geo || !meshes) return null
  const stageTop = spec.frame.height + t
  const postH = flyerPostHeight(spec, geo)
  const wingColor = character.color
  const bodyColor = darker(character.color)

  const wingGroup = (side: FlyerSide, plates: ExtrudeGeometry[]) => {
    const key = side.sign < 0 ? 'L' : 'R'
    return (
      <group
        ref={(g) => {
          refs.current[`${key}0`] = g
        }}
        position={[side.hingeX, geo.axisY, 0]}
      >
        <mesh geometry={plates[0]}>
          <meshStandardMaterial color={wingColor} />
        </mesh>
        {plates.length > 1 && (
          <group
            ref={(g) => {
              refs.current[`${key}1`] = g
            }}
            position={[side.sign * side.hinges[1], 0, 0]}
          >
            <mesh geometry={plates[1]}>
              <meshStandardMaterial color={wingColor} />
            </mesh>
          </group>
        )}
      </group>
    )
  }

  return (
    <group>
      {/* fixed post: a plate standing in the body's own plane */}
      <mesh position={[geo.xc, stageTop + postH / 2, 0]}>
        <boxGeometry args={[t, postH, FLYER_POST_WIDTH]} />
        <meshStandardMaterial color="#a87f4f" />
      </mesh>
      <mesh geometry={meshes.body} position={[geo.xc, geo.axisY, 0]}>
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      {wingGroup(geo.left, meshes.left)}
      {wingGroup(geo.right, meshes.right)}
    </group>
  )
}
