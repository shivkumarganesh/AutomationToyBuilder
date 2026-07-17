import { describe, expect, it } from 'vitest'
import {
  decodeSpecFromUrl,
  encodeSpecForUrl,
  parseSpec,
  serializeSpec,
} from './persistence'
import { simplestAutomaton, snailWoodpecker } from './templates'
import { channelSignals } from '../kinematics/channels'

describe('parseSpec', () => {
  it('round-trips every template through JSON unchanged', () => {
    for (const spec of [simplestAutomaton, snailWoodpecker]) {
      expect(parseSpec(serializeSpec(spec))).toEqual(spec)
    }
  })

  it('rejects malformed input with readable errors', () => {
    expect(() => parseSpec('not json {')).toThrow('not valid JSON')
    expect(() => parseSpec('42')).toThrow()
    expect(() => parseSpec('{}')).toThrow('frame missing')
  })

  it('rejects dangling references', () => {
    const broken = structuredClone(simplestAutomaton)
    broken.mechanism.pushrods[0].camId = 'cam-ghost'
    expect(() => parseSpec(JSON.stringify(broken))).toThrow('unknown cam')

    const orphan = structuredClone(simplestAutomaton)
    orphan.characters[0].channelId = 'rod-ghost'
    expect(() => parseSpec(JSON.stringify(orphan))).toThrow('unknown channel')
  })

  it('rejects out-of-range dimensions', () => {
    const huge = structuredClone(simplestAutomaton)
    huge.frame.width = 10000
    expect(() => parseSpec(JSON.stringify(huge))).toThrow('out of range')

    const nan = structuredClone(simplestAutomaton) as unknown as {
      frame: { height: unknown }
    }
    nan.frame.height = 'tall'
    expect(() => parseSpec(JSON.stringify(nan))).toThrow('finite number')
  })

  it('falls back to a safe color for invalid character colors', () => {
    const odd = structuredClone(simplestAutomaton)
    ;(odd.characters[0] as { color: string }).color = 'javascript:alert(1)'
    const parsed = parseSpec(JSON.stringify(odd))
    expect(parsed.characters[0].color).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})

describe('share URL encoding', () => {
  it('round-trips a design through the URL fragment', () => {
    const encoded = encodeSpecForUrl(snailWoodpecker)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/) // URL-safe, no padding
    const decoded = decodeSpecFromUrl(encoded)
    expect(decoded).toEqual(snailWoodpecker)
    // and the decoded design is fully functional
    for (const signal of channelSignals(decoded)) {
      expect(signal.table.lift).toBeGreaterThan(0)
    }
  })

  it('survives unicode design names', () => {
    const spec = structuredClone(simplestAutomaton)
    spec.name = 'Ø小鳥 pecker ✨'
    expect(decodeSpecFromUrl(encodeSpecForUrl(spec)).name).toBe(spec.name)
  })

  it('rejects corrupted fragments', () => {
    expect(() => decodeSpecFromUrl('%%%not-base64%%%')).toThrow()
    expect(() => decodeSpecFromUrl(encodeSpecForUrl(simplestAutomaton).slice(0, 10))).toThrow()
  })
})
