import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape, type Group } from 'three'
import type { CharacterSpec } from '../../model/types'
import type { Point2 } from '../../model/figures'
import type { ChannelSignal } from '../../kinematics/channels'
import {
  FLYER_POST_WIDTH,
  flyerAngles,
  flyerBodyEngraving,
  flyerBodyOutline,
  flyerGeometry,
  flyerHingeLines,
  flyerWingEngraving,
  HINGE_GAP,
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

/** Engraved lines lying on a level plate's top face (same frame as plateGeometry). */
function lineGeometry(lines: Point2[][], thickness: number): BufferGeometry | null {
  const positions: number[] = []
  const y = thickness + 0.06
  for (const line of lines)
    for (let i = 0; i + 1 < line.length; i++)
      positions.push(line[i].x, y, line[i].y, line[i + 1].x, y, line[i + 1].y)
  if (positions.length === 0) return null
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
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
        const ribs = flyerWingEngraving(character, side, i).map((line) =>
          line.map((p) => ({ x: side.sign * (p.x - h), y: p.y })),
        )
        return { plate: plateGeometry(pts, t), ribs: lineGeometry(ribs, t) }
      })
    return {
      body: plateGeometry(flyerBodyOutline(character), t),
      bodyLines: lineGeometry(flyerBodyEngraving(character), t),
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

  const ink = <lineBasicMaterial color="#2b1a0e" transparent opacity={0.7} />
  const wingGroup = (
    side: FlyerSide,
    plates: { plate: ExtrudeGeometry; ribs: BufferGeometry | null }[],
  ) => {
    const key = side.sign < 0 ? 'L' : 'R'
    return (
      <group
        ref={(g) => {
          refs.current[`${key}0`] = g
        }}
        position={[side.hingeX, geo.axisY, 0]}
      >
        {/* the hinges: strips under each gap, where the tape or loops go */}
        {flyerHingeLines(character, side).map((line, i) => (
          <mesh
            key={i}
            position={[side.sign * line.at, -0.3, (line.from + line.to) / 2]}
            userData={{ noFinish: true }}
          >
            <boxGeometry args={[HINGE_GAP + 5, 0.6, line.to - line.from]} />
            <meshStandardMaterial color="#efe6d2" roughness={0.9} />
          </mesh>
        ))}
        <mesh geometry={plates[0].plate}>
          <meshStandardMaterial color={wingColor} />
        </mesh>
        {plates[0].ribs && <lineSegments geometry={plates[0].ribs}>{ink}</lineSegments>}
        {plates.length > 1 && (
          <group
            ref={(g) => {
              refs.current[`${key}1`] = g
            }}
            position={[side.sign * side.hinges[1], 0, 0]}
          >
            <mesh geometry={plates[1].plate}>
              <meshStandardMaterial color={wingColor} />
            </mesh>
            {plates[1].ribs && <lineSegments geometry={plates[1].ribs}>{ink}</lineSegments>}
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
      {meshes.bodyLines && (
        <lineSegments geometry={meshes.bodyLines} position={[geo.xc, geo.axisY, 0]}>
          {ink}
        </lineSegments>
      )}
      {wingGroup(geo.left, meshes.left)}
      {wingGroup(geo.right, meshes.right)}
    </group>
  )
}
