import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useDesignerStore } from '../model/store'
import { useUiStore } from '../ui/uiStore'
import { channelValue, type ChannelSignal } from '../kinematics/channels'
import { knock } from '../ui/sound'

const TICK_STEP = Math.PI / 6 // a soft ratchet tick every 30° of crank

/**
 * Plays the toy from its real motion: a tick as the crank passes each
 * 30°, and a knock whenever a follower actually falls (a snail cam's
 * drop, a petal's valley) — sized by how far it fell.
 */
export function SoundDriver({ signals }: { signals: ChannelSignal[] }) {
  const last = useRef<{ angle: number; values: number[]; at: number } | null>(null)
  useFrame(() => {
    const angle = useDesignerStore.getState().crankAngle
    const values = signals.map((s) => (s.kind === 'lift' || s.kind === 'tilt' ? channelValue(s, angle) : 0))
    const prev = last.current
    last.current = { angle, values, at: prev?.at ?? 0 }
    if (!prev || prev.values.length !== values.length || !useUiStore.getState().sound) return
    const turned = Math.abs(angle - prev.angle)
    if (turned < 1e-5 || turned > 1) return // still, or a jump (scrub / wrap)
    const now = performance.now()
    let loudest = 0
    signals.forEach((s, i) => {
      if (s.kind !== 'lift' && s.kind !== 'tilt') return
      // fall per radian of crank, as a share of the channel's whole travel
      const fall = (prev.values[i] - values[i]) / turned / Math.max(s.table.lift, 1e-6)
      if (fall > 2.2) loudest = Math.max(loudest, Math.min(1, fall / 9))
    })
    if (loudest > 0 && now - last.current.at > 140) {
      knock(0.35 + 0.65 * loudest)
      last.current.at = now
    } else if (Math.floor(angle / TICK_STEP) !== Math.floor(prev.angle / TICK_STEP)) {
      knock(0.08)
    }
  })
  return null
}
