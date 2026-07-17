import { describe, expect, it } from 'vitest'
import type { EccentricCamSpec, PetalCamSpec, SnailCamSpec } from '../model/types'
import { camOutline, camRadius } from './camProfile'
import { displacementTable, sampleDisplacement } from './follower'

const eccentric: EccentricCamSpec = {
  id: 'e',
  kind: 'eccentric',
  radius: 20,
  eccentricity: 8,
  position: 0.5,
  phaseDeg: 0,
  thickness: 6,
}

const petal: PetalCamSpec = {
  id: 'p',
  kind: 'petal',
  baseRadius: 16,
  lift: 8,
  lobes: 4,
  position: 0.5,
  phaseDeg: 0,
  thickness: 6,
}

const snail: SnailCamSpec = {
  id: 's',
  kind: 'snail',
  baseRadius: 14,
  lift: 10,
  position: 0.5,
  phaseDeg: 0,
  thickness: 6,
}

describe('camRadius', () => {
  it('eccentric profile spans R−e to R+e', () => {
    expect(camRadius(eccentric, 0)).toBeCloseTo(28, 6)
    expect(camRadius(eccentric, Math.PI)).toBeCloseTo(12, 6)
  })

  it('petal profile spans base to base+lift with n lobes', () => {
    expect(camRadius(petal, 0)).toBeCloseTo(16, 6)
    expect(camRadius(petal, Math.PI / 4)).toBeCloseTo(24, 6)
    // one full lobe period later, same radius
    expect(camRadius(petal, 0.3 + Math.PI / 2)).toBeCloseTo(camRadius(petal, 0.3), 6)
  })

  it('snail spirals from base+lift down to base over one revolution', () => {
    expect(camRadius(snail, 0)).toBeCloseTo(24, 6)
    expect(camRadius(snail, Math.PI)).toBeCloseTo(19, 6)
    expect(camRadius(snail, 2 * Math.PI - 1e-9)).toBeCloseTo(14, 3)
  })
})

describe('camOutline', () => {
  it('produces a closed, strictly positive-radius polygon', () => {
    for (const cam of [eccentric, petal]) {
      const pts = camOutline(cam, 256)
      expect(pts).toHaveLength(256)
      for (const p of pts) {
        expect(Math.hypot(p.x, p.y)).toBeGreaterThan(0)
      }
      // first and last samples are adjacent on the profile
      const gap = Math.hypot(pts[0].x - pts[255].x, pts[0].y - pts[255].y)
      expect(gap).toBeLessThan(2)
    }
  })

  it('snail outline closes through its step, which spans the lift', () => {
    const pts = camOutline(snail, 256)
    const gap = Math.hypot(pts[0].x - pts[255].x, pts[0].y - pts[255].y)
    expect(gap).toBeGreaterThan(snail.lift * 0.8)
    expect(gap).toBeLessThan(snail.lift * 1.2)
  })
})

describe('displacementTable', () => {
  it('eccentric cam lift equals twice the eccentricity (simple harmonic motion)', () => {
    const table = displacementTable(eccentric, 24)
    expect(table.lift).toBeCloseTo(2 * eccentric.eccentricity, 1)
    expect(table.max).toBeCloseTo(eccentric.radius + eccentric.eccentricity, 1)
    expect(table.min).toBeCloseTo(eccentric.radius - eccentric.eccentricity, 1)
  })

  it('eccentric displacement is continuous (no jumps between steps)', () => {
    const { heights } = displacementTable(eccentric, 24)
    for (let i = 0; i < heights.length; i++) {
      const next = heights[(i + 1) % heights.length]
      expect(Math.abs(next - heights[i])).toBeLessThan(0.5)
    }
  })

  it('petal cam bounces once per lobe', () => {
    const { heights } = displacementTable(petal, 8)
    let maxima = 0
    const n = heights.length
    for (let i = 0; i < n; i++) {
      const prev = heights[(i - 1 + n) % n]
      const next = heights[(i + 1) % n]
      if (heights[i] > prev && heights[i] >= next) maxima++
    }
    expect(maxima).toBe(petal.lobes)
  })

  it('petal displacement repeats with the lobe period', () => {
    const table = displacementTable(petal, 8)
    const period = (2 * Math.PI) / petal.lobes
    for (const theta of [0.1, 0.9, 2.2]) {
      expect(sampleDisplacement(table, theta + period)).toBeCloseTo(
        sampleDisplacement(table, theta),
        1,
      )
    }
  })

  it('snail cam rises then drops sharply once per revolution', () => {
    const { heights } = displacementTable(snail, 12)
    let drops = 0
    const n = heights.length
    for (let i = 0; i < n; i++) {
      const next = heights[(i + 1) % n]
      if (heights[i] - next > snail.lift / 2) drops++
    }
    expect(drops).toBe(1)
  })

  it('cam phase shifts the curve', () => {
    const base = displacementTable(eccentric, 24)
    const shifted = displacementTable({ ...eccentric, phaseDeg: 90 }, 24)
    expect(sampleDisplacement(shifted, 0)).toBeCloseTo(
      sampleDisplacement(base, Math.PI / 2),
      1,
    )
  })
})
