import { describe, expect, it } from 'vitest'
import { simplestAutomaton } from '../model/templates'
import { camWorldX, outputChannels } from '../model/types'
import { flatPackSvg, generateParts } from './svgFlatPack'
import { buildPrintParts, exportStl } from './stlExport'

const spec = simplestAutomaton

function bounds(path: { x: number; y: number }[]) {
  return {
    minX: Math.min(...path.map((p) => p.x)),
    maxX: Math.max(...path.map((p) => p.x)),
    minY: Math.min(...path.map((p) => p.y)),
    maxY: Math.max(...path.map((p) => p.y)),
  }
}

describe('SVG flat-pack', () => {
  const parts = generateParts(spec)
  const { width: w, depth: d, height: h, materialThickness: t } = spec.frame
  const kerf = spec.export.kerf

  it('produces every frame panel plus one disc per cam', () => {
    const names = parts.map((p) => p.name).sort()
    expect(names).toEqual(
      [
        'side-left',
        'side-right',
        'wall-front',
        'wall-back',
        'stage',
        'bottom',
        'cam-eccentric',
        'cam-petal',
      ].sort(),
    )
  })

  it('walls span their nominal footprint plus top tabs', () => {
    const front = parts.find((p) => p.name === 'wall-front')!
    const b = bounds(front.outline)
    expect(b.maxX - b.minX).toBeCloseTo(w, 3)
    // tabs protrude one material thickness above the wall height
    expect(b.maxY - b.minY).toBeCloseTo(h + t, 3)

    const side = parts.find((p) => p.name === 'side-left')!
    const sb = bounds(side.outline)
    expect(sb.maxX - sb.minX).toBeCloseTo(d, 3)
    expect(sb.maxY - sb.minY).toBeCloseTo(h + t, 3)
  })

  it('corner finger joints are complementary between side and front walls', () => {
    const side = parts.find((p) => p.name === 'side-left')!
    const front = parts.find((p) => p.name === 'wall-front')!
    // collect the notch spans (vertical runs at the inset line) of a panel's right edge
    const notchSpans = (outline: { x: number; y: number }[], panelW: number) => {
      const spans: [number, number][] = []
      for (let i = 0; i < outline.length - 1; i++) {
        const a = outline[i]
        const b = outline[i + 1]
        if (
          Math.abs(a.x - (panelW - t)) < 1e-6 &&
          Math.abs(b.x - (panelW - t)) < 1e-6 &&
          Math.abs(a.y - b.y) > 1
        ) {
          spans.push([Math.min(a.y, b.y), Math.max(a.y, b.y)])
        }
      }
      return spans
    }
    const covered = (spans: [number, number][], y: number) =>
      spans.some(([lo, hi]) => y > lo && y < hi)
    const sideSpans = notchSpans(side.outline, d)
    const frontSpans = notchSpans(front.outline, w)
    // exactly one of the two panels is notched at every fifth of the edge
    for (let i = 0; i < 5; i++) {
      const yMid = (i + 0.5) * (h / 5)
      expect(covered(sideSpans, yMid), `segment ${i}`).not.toBe(covered(frontSpans, yMid))
    }
  })

  it('bearing holes sit at shaft height with running clearance minus kerf', () => {
    const side = parts.find((p) => p.name === 'side-right')!
    expect(side.holes).toHaveLength(1)
    const b = bounds(side.holes[0])
    const dia = b.maxX - b.minX
    expect(dia).toBeCloseTo(spec.mechanism.shaftDiameter + 0.5 - kerf, 2)
    expect((b.minY + b.maxY) / 2).toBeCloseTo(spec.mechanism.shaftHeight, 2)
  })

  it('stage guide slots line up with the output channels', () => {
    const stage = parts.find((p) => p.name === 'stage')!
    const channels = outputChannels(spec)
    for (const ch of channels) {
      const expectedX = ch.x + w / 2
      const slot = stage.holes.find((hole) => {
        const b = bounds(hole)
        return (
          Math.abs((b.minX + b.maxX) / 2 - expectedX) < 0.01 &&
          Math.abs((b.minY + b.maxY) / 2 - d / 2) < 0.01
        )
      })
      expect(slot, `guide slot for ${ch.id}`).toBeDefined()
      const b = bounds(slot!)
      expect(b.maxX - b.minX).toBeCloseTo(ch.pushrod.rodWidth + 0.8 - kerf, 2)
    }
  })

  it('stage tab slots match the wall tab layout', () => {
    const stage = parts.find((p) => p.name === 'stage')!
    // 2 tabs × 4 walls + 2 guide slots
    expect(stage.holes).toHaveLength(10)
  })

  it('channel positions derive from cam shaft fractions', () => {
    const channels = outputChannels(spec)
    expect(channels[0].x).toBeCloseTo(camWorldX(spec.frame, 0.3), 6)
    expect(channels[1].x).toBeCloseTo(camWorldX(spec.frame, 0.7), 6)
  })

  it('renders a well-formed SVG document in mm', () => {
    const svg = flatPackSvg(spec)
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toMatch(/width="\d+(\.\d+)?mm"/)
    const opens = (svg.match(/<path /g) ?? []).length
    expect(opens).toBeGreaterThan(10)
  })
})

describe('STL export', () => {
  it('builds one printable part per mechanism piece, character, and the drive', () => {
    const parts = buildPrintParts(spec)
    const names = parts.map((p) => p.name)
    expect(names).toContain('camshaft')
    expect(names).toContain('crank')
    expect(names.filter((n) => n.startsWith('pushrod-'))).toHaveLength(2)
    expect(names.filter((n) => n.startsWith('cam-'))).toHaveLength(2)
    expect(names.filter((n) => n.startsWith('figure-'))).toHaveLength(2)
  })

  it('camshaft spans the box width plus crank overhang', () => {
    const shaft = buildPrintParts(spec).find((p) => p.name === 'camshaft')!
    shaft.geometry.computeBoundingBox()
    const bb = shaft.geometry.boundingBox!
    expect(bb.max.x - bb.min.x).toBeCloseTo(spec.frame.width + 24, 3)
  })

  it('emits valid binary STL with a consistent triangle count', () => {
    const data = exportStl(spec)
    const view = new DataView(data.buffer)
    const triangles = view.getUint32(80, true)
    expect(triangles).toBeGreaterThan(100)
    expect(data.byteLength).toBe(84 + triangles * 50)
  })
})
