import { beforeEach, describe, expect, it } from 'vitest'
import { channelCount, MAX_CHANNELS, useDesignerStore } from './store'
import { simplestAutomaton } from './templates'
import { outputChannels } from './types'
import { channelSignals } from '../kinematics/channels'

const state = () => useDesignerStore.getState()

beforeEach(() => {
  state().loadTemplate(simplestAutomaton)
})

describe('addCam', () => {
  it('adds a complete channel unit: cam, pushrod, and figure', () => {
    const before = state().spec
    state().addCam()
    const spec = state().spec
    expect(spec.mechanism.cams).toHaveLength(before.mechanism.cams.length + 1)
    expect(spec.mechanism.pushrods).toHaveLength(before.mechanism.pushrods.length + 1)
    expect(spec.characters).toHaveLength(before.characters.length + 1)
    // the new unit is fully wired: channels resolve and produce motion
    for (const signal of channelSignals(spec)) {
      if (signal.kind !== 'spin') expect(signal.table.lift).toBeGreaterThan(0)
    }
  })

  it('places the new cam on free shaft space with a unique id', () => {
    state().addCam()
    const spec = state().spec
    const positions = spec.mechanism.cams.map((c) => c.position)
    expect(new Set(spec.mechanism.cams.map((c) => c.id)).size).toBe(positions.length)
    expect(new Set(positions).size).toBe(positions.length)
    for (const p of positions) {
      expect(p).toBeGreaterThan(0)
      expect(p).toBeLessThan(1)
    }
  })

  it('caps the mechanism at MAX_CHANNELS across all output kinds', () => {
    for (let i = 0; i < 10; i++) state().addCam()
    expect(channelCount(state().spec)).toBe(MAX_CHANNELS)
    state().addRocker()
    state().addSpinner()
    expect(channelCount(state().spec)).toBe(MAX_CHANNELS)
  })

  it('addRocker adds a cam-driven tilt channel with a nodding figure', () => {
    state().addRocker()
    const spec = state().spec
    expect(spec.mechanism.rockers).toHaveLength(1)
    const rocker = spec.mechanism.rockers[0]
    expect(spec.mechanism.cams.some((c) => c.id === rocker.camId)).toBe(true)
    expect(spec.characters.some((c) => c.channelId === rocker.id)).toBe(true)
    const signal = channelSignals(spec).find((s) => s.channel.id === rocker.id)!
    expect(signal.kind).toBe('tilt')
    if (signal.kind === 'tilt') expect(signal.table.lift).toBeGreaterThan(0)
  })

  it('addSpinner adds a spin channel and removeSpinner cleans it up', () => {
    state().addSpinner()
    const spinner = state().spec.mechanism.spinners[0]
    expect(spinner).toBeDefined()
    const signal = channelSignals(state().spec).find((s) => s.channel.id === spinner.id)!
    expect(signal.kind).toBe('spin')
    state().removeSpinner(spinner.id)
    expect(state().spec.mechanism.spinners).toHaveLength(0)
    expect(state().spec.characters.some((c) => c.channelId === spinner.id)).toBe(false)
  })

  it('removing a cam also removes rockers it drives', () => {
    state().addRocker()
    const rocker = state().spec.mechanism.rockers[0]
    state().removeCam(rocker.camId)
    expect(state().spec.mechanism.rockers).toHaveLength(0)
    expect(state().spec.characters.some((c) => c.channelId === rocker.id)).toBe(false)
  })
})

describe('removeCam', () => {
  it('removes the cam, its pushrod, and figures riding that channel', () => {
    state().removeCam('cam-petal')
    const spec = state().spec
    expect(spec.mechanism.cams.map((c) => c.id)).toEqual(['cam-eccentric'])
    expect(spec.mechanism.pushrods.map((r) => r.id)).toEqual(['rod-a'])
    expect(spec.characters.map((c) => c.id)).toEqual(['figure-a'])
    expect(() => outputChannels(spec)).not.toThrow()
  })

  it('never removes the last cam', () => {
    state().removeCam('cam-petal')
    state().removeCam('cam-eccentric')
    expect(state().spec.mechanism.cams).toHaveLength(1)
  })
})

describe('characters', () => {
  it('addCharacter binds to the first channel; removeCharacter deletes it', () => {
    state().addCharacter()
    const added = state().spec.characters.at(-1)!
    expect(added.channelId).toBe(state().spec.mechanism.pushrods[0].id)
    state().removeCharacter(added.id)
    expect(state().spec.characters.some((c) => c.id === added.id)).toBe(false)
  })

  it('re-binding a character to another channel keeps the spec valid', () => {
    const figure = state().spec.characters[0]
    state().updateCharacter(figure.id, { channelId: 'rod-b' })
    const channels = outputChannels(state().spec)
    for (const ch of state().spec.characters) {
      expect(channels.some((c) => c.id === ch.channelId)).toBe(true)
    }
  })
})
