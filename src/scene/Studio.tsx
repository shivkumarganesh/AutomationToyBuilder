import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PMREMGenerator, type BufferGeometry, type Group, Mesh } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { useDesignerStore } from '../model/store'

/**
 * The neutral studio the toy stands in when the app runs as an atomm
 * generator, and the housekeeping atomm's 3D-preview checklist asks for.
 *
 * Coordinate conventions (one place, as the checklist requires):
 *   model + 3D space: millimetres, Y up, camshaft along X, origin at the
 *   centre of the box footprint on the ground. Flat parts (cut-sheet
 *   outlines) are 2D in mm with Y down on the sheet; they are extruded
 *   through their thickness and placed by the shared layout modules —
 *   the same outlines the cut file writes.
 */

/** Editor-grey ground, image-based light and a soft key light. */
export function StudioLight() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    // procedural interior: no asset files, no network request. Built once;
    // released only when the view unmounts.
    const pmrem = new PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment())
    scene.environment = env.texture
    scene.environmentIntensity = 0.45
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return (
    <>
      <fog attach="fog" args={['#e7e8ea', 900, 2200]} />
      <directionalLight
        position={[160, 320, 180]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-320}
        shadow-camera-right={320}
        shadow-camera-top={320}
        shadow-camera-bottom={-320}
        shadow-camera-near={50}
        shadow-camera-far={900}
        shadow-bias={-0.0006}
        shadow-normalBias={0.6}
      />
      {/* the floor only catches the shadow */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 0]} receiveShadow userData={{ noFinish: true }}>
        <planeGeometry args={[4000, 4000]} />
        <shadowMaterial transparent opacity={0.16} />
      </mesh>
    </>
  )
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Ambient motion, on a persistent parent that rebuilds never touch: a
 * slight idle sway (two frequencies that never line up, so there is no
 * loop point) and a springy lean while the view is dragged that
 * overshoots once and settles on release. All of it is off under
 * prefers-reduced-motion. Transforms are written straight to the group
 * in the frame loop — nothing here re-renders React.
 */
export function Rig({ children }: { children: React.ReactNode }) {
  const group = useRef<Group>(null)
  const gl = useThree((s) => s.gl)
  const spring = useRef({ x: 0, v: 0, target: 0, dragging: false, lastX: 0 })

  useEffect(() => {
    const el = gl.domElement
    const s = spring.current
    const down = (e: PointerEvent) => {
      s.dragging = true
      s.lastX = e.clientX
    }
    const move = (e: PointerEvent) => {
      if (!s.dragging) return
      // lean with the drag, a few degrees at most
      s.target = Math.max(-0.07, Math.min(0.07, s.target + (e.clientX - s.lastX) * 0.0009))
      s.lastX = e.clientX
    }
    const up = () => {
      s.dragging = false
      s.target = 0
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [gl])

  useFrame(({ clock }, delta) => {
    const g = group.current
    if (!g) return
    if (reducedMotion()) {
      g.rotation.set(0, 0, 0)
      g.position.y = 0
      return
    }
    const s = spring.current
    const dt = Math.min(delta, 1 / 30)
    // under-damped spring (semi-implicit Euler): one visible overshoot, ~0.3 s to settle
    const accel = 170 * (s.target - s.x) - 13 * s.v
    s.v += accel * dt
    s.x += s.v * dt
    const t = clock.elapsedTime
    g.rotation.y = s.x + Math.sin(t * 0.43) * 0.006
    g.rotation.z = Math.sin(t * 0.31 + 1.3) * 0.003
    g.position.y = Math.sin(t * 0.57) * 0.5
  })

  return <group ref={group}>{children}</group>
}

/**
 * Releases geometry a rebuild has replaced. Parts build their geometry
 * from the design; when a parameter changes a part gets a new one and
 * the old one would otherwise stay on the GPU. After every design
 * change this disposes whatever is no longer in the scene — only what a
 * part created, never anything shared.
 */
export function GeometryJanitor() {
  const scene = useThree((s) => s.scene)
  const spec = useDesignerStore((s) => s.spec)
  const seen = useRef(new Set<BufferGeometry>())
  useEffect(() => {
    const sweep = () => {
      const live = new Set<BufferGeometry>()
      scene.traverse((o) => {
        if (o instanceof Mesh) live.add(o.geometry)
      })
      for (const g of seen.current) if (!live.has(g)) g.dispose()
      seen.current = live
    }
    // after the parts mounted by this change have attached their geometry
    const id = requestAnimationFrame(sweep)
    return () => cancelAnimationFrame(id)
  }, [scene, spec])
  return null
}

/**
 * Lets the canvas's zoom cluster drive the orbit camera. Listens for
 * `studio-zoom` events ({ factor } to dolly, { fit: true } for the
 * opening distance) and reports the level back as `studio-zoom-level`
 * (opening distance ÷ current distance).
 */
export function ZoomBridge({ home }: { home: number }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as
    | { target: { x: number; y: number; z: number }; minDistance: number; maxDistance: number; update(): void; addEventListener(t: string, f: () => void): void; removeEventListener(t: string, f: () => void): void }
    | null
  useEffect(() => {
    if (!controls) return
    const distance = () =>
      Math.hypot(
        camera.position.x - controls.target.x,
        camera.position.y - controls.target.y,
        camera.position.z - controls.target.z,
      )
    const report = () =>
      window.dispatchEvent(new CustomEvent('studio-zoom-level', { detail: home / distance() }))
    const onZoom = (e: Event) => {
      const d = (e as CustomEvent<{ factor?: number; level?: number; fit?: boolean }>).detail
      const now = distance()
      let next = now
      if (d.fit) next = home
      else if (d.level) next = home / d.level
      else if (d.factor) next = now / d.factor
      next = Math.min(controls.maxDistance, Math.max(controls.minDistance, next))
      const k = next / now
      camera.position.set(
        controls.target.x + (camera.position.x - controls.target.x) * k,
        controls.target.y + (camera.position.y - controls.target.y) * k,
        controls.target.z + (camera.position.z - controls.target.z) * k,
      )
      controls.update()
      report()
    }
    window.addEventListener('studio-zoom', onZoom)
    controls.addEventListener('change', report)
    report()
    return () => {
      window.removeEventListener('studio-zoom', onZoom)
      controls.removeEventListener('change', report)
    }
  }, [camera, controls, home])
  return null
}
