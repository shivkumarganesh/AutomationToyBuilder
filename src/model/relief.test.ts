import { describe, expect, it } from 'vitest'
import { figureOutline, PICKABLE_FIGURES } from './figures'
import { BASSWOOD, inside, narrowestWeb } from './webCheck'
import { domeSlices, insetOutline, levelAt, MAX_RELIEF, reliefLayers } from './relief'

const square = (s: number) => [
  { x: -s / 2, y: 0 },
  { x: s / 2, y: 0 },
  { x: s / 2, y: s },
  { x: -s / 2, y: s },
]
const box = (pts: { x: number; y: number }[]) => ({
  w: Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)),
  h: Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y)),
  cx: (Math.max(...pts.map((p) => p.x)) + Math.min(...pts.map((p) => p.x))) / 2,
  cy: (Math.max(...pts.map((p) => p.y)) + Math.min(...pts.map((p) => p.y))) / 2,
})

describe('depth layers', () => {
  it('insets a square by the asked distance on every side, staying centred', () => {
    const [inner, ...rest] = insetOutline(square(40), 5)
    expect(rest).toHaveLength(0)
    const b = box(inner)
    expect(b.w).toBeCloseTo(30, 0)
    expect(b.h).toBeCloseTo(30, 0)
    expect(b.cx).toBeCloseTo(0, 0)
    expect(b.cy).toBeCloseTo(20, 0)
    // counter-clockwise
    let a = 0
    inner.forEach((p, i) => {
      const q = inner[(i + 1) % inner.length]
      a += p.x * q.y - q.x * p.y
    })
    expect(a).toBeGreaterThan(0)
  })

  it('gives nothing when the inset swallows the shape', () => {
    expect(insetOutline(square(8), 5)).toEqual([])
  })

  it('an inset that splits a shape gives one plate per piece', () => {
    // two 20 mm squares joined by a 3 mm bridge: the bridge does not survive
    const dumbbell = [
      { x: -25, y: 0 }, { x: -5, y: 0 }, { x: -5, y: 8.5 }, { x: 5, y: 8.5 }, { x: 5, y: 0 },
      { x: 25, y: 0 }, { x: 25, y: 20 }, { x: 5, y: 20 }, { x: 5, y: 11.5 }, { x: -5, y: 11.5 },
      { x: -5, y: 20 }, { x: -25, y: 20 },
    ]
    const pieces = insetOutline(dumbbell, 2.5)
    expect(pieces).toHaveLength(2)
    expect(box(pieces[0]).cx).toBeCloseTo(-15, 0)
    expect(box(pieces[1]).cx).toBeCloseTo(15, 0)
  })

  it('every library figure: plates are nested, cuttable in basswood, and each level is smaller', () => {
    for (const shape of PICKABLE_FIGURES) {
      const outline = figureOutline(shape.id, shape.defaultWidth, shape.defaultHeight)
      const levels = reliefLayers(outline, MAX_RELIEF)
      expect(levels.length, shape.id).toBeLessThanOrEqual(MAX_RELIEF)
      let below: { x: number; y: number }[][] = [outline]
      for (const [k, plates] of levels.entries()) {
        expect(plates.length, `${shape.id} level ${k + 1}`).toBeGreaterThanOrEqual(1)
        for (const plate of plates) {
          // nested: this plate lies on one of the plates below
          const on = plate.filter((p) => below.some((b) => inside(b, p))).length
          expect(on / plate.length, `${shape.id} level ${k + 1}`).toBeGreaterThan(0.97)
          expect(narrowestWeb(plate), `${shape.id} level ${k + 1}`).toBeGreaterThanOrEqual(BASSWOOD.minWeb)
          const b = box(plate)
          expect(Math.min(b.w, b.h), `${shape.id} level ${k + 1}`).toBeGreaterThanOrEqual(7)
        }
        below = plates
      }
    }
    // a chunky figure really does get depth; a symmetric one gets it on both sides
    const whale = PICKABLE_FIGURES.find((s) => s.id === 'whale')!
    expect(reliefLayers(figureOutline('whale', whale.defaultWidth, whale.defaultHeight), 2)).toHaveLength(2)
    const fly = PICKABLE_FIGURES.find((s) => s.id === 'butterfly')!
    const wings = reliefLayers(figureOutline('butterfly', fly.defaultWidth, fly.defaultHeight), 2)[1]
    expect(wings.length).toBeGreaterThanOrEqual(2)
    expect(box(wings[0]).cx).toBeCloseTo(-box(wings[wings.length - 1]).cx, 0)
  })

  it('a thin figure simply gets fewer layers — never an uncuttable one', () => {
    const stick = [
      { x: -2, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 40 },
      { x: -2, y: 40 },
    ]
    expect(reliefLayers(stick, 3)).toEqual([])
  })

  it('the printed dome covers the same footprint and height as the laser stack, rising monotonically', () => {
    const whale = PICKABLE_FIGURES.find((s) => s.id === 'whale')!
    const outline = figureOutline('whale', whale.defaultWidth, whale.defaultHeight)
    const laser = reliefLayers(outline, 2)
    const dome = domeSlices(outline, 2, 3)
    expect(dome.length).toBeGreaterThanOrEqual(6)
    expect(dome[0].from).toBe(0)
    expect(dome[dome.length - 1].to).toBeCloseTo(laser.length * 3, 6)
    for (let i = 1; i < dome.length; i++) {
      expect(dome[i].from).toBeCloseTo(dome[i - 1].to, 9)
      expect(dome[i].to).toBeGreaterThan(dome[i].from)
      expect(box(dome[i].outlines[0]).w).toBeLessThan(box(dome[i - 1].outlines[0]).w)
    }
    // quarter-circle: the first slices are the tall ones
    expect(dome[0].to - dome[0].from).toBeGreaterThan(dome[dome.length - 1].to - dome[dome.length - 1].from)
    expect(domeSlices(outline, 0, 3)).toEqual([])
  })

  it('levelAt counts the plates under a point', () => {
    const levels = reliefLayers(square(40), 2)
    expect(levelAt(levels, { x: 0, y: 20 })).toBe(2)
    expect(levelAt(levels, { x: 16, y: 20 })).toBe(1)
    expect(levelAt(levels, { x: 19.5, y: 20 })).toBe(0)
  })
})
