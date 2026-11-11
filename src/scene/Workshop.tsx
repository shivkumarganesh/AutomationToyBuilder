import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { CanvasTexture, Color, Mesh, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three'
import { useDesignerStore } from '../model/store'
import { useUiStore, type Finish } from '../ui/uiStore'

/** Deterministic pseudo-random stream, so the grain never flickers between renders. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/**
 * A light wood-grain texture (near-white, so it MULTIPLIES whatever
 * colour a part already has): long wavy streaks plus fine pores.
 */
function grainTexture(seed: number, contrast: number): CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, size, size)
  const r = rng(seed)
  for (let i = 0; i < 70; i++) {
    const y0 = r() * size
    const amp = 2 + r() * 5
    const phase = r() * 6.28
    g.strokeStyle = `rgba(90,55,25,${(0.05 + r() * 0.16) * contrast})`
    g.lineWidth = 0.6 + r() * 2.2
    g.beginPath()
    for (let x = 0; x <= size; x += 8) {
      const y = y0 + Math.sin((x / size) * 6.28 + phase) * amp
      if (x === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(70,40,20,${0.05 * contrast})`
    g.fillRect(r() * size, r() * size, 3 + r() * 9, 1)
  }
  const tex = new CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.colorSpace = SRGBColorSpace
  return tex
}

const BASSWOOD = new Color('#e2c79c')
const WALNUT = new Color('#7a5236')

/** Colour a part takes under a finish, from its painted colour and its zone. */
function finished(base: Color, zone: string, finish: Finish): Color {
  if (finish === 'painted') return base
  const wood = finish === 'walnut' ? WALNUT : BASSWOOD
  // keep a whisper of the painted colour so parts stay distinguishable
  if (zone === 'characters' || zone === 'scenery') return base.clone().lerp(wood, 0.82)
  if (zone === 'frame') return base.clone().lerp(wood, 0.9)
  return base.clone().lerp(wood, finish === 'walnut' ? 0.3 : 0.45)
}

/**
 * Dresses every part in the scene: wood grain, cast and received
 * shadows, and the chosen finish. It works on the live scene graph, so
 * no part component needs to know about finishes — and it never touches
 * geometry, so what is rendered is still exactly what is exported.
 */
export function WoodFinish({ shadeSides = false }: { shadeSides?: boolean }) {
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  const finish = useUiStore((s) => s.finish)
  const spec = useDesignerStore((s) => s.spec)
  const seeThrough = useDesignerStore((s) => s.seeThrough)
  const xray = useDesignerStore((s) => s.xrayFigures)
  // built once and shared by every part; released only on unmount
  const grain = useMemo(() => {
    // extruded parts carry UVs in millimetres: one tile of grain spans
    // 70 mm whatever the part's size. Boxes and cylinders carry 0…1.
    const mm = grainTexture(7, 1)
    mm.repeat.set(1 / 70, 1 / 70)
    const unit = grainTexture(19, 0.8)
    unit.repeat.set(1, 1)
    return { mm, unit }
  }, [])
  // darker side materials this component created (one per extruded part)
  const sides = useRef(new Map<Mesh, MeshStandardMaterial>())

  useEffect(
    () => () => {
      grain.mm.dispose()
      grain.unit.dispose()
      for (const m of sides.current.values()) m.dispose()
      sides.current.clear()
    },
    [grain],
  )

  useEffect(() => {
    const dress = () => {
      const live = new Set<Mesh>()
      scene.traverse((obj) => {
        if (!(obj instanceof Mesh) || obj.userData.noFinish) return
        // the face material is the one React owns; a side material, if any, is ours
        const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material
        if (!(mat instanceof MeshStandardMaterial)) return
        let zone = 'mechanism'
        for (let p = obj.parent; p; p = p.parent) {
          if (p.name === 'characters' || p.name === 'scenery' || p.name === 'frame') {
            zone = p.name
            break
          }
        }
        obj.castShadow = !mat.transparent
        obj.receiveShadow = true
        // the colour React last set is the painted colour; ours is remembered
        const now = mat.color.getHex()
        if (mat.userData.applied !== now) mat.userData.base = now
        const next = finished(new Color(mat.userData.base as number), zone, finish)
        mat.color.copy(next)
        mat.userData.applied = mat.color.getHex()
        const extruded = obj.geometry.type === 'ExtrudeGeometry'
        const map = extruded ? grain.mm : grain.unit
        if (mat.map !== map) {
          mat.map = map
          mat.bumpMap = map
          mat.bumpScale = 0.6
          mat.needsUpdate = true
        }
        mat.roughness = 0.78
        mat.metalness = 0
        // faces and sides as separate material groups, the sides a shade
        // darker, so a plate reads as a solid slab
        if (shadeSides && extruded) {
          live.add(obj)
          let side = sides.current.get(obj)
          if (!side || side.transparent !== mat.transparent) {
            side?.dispose()
            side = mat.clone()
            sides.current.set(obj, side)
          }
          side.color.copy(mat.color).multiplyScalar(0.8)
          side.opacity = mat.opacity
          side.map = map
          side.bumpMap = map
          obj.material = [mat, side]
        }
      })
      // side materials of parts that have gone
      for (const [mesh, side] of sides.current) {
        if (!live.has(mesh)) {
          side.dispose()
          sides.current.delete(mesh)
        }
      }
      invalidate()
    }
    dress()
    // parts mounted by this same render settle a frame later
    const id = requestAnimationFrame(dress)
    return () => cancelAnimationFrame(id)
  }, [scene, invalidate, finish, spec, seeThrough, xray, grain, shadeSides])

  return null
}

/** The workbench the toy stands on, and the light it stands in. */
export function Workbench() {
  const planks = useMemo(() => {
    const tex = grainTexture(3, 0.75)
    tex.repeat.set(6, 14)
    return tex
  }, [])
  return (
    <>
      <fog attach="fog" args={['#231a13', 620, 1500]} />
      <hemisphereLight args={['#fff1dc', '#3a2a1c', 0.75]} />
      <directionalLight
        position={[160, 320, 180]}
        intensity={1.9}
        color="#ffe9cf"
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
      <directionalLight position={[-180, 120, -120]} intensity={0.35} color="#cfe0ff" />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 0]} receiveShadow userData={{ noFinish: true }}>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color="#6a4e36" map={planks} roughness={0.95} />
      </mesh>
    </>
  )
}
