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

describe('detail and depth survive the trip to the sheet', () => {
  it('a flat figure: detail plates are cut twice and their footprint is scored', async () => {
    const { flatPackSvg } = await import('./svgFlatPack')
    const { buildPrintParts } = await import('./stlExport')
    const { FIGURE_SHAPES } = await import('../model/figures')
    const spec = composeToy('whale', 'bob')
    spec.characters[0].relief = 0
    const whale = FIGURE_SHAPES.whale
    const parts = generateParts(spec)
    const figure = parts.find((p) => p.name === 'figure-figure-whale')!
    // scored: every engraved line + one footprint per detail plate; a line that
    // runs onto a detail plate continues on that plate, never under it
    const onPlates = parts
      .filter((p) => p.name.startsWith('detail-figure-whale-') && p.name.endsWith('-front'))
      .reduce((n, p) => n + (p.engrave ?? []).length, 0)
    expect(figure.engrave!.length + onPlates).toBeGreaterThanOrEqual(whale.engrave!.length + whale.layers!.length)
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
    expect(parts.some((p) => p.name.startsWith('depth-'))).toBe(false)
    const svg = flatPackSvg(spec)
    const score = /<g id="score"[^>]*>([\s\S]*?)<\/g>/.exec(svg)![1]
    expect((score.match(/<path /g) ?? []).length).toBe(figure.engrave!.length + onPlates * 2)
    // scored lines are open paths: never a closed cut
    expect(score).not.toContain(' Z')
    // printed: one piece, the detail plate as raised relief
    const printed = buildPrintParts(spec).find((p) => p.name === 'figure-figure-whale')!
    printed.geometry.computeBoundingBox()
    const bb = printed.geometry.boundingBox!
    expect(bb.max.z - bb.min.z).toBeCloseTo(4 + 1.2, 3)
  })

  it('a figure with depth: every level is cut for both faces, and nothing scored is lost or buried', async () => {
    const { figureStack } = await import('../scene/reliefLayout')
    const { FIGURE_SHAPES } = await import('../model/figures')
    const spec = composeToy('whale', 'bob')
    const c = spec.characters[0]
    expect(c.relief).toBe(2)
    const stack = figureStack(c)
    expect(stack.levels).toHaveLength(2)
    const parts = generateParts(spec)
    const plates = stack.levels.reduce((n, l) => n + l.length, 0)
    const depth = parts.filter((p) => p.name.startsWith(`depth-${c.id}-`))
    expect(depth).toHaveLength(plates * 2)
    expect(depth.filter((p) => p.name.endsWith('-front'))).toHaveLength(plates)
    for (const p of depth) expect(auditPart(p)).toEqual([])
    // level 1 is scored on the base; level 2 on level 1
    const figure = parts.find((p) => p.name === `figure-${c.id}`)!
    const closedLoops = (part: typeof figure) =>
      (part.engrave ?? []).filter((l) => {
        const a = l[0]
        const b = l[l.length - 1]
        return l.length > 6 && Math.hypot(a.x - b.x, a.y - b.y) < 1e-6
      }).length
    expect(closedLoops(figure)).toBeGreaterThanOrEqual(stack.levels[0].length)
    const l1 = parts.find((p) => p.name === `depth-${c.id}-L1-front`)!
    expect(closedLoops(l1)).toBeGreaterThanOrEqual(stack.levels[1].length)
    // every scored run of the stack ends up on exactly one front plate or the base
    const fronts = parts.filter((p) => /^(depth|detail)-/.test(p.name) && p.name.endsWith('-front'))
    const scoredSomewhere = [figure, ...fronts].reduce(
      (n, p) => n + (p.engrave ?? []).length,
      0,
    )
    expect(scoredSomewhere).toBe(stack.scores.length)
    const whale = FIGURE_SHAPES.whale
    expect(stack.scores.length).toBeGreaterThanOrEqual(whale.engrave!.length + whale.layers!.length + plates)
    // marks stay on their plate
    for (const p of [figure, ...depth])
      for (const line of p.engrave ?? [])
        for (const q of line) {
          expect(q.x).toBeGreaterThanOrEqual(-0.3)
          expect(q.x).toBeLessThanOrEqual(p.width + 0.3)
          expect(q.y).toBeGreaterThanOrEqual(-0.3)
          expect(q.y).toBeLessThanOrEqual(p.height + 0.3)
        }
  })

  it('printed with depth: two mirrored halves, each a dome on a flat back', async () => {
    const { buildPrintParts } = await import('./stlExport')
    const spec = composeToy('whale', 'bob')
    const c = spec.characters[0]
    const halves = buildPrintParts(spec).filter((p) => p.name.startsWith(`figure-${c.id}-half`))
    expect(halves.map((h) => h.name).sort()).toEqual([`figure-${c.id}-half1`, `figure-${c.id}-half2`])
    const boxes = halves.map((h) => {
      h.geometry.computeBoundingBox()
      return h.geometry.boundingBox!
    })
    for (const bb of boxes) {
      expect(bb.min.z).toBeCloseTo(0, 6) // flat on the bed
      // 2 mm half-plate + two levels of dome, plus a little for the proud fin
      expect(bb.max.z).toBeGreaterThanOrEqual(2 + 2 * 3 - 1e-6)
      expect(bb.max.z).toBeLessThanOrEqual(2 + 2 * 3 + 1.2 + 1e-6)
    }
    // mirror images: same size, x extents swapped
    expect(boxes[1].min.x).toBeCloseTo(-boxes[0].max.x, 4)
    expect(boxes[1].max.x).toBeCloseTo(-boxes[0].min.x, 4)
    // outward-facing triangles on the mirrored half too: its volume is positive and equal
    const volume = (g: (typeof halves)[0]['geometry']) => {
      const pos = g.getAttribute('position')
      const idx = g.getIndex()
      const n = idx ? idx.count : pos.count
      let v = 0
      for (let i = 0; i < n; i += 3) {
        const [a, b, d] = [0, 1, 2].map((k) => (idx ? idx.getX(i + k) : i + k))
        v +=
          (pos.getX(a) * (pos.getY(b) * pos.getZ(d) - pos.getZ(b) * pos.getY(d)) -
            pos.getY(a) * (pos.getX(b) * pos.getZ(d) - pos.getZ(b) * pos.getX(d)) +
            pos.getZ(a) * (pos.getX(b) * pos.getY(d) - pos.getY(b) * pos.getX(d))) /
          6
      }
      return v
    }
    const v1 = volume(halves[0].geometry)
    const v2 = volume(halves[1].geometry)
    expect(v1).toBeGreaterThan(1000)
    expect(v2).toBeCloseTo(v1, 0)
  })

  it('a winged creature: the ridge is cut for the top only and printed as part of the body', async () => {
    const { buildPrintParts } = await import('./stlExport')
    const { flyerBodyStack } = await import('../scene/reliefLayout')
    const spec = templates.manta
    const c = spec.characters[0]
    const stack = flyerBodyStack(c)
    expect(stack.levels.length).toBeGreaterThanOrEqual(1)
    const cut = generateParts(spec).filter((p) => p.name.startsWith(`depth-${c.id}-`))
    expect(cut).toHaveLength(stack.levels.reduce((n, l) => n + l.length, 0))
    expect(cut.some((p) => /-(front|back)$/.test(p.name))).toBe(false)
    const printed = buildPrintParts(spec)
    expect(printed.some((p) => p.name.startsWith('depth-'))).toBe(false)
    const body = printed.find((p) => p.name === `body-${c.id}`)!
    body.geometry.computeBoundingBox()
    const t = spec.frame.materialThickness
    expect(body.geometry.boundingBox!.max.z).toBeCloseTo(t + stack.levels.length * 3, 3)
  })
})
