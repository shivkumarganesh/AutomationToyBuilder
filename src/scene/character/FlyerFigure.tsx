import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, ExtrudeGeometry, Shape, type Group } from 'three'
import type { CharacterSpec } from '../../model/types'
import type { Point2 } from '../../model/figures'
import type { ChannelSignal } from '../../kinematics/channels'
import {
  FLYER_POST_WIDTH,
  flyerAngles,
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
import { useUiStore } from '../../ui/uiStore'
import { FLYER_RELIEF_FIRST, flyerBodyStack, stackDome } from '../reliefLayout'
import { BURNT, ribbonGeometry, SCORCH_WIDTH, SCORE_WIDTH } from '../ribbons'

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

/** Scored lines lying on a level plate's top face (same frame as plateGeometry), real width. */
function scored(lines: { line: Point2[]; lift: number }[]) {
  const top = (p: Point2, lift: number): [number, number, number] => [p.x, lift, p.y]
  return {
    score: ribbonGeometry(lines, SCORE_WIDTH, top),
    scorch: ribbonGeometry(lines, SCORCH_WIDTH, top),
  }
}
type Scored = ReturnType<typeof scored>

function Burn({ lines }: { lines: Scored }) {
  return (
    <>
      {lines.scorch && (
        <mesh geometry={lines.scorch}>
          <meshBasicMaterial color={BURNT} transparent opacity={0.16} side={DoubleSide} depthWrite={false} />
        </mesh>
      )}
      {lines.score && (
        <mesh geometry={lines.score}>
          <meshBasicMaterial color={BURNT} transparent opacity={0.88} side={DoubleSide} />
        </mesh>
      )}
    </>
  )
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
  const printed = useUiStore((s) => s.method) === 'print'
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
        // the print file carries no scored lines, so its preview shows none
        const ribs = printed
          ? []
          : flyerWingEngraving(character, side, i).map((line) => ({
              line: line.map((p) => ({ x: side.sign * (p.x - h), y: p.y })),
              lift: t + 0.06,
            }))
        return { plate: plateGeometry(pts, t), ribs: scored(ribs) }
      })
    // the ridge on the body: stepped plates (laser) or a dome (print)
    const stack = flyerBodyStack(character)
    const ridge: { geo: ExtrudeGeometry; y: number }[] = printed
      ? stackDome(stack, character, t, FLYER_RELIEF_FIRST).flatMap((slice) =>
          slice.outlines.map((o) => ({ geo: plateGeometry(o, slice.to - slice.from), y: t + slice.from })),
        )
      : stack.levels.flatMap((level, k) => level.map((o) => ({ geo: plateGeometry(o, t), y: (k + 1) * t })))
    return {
      body: plateGeometry(flyerBodyOutline(character), t),
      ridge,
      bodyLines: scored(
        printed ? [] : stack.engraving.map((e) => ({ line: e.item, lift: (e.level + 1) * t + 0.06 })),
      ),
      left: wing(geo.left),
      right: wing(geo.right),
    }
  }, [geo, character, t, printed])

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

  const wingGroup = (side: FlyerSide, plates: { plate: ExtrudeGeometry; ribs: Scored }[]) => {
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
        <Burn lines={plates[0].ribs} />
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
            <Burn lines={plates[1].ribs} />
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
      {meshes.ridge.map((r, i) => (
        <mesh key={i} geometry={r.geo} position={[geo.xc, geo.axisY + r.y, 0]}>
          <meshStandardMaterial color={bodyColor} />
        </mesh>
      ))}
      <group position={[geo.xc, geo.axisY, 0]}>
        <Burn lines={meshes.bodyLines} />
      </group>
      {wingGroup(geo.left, meshes.left)}
      {wingGroup(geo.right, meshes.right)}
    </group>
  )
}
