import { describe, expect, it } from 'vitest'
import { templates } from '../model/templates'
import { composeToy, MOTIONS, type MotionId } from '../model/catalog'
import { PICKABLE_FIGURES } from '../model/figures'
import { auditPart, BASSWOOD, basswoodAudit, narrowestWeb } from './basswood'
import { generateParts, packSheets, SHEET_HEIGHT, SHEET_WIDTH, type Part } from './svgFlatPack'

const rectPart = (w: number, h: number, holes: Part['holes'] = []): Part => ({
  name: 'test',
  outline: [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ],
  holes,
  width: w,
  height: h,
})
const square = (cx: number, cy: number, s: number) => [
  { x: cx - s / 2, y: cy - s / 2 },
  { x: cx + s / 2, y: cy - s / 2 },
  { x: cx + s / 2, y: cy + s / 2 },
  { x: cx - s / 2, y: cy + s / 2 },
]

describe('basswood audit: the rules themselves', () => {
  it('passes a plain sturdy plate', () => {
    expect(auditPart(rectPart(40, 20, [square(20, 10, 4)]))).toEqual([])
  })

  it('catches a thin neck carrying a big piece (dumbbell)', () => {
    // two 20 mm squares joined by a 1.2 mm bridge
    const dumbbell = [
      { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 9.4 }, { x: 30, y: 9.4 }, { x: 30, y: 0 },
      { x: 50, y: 0 }, { x: 50, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 10.6 }, { x: 20, y: 10.6 },
      { x: 20, y: 20 }, { x: 0, y: 20 },
    ]
    expect(narrowestWeb(dumbbell)).toBeCloseTo(1.2, 1)
    const issues = auditPart({ ...rectPart(50, 20), outline: dumbbell })
    expect(issues.map((i) => i.rule)).toEqual(['web'])
  })

  it('does not mistake a pointed tip for a neck', () => {
    const arrow = [
      { x: 0, y: 0 }, { x: 30, y: 0 }, { x: 45, y: 6 }, { x: 30, y: 12 }, { x: 0, y: 12 },
    ]
    expect(narrowestWeb(arrow)).toBe(Infinity)
  })

  it('catches a hole too close to an edge, and two holes too close together', () => {
    expect(auditPart(rectPart(40, 20, [square(3, 10, 4)])).map((i) => i.rule)).toEqual(['ligament'])
    expect(
      auditPart(rectPart(40, 20, [square(15, 10, 4), square(20, 10, 4)])).map((i) => i.rule),
    ).toEqual(['ligament'])
  })

  it('catches slivers and parts bigger than a sheet', () => {
    expect(auditPart(rectPart(30, 2)).map((i) => i.rule)).toEqual(['size'])
    expect(auditPart(rectPart(320, 210)).map((i) => i.rule)).toEqual(['sheet'])
    // a long part that fits turned is fine
    expect(auditPart(rectPart(190, 280))).toEqual([])
  })

  it('flags a design drawn for another sheet thickness', () => {
    const spec = structuredClone(templates.simplest)
    spec.frame.materialThickness = 4
    expect(basswoodAudit(spec).some((i) => i.rule === 'thickness')).toBe(true)
  })

  it('flags a user edit that leaves too little wood: a cam hole near its rim', () => {
    const spec = structuredClone(templates.simplest)
    const cam = spec.mechanism.cams[0]
    if (cam.kind !== 'eccentric') throw new Error('expected an eccentric cam')
    cam.eccentricity = cam.radius - 4 // hole wall = 4 − shaft radius ≈ 1 mm
    expect(basswoodAudit(spec).some((i) => i.rule === 'ligament' && i.part.startsWith('cam-'))).toBe(true)
  })
})

describe('every shipped toy is buildable from 3 mm basswood', () => {
  for (const [key, spec] of Object.entries(templates)) {
    it(`${key}: every laser part passes the basswood audit`, () => {
      expect(spec.frame.materialThickness).toBe(BASSWOOD.thickness)
      expect(basswoodAudit(spec)).toEqual([])
    })

    it(`${key}: nests onto standard sheets with nothing overlapping or off the sheet`, () => {
      const sheets = packSheets(spec)
      const placed = sheets.flatMap((s) => s.parts)
      expect(placed).toHaveLength(generateParts(spec).length)
      for (const sheet of sheets) {
        expect(sheet.width).toBe(SHEET_WIDTH)
        expect(sheet.height).toBe(SHEET_HEIGHT)
        const boxes = sheet.parts.map(({ part, dx, dy }) => {
          const xs = part.outline.map((p) => p.x + dx)
          const ys = part.outline.map((p) => p.y + dy)
          return { name: part.name, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
        })
        for (const b of boxes) {
          expect(b.x0, b.name).toBeGreaterThanOrEqual(0)
          expect(b.y0, b.name).toBeGreaterThanOrEqual(0)
          expect(b.x1, b.name).toBeLessThanOrEqual(sheet.width)
          expect(b.y1, b.name).toBeLessThanOrEqual(sheet.height)
        }
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]
            const b = boxes[j]
            const apart = a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0
            expect(apart, `${a.name} vs ${b.name}`).toBe(true)
          }
      }
    })
  }

  it('every figure-first recipe passes too (each figure, each mechanism)', () => {
    const motions = Object.keys(MOTIONS) as MotionId[]
    // every figure on its best motion, and every mechanism at least once
    const combos = new Map<string, [string, MotionId]>()
    PICKABLE_FIGURES.forEach((f, i) => {
      combos.set(`${f.id}+${motions[i % motions.length]}`, [f.id, motions[i % motions.length]])
    })
    for (const m of motions) combos.set(`whale+${m}`, ['whale', m])
    for (const [label, [shape, motion]] of combos)
      expect(basswoodAudit(composeToy(shape, motion)), label).toEqual([])
  })

  it('laminated parts come as whole layers of the sheet', () => {
    const parts = generateParts(templates.simplest).map((p) => p.name)
    for (const cam of templates.simplest.mechanism.cams) {
      const layers = parts.filter((n) => n.replace(/-layer\d+$/, '') === `cam-${cam.kind}`)
      expect(layers.length * BASSWOOD.thickness).toBe(cam.thickness)
    }
    for (const rod of templates.simplest.mechanism.pushrods) {
      const layers = parts.filter((n) => n.startsWith(`pushrod-${rod.id}`))
      expect(layers.length * BASSWOOD.thickness).toBe(rod.rodWidth)
    }
  })
})

describe('detail survives the trip to the sheet', () => {
  it('a figure with a raised layer cuts two detail plates and scores their footprint', async () => {
    const { flatPackSvg } = await import('./svgFlatPack')
    const { buildPrintParts } = await import('./stlExport')
    const { FIGURE_SHAPES } = await import('../model/figures')
    const spec = composeToy('whale', 'bob')
    const whale = FIGURE_SHAPES.whale
    const parts = generateParts(spec)
    const figure = parts.find((p) => p.name === 'figure-figure-whale')!
    // scored: every engraved line + one closed footprint per layer
    expect(figure.engrave).toHaveLength(whale.engrave!.length + whale.layers!.length)
    for (const line of figure.engrave!)
      for (const p of line) {
        expect(p.x).toBeGreaterThanOrEqual(-0.5)
        expect(p.x).toBeLessThanOrEqual(figure.width + 0.5)
        expect(p.y).toBeGreaterThanOrEqual(-0.5)
        expect(p.y).toBeLessThanOrEqual(figure.height + 0.5)
      }
    const details = parts.filter((p) => p.name.startsWith('detail-figure-whale-'))
    expect(details).toHaveLength(whale.layers!.length * 2)
    for (const d of details) expect(auditPart(d)).toEqual([])
    const svg = flatPackSvg(spec)
    const score = /<g id="score"[^>]*>([\s\S]*?)<\/g>/.exec(svg)![1]
    expect((score.match(/<path /g) ?? []).length).toBe(figure.engrave!.length)
    // scored lines are open paths: never a closed cut
    expect(score).not.toContain(' Z')
    // printed: the layer is raised relief on the figure itself
    const printed = buildPrintParts(spec).find((p) => p.name === 'figure-figure-whale')!
    printed.geometry.computeBoundingBox()
    const bb = printed.geometry.boundingBox!
    expect(bb.max.z - bb.min.z).toBeCloseTo(4 + 1.2, 3)
  })
})
