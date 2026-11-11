import { describe, expect, it } from 'vitest'
import type { PropSpec } from '../model/types'
import { PROP_SHAPES } from '../model/props'
import { simplestAutomaton } from '../model/templates'
import { generateParts, propConflicts } from '../export/svgFlatPack'
import { propPlateOutline, propRowZ, propStageSlots, propTabs, propWorldX } from './propLayout'

const frame = simplestAutomaton.frame
const prop = (shape: string, over: Partial<PropSpec> = {}): PropSpec => {
  const s = PROP_SHAPES[shape]
  return {
    id: `prop-${shape}`,
    shape,
    position: 0.5,
    row: s.defaultRow,
    width: s.defaultWidth,
    height: s.defaultHeight,
    color: s.defaultColor,
    ...over,
  }
}

describe('scenery layout', () => {
  it('every prop shape has a flat centred base and enough outline', () => {
    for (const s of Object.values(PROP_SHAPES)) {
      const base = s.outline.filter((p) => p.y < 1e-6)
      expect(base.length, s.id).toBeGreaterThanOrEqual(2)
      const minX = Math.min(...base.map((p) => p.x))
      const maxX = Math.max(...base.map((p) => p.x))
      expect(minX + maxX, `${s.id} base centred`).toBeCloseTo(0, 2)
      expect(s.outline.length, s.id).toBeGreaterThanOrEqual(20)
      for (const p of s.outline) {
        expect(Math.abs(p.x), s.id).toBeLessThanOrEqual(0.5)
        expect(p.y, s.id).toBeGreaterThanOrEqual(0)
        expect(p.y, s.id).toBeLessThanOrEqual(1)
      }
    }
  })

  it('rows sit inside the walls, mirrored front/back', () => {
    const z = propRowZ(frame, 'front')
    expect(z).toBeGreaterThan(0)
    expect(propRowZ(frame, 'back')).toBeCloseTo(-z)
    // clear of the wall-tab slots along the stage edge
    expect(z + frame.materialThickness / 2).toBeLessThan(frame.depth / 2 - frame.materialThickness)
  })

  it('wide props get two tabs, narrow bases become one full-width tab', () => {
    expect(propTabs(prop('waves'))).toHaveLength(2)
    const tree = propTabs(prop('tree'))
    expect(tree).toHaveLength(1)
    expect(tree[0].width).toBeLessThanOrEqual(12)
    expect(tree[0].width).toBeGreaterThan(3)
  })

  it('plate outline hangs its tabs exactly one sheet below the base', () => {
    for (const shape of Object.keys(PROP_SHAPES)) {
      const p = prop(shape)
      const t = 3
      const plate = propPlateOutline(p, t)
      expect(Math.min(...plate.map((q) => q.y)), shape).toBeCloseTo(-t)
      expect(Math.max(...plate.map((q) => q.y)), shape).toBeCloseTo(p.height, 0)
      const tabs = propTabs(p)
      const below = plate.filter((q) => q.y < -t + 1e-6)
      expect(below, shape).toHaveLength(tabs.length * 2)
      // no zero-length edges
      for (let i = 0; i < plate.length; i++) {
        const a = plate[i]
        const b = plate[(i + 1) % plate.length]
        expect(Math.hypot(b.x - a.x, b.y - a.y), `${shape} edge ${i}`).toBeGreaterThan(1e-4)
      }
    }
  })

  it('stage slots land where the scene stands the prop, sized to the tab', () => {
    const p = prop('waves', { position: 0.5 })
    const spec = { ...simplestAutomaton, props: [p] }
    const slots = propStageSlots(frame, p)
    expect(propWorldX(frame, p)).toBeCloseTo(0)
    const stage = generateParts(spec).find((q) => q.name === 'stage')!
    const bare = generateParts(simplestAutomaton).find((q) => q.name === 'stage')!
    expect(stage.holes.length - bare.holes.length).toBe(slots.length)
    const kerf = spec.export.kerf
    for (const [i, slot] of slots.entries()) {
      const hole = stage.holes[bare.holes.length + i]
      const xs = hole.map((q) => q.x)
      const ys = hole.map((q) => q.y)
      expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(slot.x + frame.width / 2)
      expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(slot.z + frame.depth / 2)
      // slot narrows by the kerf so the tab is a friction fit
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(slot.width - kerf)
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(frame.materialThickness - kerf)
    }
    expect(propConflicts(spec)).toEqual([])
  })

  it('flags props that overlap each other or leave the stage', () => {
    const a = prop('tree', { id: 'a', position: 0.5 })
    const b = prop('tree', { id: 'b', position: 0.5 })
    expect(propConflicts({ ...simplestAutomaton, props: [a, b] })).toEqual(['b'])
    const off = prop('tree', { id: 'off', position: 0.0 })
    expect(propConflicts({ ...simplestAutomaton, props: [off] })).toEqual(['off'])
  })
})
