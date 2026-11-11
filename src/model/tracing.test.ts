import { describe, expect, it } from 'vitest'
import { dilate, largestBlob, simplifyClosed, traceBoundary, traceMask, TRACE_MAX_POINTS, type Mask } from './tracing'

/** Build a mask from rows of '#' and '.'. */
function mask(rows: string[], scale = 1): Mask {
  const h = rows.length * scale
  const w = rows[0].length * scale
  const data = new Uint8Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      data[y * w + x] = rows[Math.floor(y / scale)][Math.floor(x / scale)] === '#' ? 1 : 0
  return { width: w, height: h, data }
}
const count = (m: Mask) => m.data.reduce((s, v) => s + v, 0)
const area = (pts: { x: number; y: number }[]) => {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

describe('tracing a picture into a figure', () => {
  it('the boundary of a blob encloses exactly its cells', () => {
    for (const rows of [
      ['#'],
      ['....', '.##.', '.##.', '....'],
      ['#..', '#..', '###'],
      ['.#.', '###', '.#.'],
      ['##..', '.##.', '..##'],
      ['###', '#.#', '###'], // a hole is ignored: the outside is traced
    ]) {
      const m = mask(rows)
      const loop = traceBoundary(m)
      const holes = rows.join('') === '####.####' ? 1 : 0
      expect(Math.abs(area(loop)), rows.join('/')).toBe(count(m) + holes)
      // closed walk on the grid: every step is one unit
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i]
        const b = loop[(i + 1) % loop.length]
        expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1)
      }
    }
  })

  it('keeps the biggest blob and drops specks', () => {
    const m = mask(['#.....', '......', '..###.', '..###.', '......', '.....#'])
    expect(count(largestBlob(m))).toBe(6)
  })

  it('dilation thickens a thin neck', () => {
    const m = mask(['###...###', '###...###', '#########', '###...###', '###...###'], 4)
    const neck = (mm: Mask) => {
      const x = Math.floor(mm.width / 2)
      let n = 0
      for (let y = 0; y < mm.height; y++) n += mm.data[y * mm.width + x]
      return n
    }
    expect(neck(m)).toBe(4)
    expect(neck(dilate(m, 2))).toBe(8)
  })

  it('simplification keeps corners and drops the points between them', () => {
    const square = traceBoundary(mask(['####', '####', '####', '####'], 10))
    expect(square.length).toBe(160)
    const simple = simplifyClosed(square, 0.5)
    expect(simple.length).toBe(4)
    expect(Math.abs(area(simple))).toBe(1600)
  })

  it('traces an upright shape into library coordinates, base down, mount under its foot', () => {
    // a lollipop: round head on a stick, stick off-centre to the left
    const rows = [
      '..........',
      '....####..',
      '...######.',
      '...######.',
      '....####..',
      '....##....',
      '....##....',
      '....##....',
    ]
    const traced = traceMask(mask(rows, 12))!
    expect(traced).not.toBeNull()
    const { outline, aspect } = traced
    expect(outline.length).toBeGreaterThanOrEqual(8)
    expect(outline.length).toBeLessThanOrEqual(TRACE_MAX_POINTS)
    for (const p of outline) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(0.5)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(1)
    }
    expect(Math.min(...outline.map((p) => p.y))).toBe(0)
    expect(Math.max(...outline.map((p) => p.y))).toBe(1)
    expect(area(outline)).toBeGreaterThan(0) // counter-clockwise
    // the foot (lowest points) straddles x = 0: that is where the rod goes
    const feet = outline.filter((p) => p.y < 0.03)
    expect(Math.min(...feet.map((p) => p.x))).toBeLessThan(0)
    expect(Math.max(...feet.map((p) => p.x))).toBeGreaterThan(0)
    // the head hangs to the right of the stick, so the box is wider than the head
    // 6 cells wide head, stick centre 1 cell left of the head centre, 7 tall
    expect(aspect).toBeGreaterThan(6 / 7)
    expect(aspect).toBeLessThan(10 / 7)
    // no degenerate edges
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i]
      const b = outline[(i + 1) % outline.length]
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.004)
    }
  })

  it('refuses an empty or speck-sized picture', () => {
    expect(traceMask(mask(['....', '....']))).toBeNull()
    expect(traceMask(mask(['....', '.#..', '....']))).toBeNull()
  })

  it('keeps a detailed shape within the point budget', () => {
    // a 24-tooth comb
    const rows = ['#'.repeat(96), ...new Array(6).fill('#.'.repeat(48))]
    const traced = traceMask(mask(rows, 4))!
    expect(traced.outline.length).toBeLessThanOrEqual(TRACE_MAX_POINTS)
  })
})

describe('a traced figure is a first-class figure', () => {
  it('composes into a toy that saves, reloads, audits and exports with its own outline', async () => {
    const { composeToy } = await import('./catalog')
    const { parseSpec, serializeSpec } = await import('./persistence')
    const { basswoodAudit } = await import('../export/basswood')
    const { generateParts } = await import('../export/svgFlatPack')
    const { buildPrintParts } = await import('../export/stlExport')
    const { characterOutline } = await import('./figures')
    const traced = traceMask(
      mask(['..####..', '.######.', '########', '########', '.######.', '..####..', '...##...', '...##...'], 16),
    )!
    const spec = composeToy('custom', 'bob', { outline: traced.outline, width: 40, height: 40 })
    const figure = spec.characters[0]
    expect(figure.shape).toBe('custom')
    expect(parseSpec(serializeSpec(spec))).toEqual(spec)
    const mm = characterOutline(figure)
    expect(Math.max(...mm.map((p) => p.y))).toBeCloseTo(40, 3)
    expect(basswoodAudit(spec)).toEqual([])
    const part = generateParts(spec).find((p) => p.name === `figure-${figure.id}`)!
    expect(part.outline.length).toBe(traced.outline.length)
    expect(buildPrintParts(spec).some((p) => p.name === `figure-${figure.id}`)).toBe(true)
    // a save that claims a custom figure but carries no outline is refused
    const broken = structuredClone(spec)
    delete broken.characters[0].outline
    expect(() => parseSpec(serializeSpec(broken))).toThrow(/outline must carry/)
  })
})
