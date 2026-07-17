import { describe, expect, it } from 'vitest'
import { flappingBird, nodAndSpin, steppingOwl } from '../model/templates'
import {
  channelDisplacement,
  channelHalfTravel,
  limbJointAngle,
  limbLinkageOk,
  limbMaxAngle,
} from './articulation'
import { channelSignals } from './channels'
import {
  bodyBaseY,
  limbPivotFrac,
  pinRise,
  sourceTipRestY,
  WIRE_REST_RUN,
  wingRotations,
  wingTipRise,
} from '../scene/figureLayout'

const signals = channelSignals(flappingBird)
const bird = flappingBird.characters[0]
const limbs = bird.limbs!
const signalFor = (channelId: string) => signals.find((s) => s.channel.id === channelId)!

const TWO_PI = Math.PI * 2

describe('articulated limb linkage', () => {
  it('pin rise equals the wire displacement exactly, at every crank angle', () => {
    // the pin-on-wire constraint: crankArm · sin(asin(d / crankArm)) = d.
    // This is what makes the joint DERIVED — the wire's displacement is
    // consumed without loss or invention.
    for (const limb of limbs) {
      const signal = signalFor(limb.channelId)
      for (let deg = 0; deg < 360; deg += 3) {
        const theta = (deg / 360) * TWO_PI
        const a = limbJointAngle(signal, limb, theta)
        const d = channelDisplacement(signal, theta)
        expect(pinRise(a, limb.crankArm), `${limb.id} at ${deg}°`).toBeCloseTo(d, 9)
      }
    }
  })

  it('no linkage in the template can ever lock', () => {
    for (const limb of limbs) {
      const signal = signalFor(limb.channelId)
      expect(limbLinkageOk(signal, limb), limb.id).toBe(true)
      // and with margin: the pin never climbs past ~80% of its arc
      expect(channelHalfTravel(signal) / limb.crankArm, limb.id).toBeLessThan(0.8)
    }
  })

  it('joint rests level at the channel mid-travel', () => {
    for (const limb of limbs) {
      const signal = signalFor(limb.channelId)
      let min = Infinity
      let max = -Infinity
      for (let i = 0; i < 720; i++) {
        const a = limbJointAngle(signal, limb, (i / 720) * TWO_PI)
        min = Math.min(min, a)
        max = Math.max(max, a)
      }
      // asin of a displacement symmetric about zero: swing centred on level
      expect(Math.abs(max + min), limb.id).toBeLessThan(0.06)
      // and the peak matches the derived amplitude
      expect(max, limb.id).toBeCloseTo(limbMaxAngle(signal, limb), 2)
    }
  })

  it('wings mirror: opposite joint angles, identical tip motion', () => {
    const wings = limbs.find((l) => l.kind === 'wings')!
    const signal = signalFor(wings.channelId)
    for (let deg = 0; deg < 360; deg += 15) {
      const a = limbJointAngle(signal, wings, (deg / 360) * TWO_PI)
      const rot = wingRotations(a)
      expect(rot.left).toBeCloseTo(-rot.right, 12)
      // both tips rise and fall together — a flap, not a see-saw roll
      expect(wingTipRise(rot.left, wings.length)).toBeCloseTo(
        wingTipRise(-rot.right, wings.length),
        12,
      )
    }
  })

  it('wings flap opposite to the rod: rod up, wingtips down', () => {
    const wings = limbs.find((l) => l.kind === 'wings')!
    const signal = signalFor(wings.channelId)
    for (let deg = 0; deg < 360; deg += 15) {
      const theta = (deg / 360) * TWO_PI
      const d = channelDisplacement(signal, theta)
      const a = limbJointAngle(signal, wings, theta)
      if (Math.abs(d) < 1e-9) continue
      expect(Math.sign(wingTipRise(a, wings.length))).toBe(-Math.sign(d))
    }
  })

  it('tilt channels present the rocker beam-end displacement to the wire', () => {
    // the same math must hold through the sine projection of the lever
    const tilt = channelSignals(nodAndSpin).find((s) => s.kind === 'tilt')!
    if (tilt.kind !== 'tilt') throw new Error('expected tilt')
    const L = tilt.channel.rocker.leverLength
    for (let deg = 0; deg < 360; deg += 10) {
      const theta = (deg / 360) * TWO_PI
      const d = channelDisplacement(tilt, theta)
      expect(Math.abs(d)).toBeLessThanOrEqual(L + 1e-9)
    }
    expect(channelHalfTravel(tilt)).toBeGreaterThan(0)
  })

  it('spin channels present zero displacement — no wire ever moves', () => {
    const spin = channelSignals(steppingOwl).find((s) => s.kind === 'spin')!
    for (let deg = 0; deg < 720; deg += 30) {
      expect(channelDisplacement(spin, (deg / 360) * TWO_PI)).toBe(0)
    }
  })
})

describe('articulated figure layout (Flapping Bird)', () => {
  const stageTop = flappingBird.frame.height + flappingBird.frame.materialThickness

  it('the body stand is anchored to the flap rod tip: pivot = tip rest + wire run', () => {
    const wings = limbs.find((l) => l.kind === 'wings')!
    const signal = signalFor(wings.channelId)
    const tipRest = sourceTipRestY(flappingBird, signal)!
    const baseY = bodyBaseY(flappingBird, bird, signals)
    const pivotY = baseY + limbPivotFrac('wings') * bird.height
    expect(pivotY).toBeCloseTo(tipRest + WIRE_REST_RUN, 9)
  })

  it('the stand actually reaches the stage — the bird never floats', () => {
    const baseY = bodyBaseY(flappingBird, bird, signals)
    expect(baseY).toBeGreaterThan(stageTop)
    expect(baseY - stageTop).toBeLessThan(60)
  })

  it('the tail wire rises from the wag rod: vertical run is positive and rigid', () => {
    const tail = limbs.find((l) => l.kind === 'tail')!
    const signal = signalFor(tail.channelId)
    const tipRest = sourceTipRestY(flappingBird, signal)!
    const baseY = bodyBaseY(flappingBird, bird, signals)
    const pinRestY = baseY + limbPivotFrac('tail') * bird.height
    const run = pinRestY - tipRest
    expect(run).toBeGreaterThan(2)
    // rigidity: pin height minus tip height is the SAME at every angle,
    // because pin rise = wire displacement exactly
    for (let deg = 0; deg < 360; deg += 5) {
      const theta = (deg / 360) * TWO_PI
      const a = limbJointAngle(signal, tail, theta)
      const pinY = pinRestY + pinRise(a, tail.crankArm)
      const tipY = tipRest + channelDisplacement(signal, theta)
      expect(pinY - tipY, `at ${deg}°`).toBeCloseTo(run, 9)
    }
  })

  it('head and wings share the flap rod but keep independent linkage geometry', () => {
    const head = limbs.find((l) => l.kind === 'head')!
    const wings = limbs.find((l) => l.kind === 'wings')!
    expect(head.channelId).toBe(wings.channelId)
    const signal = signalFor(head.channelId)
    const aHead = limbMaxAngle(signal, head)
    const aWings = limbMaxAngle(signal, wings)
    // different crank arms ⇒ different swings from the same displacement
    expect(aHead).not.toBeCloseTo(aWings, 2)
    expect(aHead).toBeCloseTo(Math.asin(channelHalfTravel(signal) / head.crankArm), 9)
  })
})
