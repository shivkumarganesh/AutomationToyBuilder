import { describe, expect, it } from 'vitest'
import { snailWoodpecker, templates } from './templates'
import * as templatesModule from './templates'
import { outputChannels } from './types'
import { channelSignals } from '../kinematics/channels'
import { flatPackSvg } from '../export/svgFlatPack'
import { exportStl } from '../export/stlExport'

describe('template registry', () => {
  it('every template resolves its stage interface with live channels', () => {
    for (const [key, spec] of Object.entries(templates)) {
      const channels = outputChannels(spec)
      expect(channels.length, key).toBeGreaterThan(0)
      for (const signal of channelSignals(spec)) {
        if (signal.kind === 'spin') {
          expect(signal.ratio, `${key}/${signal.channel.id}`).not.toBe(0)
        } else {
          expect(Number.isFinite(signal.table.min), key).toBe(true)
          expect(Number.isFinite(signal.table.max), key).toBe(true)
          expect(signal.table.lift, `${key}/${signal.channel.id}`).toBeGreaterThan(0)
        }
      }
      // characters only ride channels that exist
      for (const ch of spec.characters) {
        expect(
          channels.some((c) => c.id === ch.channelId),
          `${key}/${ch.id}`,
        ).toBe(true)
      }
    }
  })

  it('every template exports valid SVG and STL', () => {
    for (const [key, spec] of Object.entries(templates)) {
      const svg = flatPackSvg(spec)
      expect(svg, key).toContain('<svg xmlns=')
      const stl = exportStl(spec)
      const view = new DataView(stl.buffer)
      const triangles = view.getUint32(80, true)
      expect(stl.byteLength, key).toBe(84 + triangles * 50)
    }
  })
})

describe('snail cam woodpecker', () => {
  const found = channelSignals(snailWoodpecker).find(
    (s) => s.channel.id === 'rod-pecker',
  )!
  if (found.kind !== 'lift') throw new Error('rod-pecker must be a lift channel')
  const pecker = found

  it('rises gradually and drops sharply exactly once per revolution', () => {
    const { heights } = pecker.table
    const n = heights.length
    const lift = pecker.table.lift
    let drops = 0
    let rises = 0
    for (let i = 0; i < n; i++) {
      const delta = heights[(i + 1) % n] - heights[i]
      if (-delta > lift / 2) drops++
      if (delta > lift / 2) rises++
    }
    expect(drops).toBe(1)
    // the follower must never be flung upward — that would jam a real toy
    expect(rises).toBe(0)
  })

  it('achieves most of the cam lift despite the follower pad width', () => {
    const camLift = 12
    expect(pecker.table.lift).toBeGreaterThan(camLift * 0.8)
  })
})

describe('nod & spin carousel', () => {
  it('exposes one tilt channel and one spin channel', () => {
    const { nodAndSpin } = templatesModule
    const signals = channelSignals(nodAndSpin)
    const tilt = signals.find((s) => s.kind === 'tilt')
    const spin = signals.find((s) => s.kind === 'spin')
    expect(tilt).toBeDefined()
    expect(spin).toBeDefined()
    if (tilt?.kind === 'tilt') {
      // eccentric-driven nod swings symmetrically around rest
      expect(tilt.table.max).toBeGreaterThan(2)
      expect(tilt.table.min).toBeLessThan(-2)
      expect(Math.abs(tilt.table.max + tilt.table.min)).toBeLessThan(1)
    }
    if (spin?.kind === 'spin') expect(spin.ratio).toBe(1)
  })
})
