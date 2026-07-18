import { describe, expect, it } from 'vitest'
import { FIGURE_SHAPES, figureOutline } from './figures'

describe('figure shape library', () => {
  it('every shape is a sane closed outline in normalized bounds', () => {
    for (const shape of Object.values(FIGURE_SHAPES)) {
      expect(shape.outline.length, shape.id).toBeGreaterThanOrEqual(20)
      for (const p of shape.outline) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y), shape.id).toBe(true)
        expect(p.x, shape.id).toBeGreaterThanOrEqual(-0.5)
        expect(p.x, shape.id).toBeLessThanOrEqual(0.5)
        expect(p.y, shape.id).toBeGreaterThanOrEqual(0)
        expect(p.y, shape.id).toBeLessThanOrEqual(1)
      }
      // feet on the ground: at least one point at y ≈ 0, one near the top
      expect(Math.min(...shape.outline.map((p) => p.y)), shape.id).toBeLessThan(0.02)
      expect(Math.max(...shape.outline.map((p) => p.y)), shape.id).toBeGreaterThan(0.9)
      // no zero-length edges (degenerate cut paths)
      for (let i = 0; i < shape.outline.length; i++) {
        const a = shape.outline[i]
        const b = shape.outline[(i + 1) % shape.outline.length]
        expect(Math.hypot(b.x - a.x, b.y - a.y), `${shape.id} edge ${i}`).toBeGreaterThan(0.005)
      }
      expect(shape.defaultWidth).toBeGreaterThan(5)
      expect(shape.defaultHeight).toBeGreaterThan(5)
    }
  })

  it('outlines have enough area to survive a laser cut (no hairline figure)', () => {
    for (const shape of Object.values(FIGURE_SHAPES)) {
      // shoelace area of the normalized outline; a figure should fill a
      // meaningful fraction of its bounding box
      let area = 0
      const pts = shape.outline
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]
        const b = pts[(i + 1) % pts.length]
        area += a.x * b.y - b.x * a.y
      }
      expect(Math.abs(area) / 2, shape.id).toBeGreaterThan(0.12)
    }
  })

  it('figureOutline scales to real dimensions with feet at y = 0', () => {
    const pts = figureOutline('dancer', 34, 42)
    expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(0, 1)
    expect(Math.max(...pts.map((p) => p.y))).toBeCloseTo(42, 1)
    expect(Math.max(...pts.map((p) => Math.abs(p.x)))).toBeLessThanOrEqual(17.01)
    expect(() => figureOutline('no-such-shape', 10, 10)).toThrow('unknown figure shape')
  })
})
