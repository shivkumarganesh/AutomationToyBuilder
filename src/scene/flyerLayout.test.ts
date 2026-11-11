import { describe, expect, it } from 'vitest'
import { dragon, flyingBird, mantaRay, swimmingFish } from '../model/templates'
import { FLYER_SHAPES } from '../model/flyers'
import { FIGURE_SHAPES } from '../model/figures'
import { camWorldX, outputChannels, STAGE_LIP } from '../model/types'
import { channelSignals } from '../kinematics/channels'
import { sampleDisplacement } from '../kinematics/follower'
import { parseSpec, serializeSpec } from '../model/persistence'
import { useDesignerStore } from '../model/store'
import { generateParts } from '../export/svgFlatPack'
import { buildPrintParts } from '../export/stlExport'
import {
  FLYER_TAB_WIDTH,
  flyerAngles,
  flyerBodyOutline,
  flyerGeometry,
  flyerIssues,
  flyerPostHeight,
  flyerSweep,
  flyerWingPlate,
  HINGE_GAP,
  hingeLimit,
  MIN_ROD_ARM,
} from './flyerLayout'

const flyers = { flyingBird, mantaRay, dragon }

describe('flyer shapes', () => {
  it('bodies are straight-sided where the wings hinge; wings have a root edge on the hinge', () => {
    for (const s of Object.values(FLYER_SHAPES)) {
      const [y0, y1] = s.straight
      const onSide = s.body.filter((p) => Math.abs(Math.abs(p.x) - 0.5) < 1e-6)
      expect(Math.min(...onSide.map((p) => p.y)), s.id).toBeLessThanOrEqual(y0 + 1e-6)
      expect(Math.max(...onSide.map((p) => p.y)), s.id).toBeGreaterThanOrEqual(y1 - 1e-6)
      for (const p of s.body) expect(Math.abs(p.x), s.id).toBeLessThanOrEqual(0.5 + 1e-9)
      // the wing root lies inside the straight stretch of the body
      const rootLo = s.wingY0 + s.root[0] * s.chord
      const rootHi = s.wingY0 + s.root[1] * s.chord
      // (to the library's 3-decimal rounding)
      expect(rootLo, s.id).toBeGreaterThanOrEqual(y0 - 2e-3)
      expect(rootHi, s.id).toBeLessThanOrEqual(y1 + 2e-3)
      expect(s.wing.filter((p) => p.x < 1e-9).length, s.id).toBeGreaterThanOrEqual(2)
      for (const p of s.wing) {
        expect(p.x, s.id).toBeGreaterThanOrEqual(0)
        expect(p.x, s.id).toBeLessThanOrEqual(1)
      }
    }
  })
})

for (const [name, spec] of Object.entries(flyers)) {
  describe(`${name}: hinged wings on pushrods`, () => {
    const signals = channelSignals(spec)
    const c = spec.characters[0]
    const geo = flyerGeometry(spec, c, signals)!
    const t = spec.frame.materialThickness

    it('resolves, with no buildability issues', () => {
      expect(geo).not.toBeNull()
      expect(flyerIssues(spec, c, signals)).toEqual([])
    })

    it('geometry is derived from the mechanism: centred between the inner rods, arms = rod offsets', () => {
      const xs = (ids: string[]) =>
        ids.map((id) => outputChannels(spec).find((ch) => ch.id === id)!.x)
      const L = xs(c.flyer!.left)
      const R = xs(c.flyer!.right)
      expect(geo.xc).toBeCloseTo((L[0] + R[0]) / 2, 9)
      expect(geo.right.hingeX - geo.xc).toBeCloseTo(c.width / 2 + HINGE_GAP / 2, 9)
      expect(geo.left.hingeX - geo.xc).toBeCloseTo(-(c.width / 2 + HINGE_GAP / 2), 9)
      R.forEach((x, i) => expect(geo.right.rods[i]).toBeCloseTo(x - geo.right.hingeX, 9))
      L.forEach((x, i) => expect(geo.left.rods[i]).toBeCloseTo(geo.left.hingeX - x, 9))
      for (const side of [geo.left, geo.right]) {
        expect(side.rods[0]).toBeGreaterThanOrEqual(MIN_ROD_ARM)
        if (side.rods.length > 1)
          expect(side.hinges[1]).toBeCloseTo((side.rods[0] + side.rods[1]) / 2, 9)
      }
      // the template comment's numbers: symmetric about the box centre
      expect(geo.xc).toBeCloseTo(0, 6)
      expect(camWorldX(spec.frame, 0.5)).toBeCloseTo(0, 9)
    })

    it('every plate rests exactly on its rod tip through the whole turn', () => {
      for (const side of [geo.left, geo.right]) {
        for (let deg = 0; deg < 360; deg += 5) {
          const theta = (deg * Math.PI) / 180
          const a = flyerAngles(spec, geo, side, theta)
          // walk the hinge chain; each plate's underside line must pass through its rod tip
          let hx = 0
          let hy = geo.axisY
          side.signals.forEach((s, i) => {
            if (i > 0) {
              const len = side.hinges[i] - side.hinges[i - 1]
              hx += len * Math.cos(a[i - 1])
              hy += len * Math.sin(a[i - 1])
            }
            const tip =
              spec.mechanism.shaftHeight + sampleDisplacement(s.table, theta) + 4 + s.channel.pushrod.length
            const under = hy + Math.tan(a[i]) * (side.rods[i] - hx)
            expect(under, `${name} ${side.sign} plate ${i} @${deg}`).toBeCloseTo(tip, 6)
            // and the rod stays under ITS plate, not past the next hinge
            if (i + 1 < side.hinges.length) {
              const len = side.hinges[i + 1] - side.hinges[i]
              expect(hx + len * Math.cos(a[i])).toBeGreaterThan(side.rods[i] + 3)
            }
          })
        }
      }
    })

    it('the wings sit level at mid-stroke and never fold past what the taped hinge allows', () => {
      const sweep = flyerSweep(spec, geo)
      const limit = hingeLimit(t)
      expect(sweep.maxRoot).toBeGreaterThan((5 * Math.PI) / 180) // a flap you can see
      expect(sweep.maxRoot).toBeLessThan(limit)
      expect(sweep.maxFold).toBeLessThan(limit)
      // left and right mirror each other
      for (let deg = 0; deg < 360; deg += 30) {
        const th = (deg * Math.PI) / 180
        const l = flyerAngles(spec, geo, geo.left, th)
        const r = flyerAngles(spec, geo, geo.right, th)
        l.forEach((v, i) => expect(v).toBeCloseTo(r[i], 6))
      }
    })

    it('plates never overlap: body, hinge gaps and wing plates tile outwards', () => {
      const bodyHalf = Math.max(...flyerBodyOutline(c).map((p) => Math.abs(p.x)))
      expect(bodyHalf).toBeCloseTo(c.width / 2, 6)
      for (const side of [geo.left, geo.right]) {
        let prevMax = 0
        side.hinges.forEach((h, i) => {
          const plate = flyerWingPlate(c, side, i)
          const minX = Math.min(...plate.map((p) => p.x))
          const maxX = Math.max(...plate.map((p) => p.x))
          expect(minX).toBeCloseTo(h + HINGE_GAP / 2, 6)
          if (i > 0) expect(minX - prevMax).toBeCloseTo(HINGE_GAP, 6)
          prevMax = maxX
          expect(plate.length).toBeGreaterThanOrEqual(4)
        })
        expect(prevMax).toBeCloseTo(side.span, 1)
      }
    })

    it('cuts and prints the whole creature: body with post slot, post, every wing plate, stage slot', () => {
      const parts = generateParts(spec)
      const names = parts.map((p) => p.name)
      const plates = c.flyer!.left.length
      expect(names).toContain(`body-${c.id}`)
      expect(names).toContain(`post-${c.id}`)
      expect(names.filter((n) => n.startsWith(`wing-${c.id}-`))).toHaveLength(plates * 2)
      const body = parts.find((p) => p.name === `body-${c.id}`)!
      expect(body.holes).toHaveLength(1)
      const kerf = spec.export.kerf
      const span = (pts: { x: number; y: number }[], k: 'x' | 'y') =>
        Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k]))
      // body slot = sheet thickness × tab width, tightened by the kerf
      expect(span(body.holes[0], 'x')).toBeCloseTo(t - kerf, 6)
      expect(span(body.holes[0], 'y')).toBeCloseTo(FLYER_TAB_WIDTH - kerf, 6)
      // post = derived height + a tab each end
      const post = parts.find((p) => p.name === `post-${c.id}`)!
      expect(post.height).toBeCloseTo(flyerPostHeight(spec, geo) + 2 * t, 0)
      // the stage has a matching slot on the body centreline
      const stage = parts.find((p) => p.name === 'stage')!
      const slot = stage.holes.find((h) => {
        const cx = (Math.min(...h.map((p) => p.x)) + Math.max(...h.map((p) => p.x))) / 2
        const cy = (Math.min(...h.map((p) => p.y)) + Math.max(...h.map((p) => p.y))) / 2
        return (
          Math.abs(cx - (geo.xc + spec.frame.width / 2 + STAGE_LIP)) < 0.01 &&
          Math.abs(cy - (spec.frame.depth / 2 + STAGE_LIP)) < 0.01 &&
          Math.abs(span(h, 'x') - (t - kerf)) < 0.01
        )
      })
      expect(slot).toBeDefined()
      const printed = buildPrintParts(spec).map((p) => p.name)
      for (const n of names.filter((x) => /^(body|post|wing)-/.test(x))) expect(printed).toContain(n)
    })

    it('saves and reloads exactly; removing a wing rod removes the flyer, not just a wing', () => {
      expect(parseSpec(serializeSpec(spec))).toEqual(spec)
      const store = useDesignerStore.getState()
      store.loadTemplate(spec)
      const rod = c.flyer!.right[0]
      const cam = spec.mechanism.pushrods.find((r) => r.id === rod)!.camId
      useDesignerStore.getState().removeCam(cam)
      const after = useDesignerStore.getState().spec
      expect(after.characters.find((x) => x.id === c.id)).toBeUndefined()
      expect(parseSpec(serializeSpec(after))).toEqual(after)
    })
  })
}

describe('flyer validation', () => {
  it('reports rods crowded against the body and over-folded hinges', () => {
    const tight = structuredClone(flyingBird)
    tight.characters[0].width = 50 // body now reaches the rods
    expect(flyerIssues(tight, tight.characters[0], channelSignals(tight)).join(' ')).toMatch(/too close to the body/)
    const wild = structuredClone(flyingBird)
    for (const cam of wild.mechanism.cams) if (cam.kind === 'eccentric') cam.eccentricity = 17
    expect(flyerIssues(wild, wild.characters[0], channelSignals(wild)).join(' ')).toMatch(/fold further/)
  })

  it('rejects saves whose wings point at missing or non-pushrod channels', () => {
    const bad = structuredClone(flyingBird)
    bad.characters[0].flyer!.right = ['rod-nope']
    expect(() => parseSpec(serializeSpec(bad))).toThrow(/not a pushrod channel/)
    const uneven = structuredClone(mantaRay)
    uneven.characters[0].flyer!.right = ['rod-r-inner']
    expect(() => parseSpec(serializeSpec(uneven))).toThrow(/equal plate counts/)
  })
})

describe('swimming fish: a segmented body on phase-lagged cams', () => {
  const spec = swimmingFish
  const channels = outputChannels(spec)

  it('one segment per rod, in head-to-tail order along the shaft, never touching', () => {
    expect(spec.characters).toHaveLength(4)
    const segs = spec.characters.map((c) => {
      const ch = channels.find((x) => x.id === c.channelId)!
      const shape = FIGURE_SHAPES[c.shape!]
      expect(shape.partOf).toBe('fish')
      const xs = shape.outline.map((p) => ch.x + p.x * c.width)
      return { id: c.id, min: Math.min(...xs), max: Math.max(...xs) }
    })
    for (let i = 1; i < segs.length; i++) {
      // 2 mm gaps as drawn: segments slide past each other without rubbing
      expect(segs[i].min - segs[i - 1].max, `${segs[i - 1].id} → ${segs[i].id}`).toBeCloseTo(2, 0)
    }
  })

  it('every cam trails the one ahead by the same lag: a travelling wave', () => {
    const phases = spec.mechanism.cams.map((c) => c.phaseDeg)
    // listed tail → head
    for (let i = 1; i < phases.length; i++) expect(phases[i - 1] - phases[i]).toBe(60)
    const signals = channelSignals(spec)
    // neighbours never shear by more than the segment overlap can hide
    for (let deg = 0; deg < 360; deg += 10) {
      const th = (deg * Math.PI) / 180
      const h = signals.map((s) => (s.kind === 'lift' ? sampleDisplacement(s.table, th) : 0))
      for (let i = 1; i < h.length; i++) expect(Math.abs(h[i] - h[i - 1])).toBeLessThanOrEqual(4.01)
    }
  })

  it('rods stay in their guide slots: the tip never drops to the stage', () => {
    const stageTop = spec.frame.height + spec.frame.materialThickness
    for (const s of channelSignals(spec)) {
      if (s.kind !== 'lift') continue
      const lowest = spec.mechanism.shaftHeight + s.table.min + 4 + s.channel.pushrod.length
      expect(lowest).toBeGreaterThan(stageTop + 2)
    }
  })
})

describe('flyer engraving', () => {
  it('wing ribs are clipped to their own plate and never cross a hinge', async () => {
    const { flyerWingEngraving, flyerBodyEngraving } = await import('./flyerLayout')
    for (const spec of [flyingBird, mantaRay, dragon]) {
      const c = spec.characters[0]
      const geo = flyerGeometry(spec, c, channelSignals(spec))!
      expect(flyerBodyEngraving(c).length).toBeGreaterThan(0)
      let ribs = 0
      for (const side of [geo.left, geo.right]) {
        side.hinges.forEach((h, i) => {
          const plate = flyerWingPlate(c, side, i)
          const minX = Math.min(...plate.map((p) => p.x))
          const maxX = Math.max(...plate.map((p) => p.x))
          for (const line of flyerWingEngraving(c, side, i)) {
            ribs++
            expect(line.length).toBeGreaterThanOrEqual(2)
            for (const p of line) {
              expect(p.x).toBeGreaterThanOrEqual(minX)
              expect(p.x).toBeLessThanOrEqual(maxX)
            }
          }
          expect(h).toBeLessThan(maxX)
        })
      }
      expect(ribs).toBeGreaterThan(0)
      // and they reach the cut file
      const wings = generateParts(spec).filter((p) => p.name.startsWith(`wing-${c.id}-`))
      expect(wings.some((w) => (w.engrave ?? []).length > 0)).toBe(true)
    }
  })
})
