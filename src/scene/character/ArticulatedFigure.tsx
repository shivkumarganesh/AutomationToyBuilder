import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Quaternion, Vector3, type Group, type Mesh } from 'three'
import type { CharacterSpec, LimbSpec } from '../../model/types'
import type { ChannelSignal } from '../../kinematics/channels'
import { limbJointAngle } from '../../kinematics/articulation'
import {
  bodyBaseY,
  headRotation,
  LIMB_THICKNESS,
  limbPivotFrac,
  PIN_STAGGER,
  sourceTipY,
  tailRotation,
  WIRE_RADIUS,
  wingRotations,
} from '../figureLayout'
import { useDesignerStore } from '../../model/store'

const UP = new Vector3(0, 1, 0)
const ARM_COLOR = '#b59775'
const WIRE_COLOR = '#c8ccd4'

const tmpDir = new Vector3()
const tmpQuat = new Quaternion()

/** Orient a unit cylinder mesh to span two points (in the same local frame). */
function spanWire(mesh: Mesh, ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  tmpDir.set(bx - ax, by - ay, bz - az)
  const len = Math.max(tmpDir.length(), 0.5)
  mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
  mesh.quaternion.copy(tmpQuat.setFromUnitVectors(UP, tmpDir.normalize()))
  mesh.scale.set(1, len, 1)
}

/**
 * One pivot-jointed limb: the joint group rotates by asin(d / crankArm),
 * and a drive wire visibly connects the channel's output tip to the drive
 * pin on the limb's crank arm — every link in the chain is on screen.
 */
function Limb({
  character,
  limb,
  signal,
  baseY,
  originX,
  zOffset,
}: {
  character: CharacterSpec
  limb: LimbSpec
  signal: ChannelSignal
  baseY: number
  originX: number
  zOffset: number
}) {
  const spec = useDesignerStore((s) => s.spec)
  const left = useRef<Group>(null)
  const right = useRef<Group>(null)
  const single = useRef<Group>(null)
  const vert = useRef<Mesh>(null)
  const armL = useRef<Mesh>(null)
  const armR = useRef<Mesh>(null)
  const { width, height, depth, color } = character
  const { length, crankArm } = limb
  const chord = limb.width
  const pivotY = baseY + limbPivotFrac(limb.kind) * height
  const hasWire = signal.kind !== 'spin'

  useFrame(() => {
    const theta = useDesignerStore.getState().crankAngle
    const a = limbJointAngle(signal, limb, theta)
    // source tip in this figure's local frame (group sits at [originX, 0, zOffset])
    const tipY = sourceTipY(spec, signal, theta)
    const sx = signal.channel.x - originX
    const sz = -zOffset
    // the drive wire is a rigid bent crank translating vertically: a
    // vertical run above the source tip up to pin height (constant length
    // — pin height is exactly pivotY + d), then a horizontal arm to the pin
    const pinY = pivotY + crankArm * Math.sin(a)
    if (hasWire && tipY !== null && vert.current) {
      vert.current.position.set(sx, (tipY + pinY) / 2, sz)
      vert.current.scale.set(1, Math.max(pinY - tipY, 0.5), 1)
    }

    if (limb.kind === 'wings') {
      const rot = wingRotations(a)
      if (left.current) left.current.rotation.z = rot.left
      if (right.current) right.current.rotation.z = rot.right
      if (hasWire && tipY !== null) {
        const pinX = width / 2 - crankArm * Math.cos(a)
        if (armR.current) spanWire(armR.current, sx, pinY, sz, pinX, pinY, -PIN_STAGGER)
        if (armL.current) spanWire(armL.current, sx, pinY, sz, -pinX, pinY, PIN_STAGGER)
      }
    } else {
      const rot = limb.kind === 'head' ? headRotation(a) : tailRotation(a)
      if (single.current) single.current.rotation.x = rot
      if (hasWire && tipY !== null && armL.current) {
        // head pin: rear arm behind the neck. tail pin: on the blade,
        // outside the back face — both land in open air, never inside the body
        const pinZ =
          limb.kind === 'head' ? -crankArm * Math.cos(a) : -depth / 2 - crankArm * Math.cos(a)
        spanWire(armL.current, sx, pinY, sz, 0, pinY, pinZ)
      }
    }
  })

  const wire = (ref: React.RefObject<Mesh | null>) => (
    <mesh ref={ref}>
      <cylinderGeometry args={[WIRE_RADIUS, WIRE_RADIUS, 1, 8]} />
      <meshStandardMaterial color={WIRE_COLOR} metalness={0.6} roughness={0.4} />
    </mesh>
  )

  if (limb.kind === 'wings') {
    const wing = (side: 1 | -1, ref: React.RefObject<Group | null>) => (
      <group ref={ref} position={[side * (width / 2), pivotY, 0]}>
        {/* wing plate, outward from the shoulder pivot */}
        <mesh position={[side * (length / 2 + 1), 0, 0]}>
          <boxGeometry args={[length, LIMB_THICKNESS, chord]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* inner crank arm reaching to the drive pin */}
        <mesh position={[-side * (crankArm / 2), 0, -side * PIN_STAGGER]}>
          <boxGeometry args={[crankArm, 2.5, 3]} />
          <meshStandardMaterial color={ARM_COLOR} />
        </mesh>
        <mesh position={[-side * crankArm, 0, -side * PIN_STAGGER]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[1.2, 1.2, 4, 10]} />
          <meshStandardMaterial color={ARM_COLOR} />
        </mesh>
      </group>
    )
    return (
      <>
        {wing(1, right)}
        {wing(-1, left)}
        {hasWire && wire(vert)}
        {hasWire && wire(armR)}
        {hasWire && wire(armL)}
      </>
    )
  }

  if (limb.kind === 'head') {
    return (
      <>
        <group ref={single} position={[0, pivotY, 0]}>
          {/* head block above the neck pivot, beak forward */}
          <mesh position={[0, width * 0.3 + 1, width * 0.12]}>
            <boxGeometry args={[width * 0.6, width * 0.6, width * 0.6]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, width * 0.24, width * 0.12 + width * 0.42]}>
            <boxGeometry args={[width * 0.18, width * 0.14, width * 0.3]} />
            <meshStandardMaterial color="#e0b64f" />
          </mesh>
          {/* rear crank arm behind the neck */}
          <mesh position={[0, 0, -crankArm / 2]}>
            <boxGeometry args={[3, 2.5, crankArm]} />
            <meshStandardMaterial color={ARM_COLOR} />
          </mesh>
          <mesh position={[0, 0, -crankArm]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[1.2, 1.2, 4, 10]} />
            <meshStandardMaterial color={ARM_COLOR} />
          </mesh>
        </group>
        {hasWire && wire(vert)}
        {hasWire && wire(armL)}
      </>
    )
  }

  // tail: pivots at the back face, wags up and down
  return (
    <>
      <group ref={single} position={[0, pivotY, -depth / 2]}>
        <mesh position={[0, 0, -(length / 2 + 1)]}>
          <boxGeometry args={[chord, LIMB_THICKNESS, length]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {/* drive pin sits on the blade just behind the pivot, in open air */}
        <mesh position={[0, 0, -crankArm]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[1.2, 1.2, 4, 10]} />
          <meshStandardMaterial color={ARM_COLOR} />
        </mesh>
      </group>
      {hasWire && wire(vert)}
      {hasWire && wire(armL)}
    </>
  )
}

/**
 * An articulated character: body fixed on a stand over its primary
 * channel, limbs pivot-jointed to it, each driven by an output channel
 * through a visible wire linkage. The stand height is derived from the
 * primary drive tip's rest height — the body is placed so the linkage
 * geometry works, never eyeballed.
 *
 * Clicking the figure toggles X-RAY: the body shell turns translucent
 * (like the see-through box walls) so the wires, crank arms, and pins
 * routed through it stay opaque and the assembly can be inspected.
 */
export function ArticulatedFigure({
  character,
  signals,
  zOffset = 0,
}: {
  character: CharacterSpec
  signals: ChannelSignal[]
  zOffset?: number
}) {
  const spec = useDesignerStore((s) => s.spec)
  const xray = useDesignerStore((s) => s.xrayFigures.includes(character.id))
  const toggleFigureXray = useDesignerStore((s) => s.toggleFigureXray)
  const primary = signals.find((s) => s.channel.id === character.channelId)
  const baseY = useMemo(() => bodyBaseY(spec, character, signals), [spec, character, signals])
  if (!primary) return null

  const stageTop = spec.frame.height + spec.frame.materialThickness
  const { width, height, depth, color } = character
  const standH = Math.max(baseY - stageTop, 0)
  const limbs = character.limbs ?? []
  const hasHeadLimb = limbs.some((l) => l.kind === 'head')
  // the shell (body, stand, rigid head) goes translucent in x-ray;
  // limbs and linkage stay opaque so the internals read clearly.
  // key forces a fresh material on toggle — flipping `transparent` on a
  // live material needs a program rebuild that prop patching won't do
  const shell = (shellColor: string) =>
    xray ? (
      <meshStandardMaterial
        key="xray"
        color={shellColor}
        transparent
        opacity={0.22}
        depthWrite={false}
      />
    ) : (
      <meshStandardMaterial key="solid" color={shellColor} />
    )
  return (
    <group
      position={[primary.channel.x, 0, zOffset]}
      onClick={(e) => {
        // nearest hit only: stopPropagation keeps one click = one toggle
        e.stopPropagation()
        toggleFigureXray(character.id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      {/* stand: stage to body base */}
      {standH > 0.01 && (
        <mesh position={[0, stageTop + standH / 2, 0]}>
          <boxGeometry args={[8, standH, 8]} />
          {shell('#3a2d1c')}
        </mesh>
      )}
      {/* body */}
      <mesh position={[0, baseY + height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        {shell(color)}
      </mesh>
      {/* static head unless a head limb replaces it */}
      {!hasHeadLimb && (
        <mesh position={[0, baseY + height + width * 0.28, 0]}>
          <boxGeometry args={[width * 0.55, width * 0.55, width * 0.55]} />
          {shell(color)}
        </mesh>
      )}
      {limbs.map((limb) => {
        const signal = signals.find((s) => s.channel.id === limb.channelId)
        if (!signal) return null
        return (
          <Limb
            key={limb.id}
            character={character}
            limb={limb}
            signal={signal}
            baseY={baseY}
            originX={primary.channel.x}
            zOffset={zOffset}
          />
        )
      })}
    </group>
  )
}
