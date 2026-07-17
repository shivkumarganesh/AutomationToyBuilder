import { describe, expect, it } from 'vitest'
import { bevelCarousel, flappingBird, nodAndSpin, simplestAutomaton } from '../model/templates'
import { crownPitchRadius } from '../scene/spinnerLayout'
import { camWorldX, outputChannels } from '../model/types'
import { channelSignals } from '../kinematics/channels'
import { standHeight } from '../scene/figureLayout'
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

  it('produces every frame panel, one disc per cam, and figure silhouettes', () => {
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
        'figure-figure-a',
        'figure-figure-b',
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
      if (ch.kind !== 'lift') continue
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

describe('articulated figure print parts', () => {
  const parts = buildPrintParts(flappingBird)
  const bird = flappingBird.characters[0]

  it('exports the body plus one plate per limb (two for wings)', () => {
    const names = parts.map((p) => p.name)
    expect(names).toContain('figure-figure-bird')
    expect(names).toContain('limb-wings-left')
    expect(names).toContain('limb-wings-right')
    expect(names).toContain('limb-head')
    expect(names).toContain('limb-tail')
  })

  it('exports the internal connections: one wire crank and one axle per limb', () => {
    const names = parts.map((p) => p.name)
    for (const limb of bird.limbs!) {
      expect(names, `wire for ${limb.id}`).toContain(`wire-${limb.id}`)
      expect(names, `axle for ${limb.id}`).toContain(`axle-${limb.id}`)
    }
  })

  it('the body prints with its stand at the derived linkage height', () => {
    const body = parts.find((p) => p.name === 'figure-figure-bird')!
    body.geometry.computeBoundingBox()
    const bb = body.geometry.boundingBox!
    const standH = standHeight(flappingBird, bird, channelSignals(flappingBird))
    expect(standH).toBeGreaterThan(2)
    // stand below + body above (no rigid head: the head limb replaces it)
    expect(bb.max.z - bb.min.z).toBeCloseTo(bird.height + standH, 3)
  })

  it('wire cranks span the derived vertical run', () => {
    // the tail crank: vertical run + horizontal reach; its height must
    // cover the run from the wag rod tip up to the tail pin
    const wire = parts.find((p) => p.name === 'wire-limb-tail')!
    wire.geometry.computeBoundingBox()
    const bb = wire.geometry.boundingBox!
    expect(bb.max.y - bb.min.y).toBeGreaterThan(2) // vertical run present
    expect(bb.max.x - bb.min.x).toBeGreaterThan(10) // horizontal reach present
  })

  it('wing plates are identical parts — flat and flippable', () => {
    const left = parts.find((p) => p.name === 'limb-wings-left')!
    const right = parts.find((p) => p.name === 'limb-wings-right')!
    left.geometry.computeBoundingBox()
    right.geometry.computeBoundingBox()
    expect(left.geometry.boundingBox).toEqual(right.geometry.boundingBox)
  })

  it('limb plates span crank arm + length: the linkage is cut into the part', () => {
    const wings = bird.limbs!.find((l) => l.kind === 'wings')!
    const plate = parts.find((p) => p.name === 'limb-wings-left')!
    plate.geometry.computeBoundingBox()
    const bb = plate.geometry.boundingBox!
    // from the pin-end round cap to the tip round cap
    const expected = wings.crankArm + wings.width / 4 + wings.length + wings.width / 2
    expect(bb.max.x - bb.min.x).toBeCloseTo(expected, 3)
  })

})

describe('articulated figure laser parts', () => {
  const parts = generateParts(flappingBird)
  const bird = flappingBird.characters[0]

  it('cuts the full bird kit: body profile, stand, and limb plates', () => {
    const names = parts.map((p) => p.name)
    expect(names).toContain('figure-figure-bird')
    expect(names).toContain('figure-stand-figure-bird')
    expect(names).toContain('limb-wings-left')
    expect(names).toContain('limb-wings-right')
    expect(names).toContain('limb-head')
    expect(names).toContain('limb-tail')
  })

  it('the body side profile carries one axle hole per limb', () => {
    const body = parts.find((p) => p.name === 'figure-figure-bird')!
    expect(body.holes).toHaveLength(bird.limbs!.length)
    expect(body.width).toBeCloseTo(bird.depth, 3)
    expect(body.height).toBeCloseTo(bird.height, 3)
  })

  it('the stand strip is cut to the derived linkage height', () => {
    const stand = parts.find((p) => p.name === 'figure-stand-figure-bird')!
    const standH = standHeight(flappingBird, bird, channelSignals(flappingBird))
    expect(stand.height).toBeCloseTo(standH, 3)
  })

  it('limb plates carry pivot and pin holes exactly crankArm apart', () => {
    const wings = bird.limbs!.find((l) => l.kind === 'wings')!
    const plate = parts.find((p) => p.name === 'limb-wings-left')!
    expect(plate.holes).toHaveLength(2)
    const centre = (hole: { x: number; y: number }[]) => {
      const xs = hole.map((p) => p.x)
      const ys = hole.map((p) => p.y)
      return {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
      }
    }
    const a = centre(plate.holes[0])
    const b = centre(plate.holes[1])
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(wings.crankArm, 3)
  })
})

describe('rocker hardware export', () => {
  it('STL includes the fulcrum post, link rod, and hinge stand', () => {
    const names = buildPrintParts(nodAndSpin).map((p) => p.name)
    expect(names).toContain('rocker-post-rock-nod')
    expect(names).toContain('rocker-link-rock-nod')
    // the nodding bird is a block figure on a tilt channel
    expect(names).toContain('hinge-stand-figure-nodder')
  })

  it('SVG includes post and link strips at derived heights', () => {
    const parts = generateParts(nodAndSpin)
    const post = parts.find((p) => p.name === 'rocker-post-rock-nod')!
    const link = parts.find((p) => p.name === 'rocker-link-rock-nod')!
    expect(post).toBeDefined()
    expect(link).toBeDefined()
    const stageTop = nodAndSpin.frame.height + nodAndSpin.frame.materialThickness
    // post + link together must reach from the floor to above the stage
    expect(post.height + link.height).toBeCloseTo(stageTop + 6, 3)
  })
})

describe('bevel spinner laser parts', () => {
  const parts = generateParts(bevelCarousel)
  const spinner = bevelCarousel.mechanism.spinners[0]
  const kerf = bevelCarousel.export.kerf
  const t = bevelCarousel.frame.materialThickness

  it('exports a toothed pinion, never a plain circle', () => {
    const pinion = parts.find((p) => p.name === `pinion-${spinner.id}`)!
    expect(pinion).toBeDefined()
    // 4 outline points per tooth — a circle would have a uniform radius
    expect(pinion.outline).toHaveLength(spinner.pinionTeeth! * 4)
    const radii = pinion.outline.map((p) =>
      Math.hypot(p.x - pinion.width / 2, p.y - pinion.height / 2),
    )
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(2)
  })

  it('exports the crown as a slotted disc plus one tooth tab per tooth', () => {
    const disc = parts.find((p) => p.name === `crown-disc-${spinner.id}`)!
    expect(disc).toBeDefined()
    // D-hole + one mortise per tooth
    expect(disc.holes).toHaveLength(1 + spinner.crownTeeth!)
    const tabs = parts.filter((p) => p.name.startsWith(`crown-tooth-${spinner.id}-`))
    expect(tabs).toHaveLength(spinner.crownTeeth!)
  })

  it('tooth tabs friction-fit the mortises: kerf-complementary widths', () => {
    const disc = parts.find((p) => p.name === `crown-disc-${spinner.id}`)!
    const tab = parts.find((p) => p.name === `crown-tooth-${spinner.id}-1`)!
    // mortise short side (drawn t − kerf) vs tab short side (drawn toothW + kerf):
    // after the cut both land on nominal, giving a snug fit
    const mortise = disc.holes[1]
    const xs = mortise.map((p) => p.x)
    const ys = mortise.map((p) => p.y)
    const mortiseDims = [
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    ].sort((a, b) => a - b)
    const Rc = crownPitchRadius(spinner)
    const toothW = ((2 * Math.PI * Rc) / spinner.crownTeeth!) * 0.45
    // mortise drawn undersize: after the cut, one dim = sheet thickness t
    // (the tab passes through the sheet) and the other = tooth width
    const expected = [t - kerf, toothW - kerf].sort((a, b) => a - b)
    expect(mortiseDims[0]).toBeCloseTo(expected[0], 6)
    expect(mortiseDims[1]).toBeCloseTo(expected[1], 6)
    // tab drawn oversize so the cut lands it on nominal tooth width
    expect(Math.min(tab.width, tab.height)).toBeCloseTo(toothW + kerf, 6)
  })

  it('no friction-wheel part leaks into a bevel export', () => {
    expect(parts.some((p) => p.name === `spinner-wheel-${spinner.id}`)).toBe(false)
  })
})
