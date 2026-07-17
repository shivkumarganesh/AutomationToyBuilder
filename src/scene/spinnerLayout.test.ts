import { describe, expect, it } from 'vitest'
import { bevelCarousel, nodAndSpin } from '../model/templates'
import { spinnerRatio } from '../model/types'
import {
  bevelAlignment,
  bevelMeshY,
  contactOffset,
  crownPitchRadius,
  crownPlaneOffset,
  crownToothZone,
  drivenDiscRadius,
  pinionPitchRadius,
} from './spinnerLayout'

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

describe('bevel (crown + pinion) drive geometry', () => {
  const spinner = bevelCarousel.mechanism.spinners[0]
  const shaftHeight = bevelCarousel.mechanism.shaftHeight

  it('ratio is derived from the teeth, never free', () => {
    expect(spinnerRatio(spinner)).toBeCloseTo(spinner.crownTeeth! / spinner.pinionTeeth!, 9)
    expect(spinnerRatio(spinner)).toBe(3) // 24 / 8
  })

  it('pitch-line speeds match at the mesh point (no slip)', () => {
    // ω_spindle · Rp must equal ω_crank · Rc
    expect(spinnerRatio(spinner) * pinionPitchRadius(spinner)).toBeCloseTo(
      crownPitchRadius(spinner),
      9,
    )
  })

  it('the mesh point sits off both axes — torque can actually transfer', () => {
    // the mesh point is one pinion pitch radius off the spindle axis, and
    // the crown centre plane sits further back so its TOOTH RING (not its
    // disc) straddles that point
    expect(pinionPitchRadius(spinner)).toBeGreaterThan(0)
    expect(crownPlaneOffset(spinner)).toBeGreaterThan(pinionPitchRadius(spinner))
    // …and off the camshaft axis by the crown pitch radius
    expect(bevelMeshY(spinner, shaftHeight) - shaftHeight).toBeCloseTo(
      crownPitchRadius(spinner),
      9,
    )
  })

  it('crown tooth and pinion gap schedules stay locked at every crank angle', () => {
    for (let deg = 0; deg <= 720; deg += 7) {
      const theta = (deg * Math.PI) / 180
      const { crown, pinion } = bevelAlignment(spinner, theta)
      expect(Math.abs(crown - pinion), `at crank ${deg}°`).toBeLessThan(1e-9)
    }
  })

  it('crown gear clears the floor and the box walls', () => {
    const Rc = crownPitchRadius(spinner)
    expect(shaftHeight - Rc).toBeGreaterThan(5)
    expect(Rc).toBeLessThan(bevelCarousel.frame.depth / 2)
  })

  it('the pinion sits below the stage with room to mesh', () => {
    const stageTop = bevelCarousel.frame.height + bevelCarousel.frame.materialThickness
    expect(bevelMeshY(spinner, shaftHeight)).toBeLessThan(stageTop - 10)
  })
})

describe('bevel mesh engagement zone', () => {
  const spinner = bevelCarousel.mechanism.spinners[0]
  const Rp = pinionPitchRadius(spinner)
  const module = spinner.module!
  const zone = crownToothZone(spinner)

  it('the pinion pitch circle passes through the crown tooth ring', () => {
    expect(-Rp).toBeGreaterThan(zone.far)
    expect(-Rp).toBeLessThan(zone.near)
  })

  it('pinion tooth tips reach into the ring — the teeth actually engage', () => {
    const tip = -(Rp + module)
    expect(tip).toBeGreaterThan(zone.far)
    expect(tip).toBeLessThan(zone.near)
  })

  it('the pinion root circle clears the ring — no collision with the hub', () => {
    const root = -(Rp - 1.25 * module)
    expect(root).toBeGreaterThan(zone.near)
  })
})
