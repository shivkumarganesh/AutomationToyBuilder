import { describe, expect, it } from 'vitest'
import { gearedHummingbird } from '../model/templates'
import {
  camAngularRate,
  camShaftY,
  gearRatio,
  layshaftY,
  pitchRadius,
} from '../model/types'
import { gearAngles, gearOutline, gearTipRadius, meshAlignment } from './gearProfile'
import { channelSignals } from './channels'
import { displacementTable } from './follower'

describe('gear train mesh invariants', () => {
  const spec = gearedHummingbird
  const gear = spec.mechanism.gearTrain!
  const r1 = pitchRadius(gear.module, gear.teethDrive)
  const r2 = pitchRadius(gear.module, gear.teethDriven)

  it('centre distance equals the sum of pitch radii exactly', () => {
    const centreDistance = spec.mechanism.shaftHeight - layshaftY(spec.mechanism)
    expect(centreDistance).toBeCloseTo(r1 + r2, 9)
  })

  it('speed ratio is the tooth ratio and an integer', () => {
    expect(gearRatio(gear)).toBe(gear.teethDrive / gear.teethDriven)
    expect(Number.isInteger(gearRatio(gear))).toBe(true)
  })

  it('the shafts counter-rotate with matched pitch-line speeds', () => {
    const a0 = gearAngles(gear, 0)
    const a1 = gearAngles(gear, 0.3)
    const w1 = a1.drive - a0.drive
    const w2 = a1.driven - a0.driven
    expect(Math.sign(w2)).toBe(-Math.sign(w1))
    // v = r·ω equal at the pitch point — no slip
    expect(Math.abs(r1 * w1)).toBeCloseTo(Math.abs(r2 * w2), 9)
  })

  it('teeth stay interleaved at the mesh line through full revolutions', () => {
    const p1 = (2 * Math.PI) / gear.teethDrive
    const p2 = (2 * Math.PI) / gear.teethDriven
    for (let deg = 0; deg <= 720; deg += 7) {
      const theta = (deg * Math.PI) / 180
      const { drive, driven } = meshAlignment(gear, theta)
      // a drive tooth centre and a driven tooth gap cross the mesh line at
      // the same crank angles: their pitch-normalised phases stay equal, so
      // whenever a tooth is at the mesh line (phase 0) a gap receives it
      expect(Math.abs(drive / p1 - driven / p2), `at crank ${deg}°`).toBeLessThan(1e-9)
    }
  })

  it('gears fit inside the box and clear the floor', () => {
    const layY = layshaftY(spec.mechanism)
    expect(layY - gearTipRadius(gear.teethDriven, gear.module)).toBeGreaterThan(0)
    expect(gearTipRadius(gear.teethDrive, gear.module)).toBeLessThan(spec.frame.depth / 2)
  })

  it('gear outlines close with teeth at the tip radius', () => {
    const pts = gearOutline(gear.teethDrive, gear.module)
    expect(pts).toHaveLength(gear.teethDrive * 4)
    const maxR = Math.max(...pts.map((p) => Math.hypot(p.x, p.y)))
    expect(maxR).toBeCloseTo(gearTipRadius(gear.teethDrive, gear.module), 6)
  })
})

describe('layshaft cams', () => {
  const spec = gearedHummingbird
  const flutter = spec.mechanism.cams.find((c) => c.id === 'cam-flutter')!

  it('layshaft cams counter-rotate at the gear ratio', () => {
    expect(camAngularRate(spec.mechanism, flutter)).toBe(-2)
    expect(camShaftY(spec.mechanism, flutter)).toBeCloseTo(layshaftY(spec.mechanism), 9)
  })

  it('a 6-lobe petal on a 2x layshaft bounces 12 times per crank turn', () => {
    const signal = channelSignals(spec).find((s) => s.channel.id === 'rod-bee')!
    if (signal.kind !== 'lift') throw new Error('rod-bee must be a lift channel')
    const { heights } = signal.table
    const n = heights.length
    let maxima = 0
    for (let i = 0; i < n; i++) {
      const prev = heights[(i - 1 + n) % n]
      const next = heights[(i + 1) % n]
      if (heights[i] > prev && heights[i] >= next) maxima++
    }
    expect(maxima).toBe(12)
  })

  it('cams above the floor: layshaft cam max radius clears the box bottom', () => {
    const layY = layshaftY(spec.mechanism)
    expect(layY - (12 + 5)).toBeGreaterThan(0) // baseRadius + lift
  })

  it('a snail cam on the layshaft still rises gradually and drops once per cam rev', () => {
    const snail = {
      id: 's',
      kind: 'snail' as const,
      baseRadius: 12,
      lift: 8,
      position: 0.5,
      phaseDeg: 0,
      thickness: 6,
      shaft: 'lay' as const,
    }
    // rate −2: two cam revolutions per crank revolution → two sharp drops
    const table = displacementTable(snail, 8, -2)
    const n = table.heights.length
    let drops = 0
    let rises = 0
    for (let i = 0; i < n; i++) {
      const delta = table.heights[(i + 1) % n] - table.heights[i]
      if (-delta > snail.lift / 2) drops++
      if (delta > snail.lift / 2) rises++
    }
    expect(drops).toBe(2)
    expect(rises).toBe(0) // an upward fling would jam the real toy
  })
})
