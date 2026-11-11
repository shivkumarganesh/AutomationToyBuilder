import { describe, expect, it } from 'vitest'
import { templates } from '../model/templates'
import { composeToy } from '../model/catalog'
import { interiorWidth } from '../model/types'
import { buildGuide, guideHtml, shaftOrder } from './buildGuide'
import { generateParts } from './svgFlatPack'
import { buildFramePanels, buildPrintParts, layoutPrintParts, PRINT_PLATE_WIDTH } from './stlExport'

const all = { ...templates, whale: composeToy('whale', 'bob'), ray: composeToy('ray', 'swoop') }

describe('build guide', () => {
  for (const [key, spec] of Object.entries(all)) {
    it(`${key}: parts list accounts for every generated part, both routes`, () => {
      const laser = buildGuide(spec, 'laser')
      expect(laser.parts.reduce((n, p) => n + p.qty, 0)).toBe(generateParts(spec).length)
      const print = buildGuide(spec, 'print')
      expect(print.parts.reduce((n, p) => n + p.qty, 0)).toBe(buildPrintParts(spec).length)
      for (const g of [laser, print]) {
        expect(g.parts.every((p) => p.label !== 'Part'), 'every part has a plain-language label').toBe(true)
        expect(g.hardware.length).toBeGreaterThan(2)
        expect(g.steps.length).toBeGreaterThanOrEqual(6)
        expect(g.footprint.width).toBeGreaterThan(10)
        expect(g.footprint.height).toBeGreaterThan(10)
      }
      // the laser route must tell the maker to buy a shaft long enough for the box
      expect(laser.hardware.some((h) => h.item.includes(`${spec.frame.width + 24} mm`))).toBe(true)
    })

    it(`${key}: shaft loading order is sorted and inside the box`, () => {
      const order = shaftOrder(spec)
      const inner = interiorWidth(spec.frame)
      for (let i = 0; i < order.length; i++) {
        expect(order[i].mm).toBeGreaterThan(0)
        expect(order[i].mm).toBeLessThan(inner)
        if (i > 0) expect(order[i].mm).toBeGreaterThanOrEqual(order[i - 1].mm)
      }
    })
  }

  it('printable guide is a complete HTML page naming the toy', () => {
    const html = guideHtml(templates.simplest, 'laser')
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('Simplest Automaton')
    expect(html).toContain('Assembly')
    expect(html).not.toContain('undefined')
  })
})

describe('3D-print route builds the whole toy', () => {
  it('prints all six box panels at the sheet thickness', () => {
    const spec = templates.simplest
    const panels = buildFramePanels(spec)
    expect(panels.map((p) => p.name).sort()).toEqual(
      ['frame-bottom', 'frame-side-left', 'frame-side-right', 'frame-stage', 'frame-wall-back', 'frame-wall-front'],
    )
    for (const p of panels) {
      p.geometry.computeBoundingBox()
      const bb = p.geometry.boundingBox!
      expect(bb.max.z - bb.min.z).toBeCloseTo(spec.frame.materialThickness)
    }
  })

  it('printed joints carry clearance: tabs shrink, slots grow vs the laser fit', () => {
    const spec = templates.simplest
    const c = spec.export.fdmClearance
    const loose = generateParts({ ...spec, export: { ...spec.export, kerf: -2 * c } })
    const nominal = generateParts({ ...spec, export: { ...spec.export, kerf: 0 } })
    const span = (pts: { x: number; y: number }[]) =>
      Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x))
    const slot = (parts: typeof loose) => parts.find((p) => p.name === 'stage')!.holes[0]
    // a wall-tab slot in the stage opens by 2 × clearance
    expect(span(slot(loose)) - span(slot(nominal))).toBeCloseTo(2 * c)
    // the shaft bearing hole opens too
    const bearing = (parts: typeof loose) => parts.find((p) => p.name === 'side-left')!.holes[0]
    expect(span(bearing(loose))).toBeGreaterThan(span(bearing(nominal)))
  })

  it('packs the plate in rows no wider than the bed (unless one part is)', () => {
    for (const spec of Object.values(all)) {
      const placed = layoutPrintParts(spec)
      expect(placed).toHaveLength(buildPrintParts(spec).length)
      for (const p of placed) {
        const bb = p.geometry.boundingBox!
        const w = bb.max.x - bb.min.x
        const left = p.position[0] + bb.min.x
        expect(left).toBeGreaterThanOrEqual(-1e-6)
        if (left > 1e-6) expect(left + w).toBeLessThanOrEqual(PRINT_PLATE_WIDTH + 1e-6)
        // resting on the plate
        expect(p.position[2] + bb.min.z).toBeCloseTo(0)
      }
      // no two parts overlap in plan
      for (let i = 0; i < placed.length; i++)
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i]
          const b = placed[j]
          const ab = a.geometry.boundingBox!
          const bb = b.geometry.boundingBox!
          const sepX =
            a.position[0] + ab.max.x <= b.position[0] + bb.min.x + 1e-6 ||
            b.position[0] + bb.max.x <= a.position[0] + ab.min.x + 1e-6
          const sepY =
            a.position[1] + ab.max.y <= b.position[1] + bb.min.y + 1e-6 ||
            b.position[1] + bb.max.y <= a.position[1] + ab.min.y + 1e-6
          expect(sepX || sepY, `${a.name} vs ${b.name}`).toBe(true)
        }
    }
  })
})
