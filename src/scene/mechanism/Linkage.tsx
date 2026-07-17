import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'
import type { ChannelSignal } from '../../kinematics/channels'
import { linkagePose, meanCouplerAngle } from '../../kinematics/linkage'
import { useDesignerStore } from '../../model/store'

const CRANK_COLOR = '#4f8fe0'
const COUPLER_COLOR = '#e0a54f'
const ROCKER_COLOR = '#4fb06a'
const POST_COLOR = '#7a6248'
const PIN_COLOR = '#b59775'
const BAR = 4

/** Position a unit-length bar (box along local Y) between two plane points. */
function spanBar(
  mesh: Mesh,
  au: number,
  av: number,
  bu: number,
  bv: number,
  shaftY: number,
  xOff: number,
) {
  const du = bu - au
  const dv = bv - av
  const len = Math.max(Math.hypot(du, dv), 0.5)
  mesh.position.set(xOff, shaftY + (av + bv) / 2, (au + bu) / 2)
  mesh.rotation.set(Math.atan2(du, dv), 0, 0)
  mesh.scale.set(1, len, 1)
}

/**
 * Crank-rocker four-bar in the vertical plane at its shaft position:
 * crank arm on the shaft → coupler (extended to the coupler point) →
 * rocker on a fixed post, with the figure wand rising from the coupler
 * point through the stage. Bars stack in thin layers along the shaft
 * axis so they pass each other like a real linkage sandwich.
 */
export function Linkage({ signal }: { signal: ChannelSignal & { kind: 'path' } }) {
  const shaftY = useDesignerStore((s) => s.spec.mechanism.shaftHeight)
  const { channel } = signal
  const l = channel.linkage
  const phiMean = useMemo(() => meanCouplerAngle(l), [l])

  const crank = useRef<Group>(null)
  const coupler = useRef<Mesh>(null)
  const rocker = useRef<Mesh>(null)
  const wand = useRef<Mesh>(null)
  const pinA = useRef<Mesh>(null)
  const pinB = useRef<Mesh>(null)

  useFrame(() => {
    const theta = useDesignerStore.getState().crankAngle
    const pose = linkagePose(l, theta, phiMean)
    if (crank.current) crank.current.rotation.x = -(theta + (l.phaseDeg * Math.PI) / 180)
    if (coupler.current)
      spanBar(coupler.current, pose.a.u, pose.a.v, pose.p.u, pose.p.v, shaftY, 4)
    if (rocker.current)
      spanBar(rocker.current, l.groundLen, 0, pose.b.u, pose.b.v, shaftY, 8)
    if (wand.current)
      spanBar(wand.current, pose.p.u, pose.p.v, pose.mount.u, pose.mount.v, shaftY, 4)
    if (pinA.current) pinA.current.position.set(2, shaftY + pose.a.v, pose.a.u)
    if (pinB.current) pinB.current.position.set(6, shaftY + pose.b.v, pose.b.u)
  })

  const bar = (
    ref: React.RefObject<Mesh | null>,
    color: string,
    width = BAR,
  ) => (
    <mesh ref={ref}>
      <boxGeometry args={[3, 1, width]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )

  return (
    <group position={[channel.x, 0, 0]}>
      {/* input crank: disc + arm rotating with the shaft */}
      <group ref={crank} position={[0, shaftY, 0]}>
        <mesh rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[l.crankRadius * 0.45, l.crankRadius * 0.45, 4, 24]} />
          <meshStandardMaterial color={CRANK_COLOR} />
        </mesh>
        <mesh position={[0, 0, l.crankRadius / 2]}>
          <boxGeometry args={[4, 4, l.crankRadius]} />
          <meshStandardMaterial color={CRANK_COLOR} />
        </mesh>
      </group>
      {/* rocker post: floor to the fixed pivot O4 */}
      <mesh position={[8, shaftY / 2, l.groundLen]}>
        <boxGeometry args={[6, shaftY, 6]} />
        <meshStandardMaterial color={POST_COLOR} />
      </mesh>
      {/* moving bars (positions set per frame) */}
      {bar(coupler, COUPLER_COLOR)}
      {bar(rocker, ROCKER_COLOR)}
      {bar(wand, COUPLER_COLOR, 3)}
      {/* revolute pins */}
      <mesh ref={pinA} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[1.4, 1.4, 8, 12]} />
        <meshStandardMaterial color={PIN_COLOR} />
      </mesh>
      <mesh ref={pinB} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[1.4, 1.4, 8, 12]} />
        <meshStandardMaterial color={PIN_COLOR} />
      </mesh>
      {/* O4 pivot pin on the post */}
      <mesh position={[8, shaftY, l.groundLen]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[1.4, 1.4, 8, 12]} />
        <meshStandardMaterial color={PIN_COLOR} />
      </mesh>
      {/* invalid-linkage warning: red pivot marker when it cannot assemble */}
      {!signal.table.valid && (
        <mesh position={[0, shaftY, 0]}>
          <sphereGeometry args={[4, 16, 16]} />
          <meshStandardMaterial color="#c93a2e" />
        </mesh>
      )}
    </group>
  )
}
