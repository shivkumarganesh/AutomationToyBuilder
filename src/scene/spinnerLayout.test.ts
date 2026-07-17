import { describe, expect, it } from 'vitest'
import { nodAndSpin } from '../model/templates'
import { contactOffset, drivenDiscRadius } from './spinnerLayout'

describe('friction drive geometry', () => {
  const spinner = nodAndSpin.mechanism.spinners[0]

  it('contact point sits off the spindle axis — never at it', () => {
    expect(Math.abs(contactOffset(spinner))).toBeGreaterThan(0)
  })

  it('contact radius realises the transmission ratio exactly', () => {
    // ω_out = ω_in · wheelRadius / contactRadius  ⇒  offset · ratio = wheelRadius
    expect(contactOffset(spinner) * spinner.ratio).toBeCloseTo(spinner.wheelRadius, 6)
  })

  it('driven disc reaches past the contact point with margin', () => {
    expect(drivenDiscRadius(spinner)).toBeGreaterThan(Math.abs(contactOffset(spinner)))
  })

  it('holds across the whole UI ratio range', () => {
    for (const ratio of [0.25, 0.5, 1, 1.5, 2]) {
      const sp = { ...spinner, ratio }
      const offset = contactOffset(sp)
      expect(offset).toBeGreaterThan(0)
      expect(offset * ratio).toBeCloseTo(sp.wheelRadius, 6)
      expect(drivenDiscRadius(sp)).toBeGreaterThan(offset)
    }
  })
})
