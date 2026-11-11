import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Vector3, type Group } from 'three'
import { useDesignerStore } from '../../model/store'
import { unlockSound } from '../../ui/sound'

/**
 * Hand crank on the right side of the box. Its rotation IS the crank angle
 * — every cam and channel derives from it.
 *
 * The handle can be grabbed and turned: dragging around the shaft end
 * (as it appears on screen) winds the crank by the same angle, in the
 * direction the handle is actually seen to move from the camera's side.
 */
export function Crank() {
  const frame = useDesignerStore((s) => s.spec.frame)
  const mech = useDesignerStore((s) => s.spec.mechanism)
  const group = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null
  const [hover, setHover] = useState(false)
  const drag = useRef<{ last: number } | null>(null)
  const hubX = frame.width / 2 + 12

  useEffect(() => {
    gl.domElement.style.cursor = hover ? 'grab' : ''
    return () => {
      gl.domElement.style.cursor = ''
    }
  }, [hover, gl])

  useEffect(() => {
    /** Angle of the pointer around the shaft end, in screen space. */
    const pointerAngle = (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect()
      const hub = new Vector3(hubX, mech.shaftHeight, 0).project(camera)
      const hx = rect.left + ((hub.x + 1) / 2) * rect.width
      const hy = rect.top + ((1 - hub.y) / 2) * rect.height
      return Math.atan2(clientY - hy, clientX - hx)
    }
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return
      const a = pointerAngle(e.clientX, e.clientY)
      let d = a - drag.current.last
      if (d > Math.PI) d -= 2 * Math.PI
      if (d < -Math.PI) d += 2 * Math.PI
      drag.current.last = a
      // seen from the crank side the handle turns against screen angle;
      // from the far side it turns with it
      const sign = camera.position.x > hubX ? -1 : 1
      const s = useDesignerStore.getState()
      s.setCrankAngle(s.crankAngle + sign * d)
    }
    const onUp = () => {
      if (!drag.current) return
      drag.current = null
      if (controls) controls.enabled = true
      gl.domElement.style.cursor = ''
    }
    const onDown = (e: Event) => {
      const detail = (e as CustomEvent<{ x: number; y: number }>).detail
      drag.current = { last: pointerAngle(detail.x, detail.y) }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('crank-grab', onDown)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('crank-grab', onDown)
    }
  }, [camera, gl, controls, hubX, mech.shaftHeight])

  const grab = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    unlockSound()
    useDesignerStore.getState().setCranking(false)
    if (controls) controls.enabled = false
    gl.domElement.style.cursor = 'grabbing'
    window.dispatchEvent(new CustomEvent('crank-grab', { detail: { x: e.clientX, y: e.clientY } }))
  }

  useFrame(() => {
    if (group.current) group.current.rotation.x = useDesignerStore.getState().crankAngle
  })

  const { armLength, handleLength, handleDiameter } = mech.crank
  const armThickness = 6
  const x = frame.width / 2 + 12

  return (
    <group
      ref={group}
      position={[x, mech.shaftHeight, 0]}
      onPointerDown={grab}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
    >
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
