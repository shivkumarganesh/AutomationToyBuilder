import { describe, expect, it } from 'vitest'
import { composeToy } from '../catalog'
import { FIGURE_SHAPES } from '../figures'
import { inside } from '../webCheck'
import { figureStack, runAnchor } from '../../scene/reliefLayout'
import { generateParts } from '../../export/svgFlatPack'
import { auditPart, basswoodAudit } from '../../export/basswood'
import { buildPrintParts } from '../../export/stlExport'
import { parseSpec, serializeSpec } from '../persistence'

describe('a figure traced from a line drawing: the prancing reindeer', () => {
  const spec = composeToy('prancer', 'bounce')
  const c = spec.characters[0]
  const stack = figureStack(c)

  it('is built up by anatomy: body on the base, bow on the body', () => {
    expect(FIGURE_SHAPES.prancer.sculpted).toBe(true)
    expect(stack.details).toHaveLength(2)
    const [body, bow] = stack.details
    // the body plate sits on the face; the bow on top of the body plate
    expect(body.level).toBe(0)
    expect(body.rise).toBe(0)
    expect(bow.level).toBe(1)
    expect(bow.rise).toBe(1)
    // far legs and antlers stay behind: the body plate is clearly smaller than the base
    const area = (p: { x: number; y: number }[]) =>
      Math.abs(p.reduce((s, a, i) => s + a.x * p[(i + 1) % p.length].y - p[(i + 1) % p.length].x * a.y, 0)) / 2
    expect(area(body.item)).toBeLessThan(area(stack.outline) * 0.85)
    expect(area(body.item)).toBeGreaterThan(area(stack.outline) * 0.4)
    expect(area(bow.item)).toBeLessThan(area(body.item) * 0.25)
  })

  it('every engraved stretch lies on the topmost plate under it, and only there', () => {
    expect(stack.engraving.length).toBeGreaterThan(30)
    for (const run of stack.engraving) {
      const at = runAnchor(run.item)
      const onBow = inside(stack.details[1].item, at)
      const onBody = inside(stack.details[0].item, at)
      if (onBow) expect(run.on).toBe(1)
      else if (onBody) expect(run.on).toBe(0)
      else expect(run.on).toBeUndefined()
      expect(run.level).toBe(onBow ? 2 : onBody ? 1 : 0)
    }
    // all three surfaces carry marks: hooves on the far legs, fur on the body, folds on the bow
    for (const on of [undefined, 0, 1]) expect(stack.engraving.some((e) => e.on === on)).toBe(true)
  })

  it('cuts from 3 mm basswood with marks on their own plates', () => {
    expect(basswoodAudit(spec)).toEqual([])
    const parts = generateParts(spec)
    const base = parts.find((p) => p.name === `figure-${c.id}`)!
    const plates = parts.filter((p) => p.name.startsWith(`detail-${c.id}-`))
    expect(plates.map((p) => p.name).sort()).toEqual(
      [1, 2].flatMap((k) => ['back', 'front'].map((f) => `detail-${c.id}-${k}-${f}`)),
    )
    for (const p of plates) expect(auditPart(p)).toEqual([])
    const scored = [base, ...plates.filter((p) => p.name.endsWith('-front'))]
    expect(scored.reduce((n, p) => n + (p.engrave ?? []).length, 0)).toBe(stack.scores.length)
    for (const p of [base, ...plates])
      for (const line of p.engrave ?? [])
        for (const q of line) {
          expect(q.x).toBeGreaterThanOrEqual(-0.4)
          expect(q.x).toBeLessThanOrEqual(p.width + 0.4)
          expect(q.y).toBeGreaterThanOrEqual(-0.4)
          expect(q.y).toBeLessThanOrEqual(p.height + 0.4)
        }
    // the base shows where the body goes; the body shows where the bow goes
    expect(stack.scores.some((e) => e.on === undefined && e.level === 0 && e.item.length > 40)).toBe(true)
    expect(stack.scores.some((e) => e.on === 0 && e.item.length > 40)).toBe(true)
  })

  it('prints with volume: two mirrored halves, tiers stacked', () => {
    const halves = buildPrintParts(spec).filter((p) => p.name.startsWith(`figure-${c.id}-half`))
    expect(halves).toHaveLength(2)
    const boxes = halves.map((h) => {
      h.geometry.computeBoundingBox()
      return h.geometry.boundingBox!
    })
    for (const bb of boxes) {
      expect(bb.min.z).toBeCloseTo(0, 6)
      expect(bb.max.z).toBeCloseTo(2 + 2 * 2.2, 3)
    }
    expect(boxes[1].min.x).toBeCloseTo(-boxes[0].max.x, 4)
  })

  it('saves and loads, and still takes extra depth levels', () => {
    expect(parseSpec(serializeSpec(spec))).toEqual(spec)
    const deep = structuredClone(spec)
    deep.characters[0].relief = 1
    const s2 = figureStack(deep.characters[0])
    if (s2.levels.length > 0) expect(s2.details[0].level).toBe(1)
    expect(basswoodAudit(deep)).toEqual([])
  })
})
