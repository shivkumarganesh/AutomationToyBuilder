import { useDesignerStore } from '../model/store'
import { useChannels } from './useChannels'

const WOOD = '#c9a06a'
const WOOD_DARK = '#a87f4f'

/**
 * The boundary between the two zones: side panels carrying the shaft
 * bearings, front/back walls, and the stage plate with its guide slots.
 * Walls render semi-transparent when see-through mode is on so the
 * mechanism zone stays visible.
 */
export function FrameBox() {
  const frame = useDesignerStore((s) => s.spec.frame)
  const shaft = useDesignerStore((s) => s.spec.mechanism)
  const seeThrough = useDesignerStore((s) => s.seeThrough)
  const channels = useChannels()

  const { width: w, depth: d, height: h, materialThickness: t } = frame
  const wallProps = seeThrough
    ? { transparent: true, opacity: 0.28, depthWrite: false }
    : { transparent: false, opacity: 1, depthWrite: true }

  return (
    <group>
      {/* side panels (bear the shaft) */}
      <mesh position={[-(w - t) / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial color={WOOD} {...wallProps} />
      </mesh>
      <mesh position={[(w - t) / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial color={WOOD} {...wallProps} />
      </mesh>
      {/* front / back walls */}
      <mesh position={[0, h / 2, (d - t) / 2]}>
        <boxGeometry args={[w - 2 * t, h, t]} />
        <meshStandardMaterial color={WOOD} {...wallProps} />
      </mesh>
      <mesh position={[0, h / 2, -(d - t) / 2]}>
        <boxGeometry args={[w - 2 * t, h, t]} />
        <meshStandardMaterial color={WOOD} {...wallProps} />
      </mesh>
      {/* bottom */}
      <mesh position={[0, t / 2, 0]}>
        <boxGeometry args={[w - 2 * t, t, d - 2 * t]} />
        <meshStandardMaterial color={WOOD_DARK} {...wallProps} />
      </mesh>
      {/* stage plate — the physical interface between mechanism and characters */}
      <mesh position={[0, h + t / 2, 0]}>
        <boxGeometry args={[w, t, d]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>
      {/* guide-slot markers where each output channel surfaces */}
      {channels.map(({ channel }) => (
        <mesh key={channel.id} position={[channel.x, h + t + 0.05, 0]}>
          <boxGeometry args={[channel.pushrod.rodWidth + 1.5, 0.1, channel.pushrod.rodWidth + 1.5]} />
          <meshStandardMaterial color="#3a2d1c" />
        </mesh>
      ))}
      {/* bearing rings where the shaft passes through the side panels */}
      {[-(w - t) / 2, (w - t) / 2].map((x) => (
        <mesh key={x} position={[x, shaft.shaftHeight, 0]} rotation-y={Math.PI / 2}>
          <torusGeometry args={[shaft.shaftDiameter / 2 + 1, 1, 12, 32]} />
          <meshStandardMaterial color="#3a2d1c" />
        </mesh>
      ))}
    </group>
  )
}
