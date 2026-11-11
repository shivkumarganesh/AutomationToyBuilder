import { describe, expect, it } from 'vitest'
import { PICKABLE_FIGURES } from './figures'
import { PROP_SHAPES } from './props'
import { templates } from './templates'
import { composeToy, FIGURE_INFO, MOTIONS, TEMPLATE_INFO, type MotionId } from './catalog'
import { parseSpec, serializeSpec } from './persistence'
import { outputChannels } from './types'
import { channelSignals } from '../kinematics/channels'
import { grashofOk } from '../kinematics/linkage'
import { flatPackSvg, generateParts, propConflicts } from '../export/svgFlatPack'
import { buildPrintParts } from '../export/stlExport'

const motions = Object.keys(MOTIONS) as MotionId[]

describe('catalogue coverage', () => {
  it('every library figure has gallery info with valid recommended motions', () => {
    for (const { id } of PICKABLE_FIGURES) {
      const info = FIGURE_INFO[id]
      expect(info, id).toBeDefined()
      expect(info.motions.length, id).toBeGreaterThanOrEqual(2)
      for (const m of info.motions) expect(MOTIONS[m], `${id} → ${m}`).toBeDefined()
      expect(info.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('every template has gallery info', () => {
    for (const key of Object.keys(templates)) expect(TEMPLATE_INFO[key], key).toBeDefined()
  })
})

describe('figure-first recipes: every figure × every motion', () => {
  for (const { id: shapeId } of PICKABLE_FIGURES) {
    for (const motion of motions) {
      it(`${shapeId} + ${motion} composes a buildable toy`, () => {
        const spec = composeToy(shapeId, motion)

        // a valid, exactly round-tripping design
        expect(parseSpec(serializeSpec(spec))).toEqual(spec)

        // one channel, carrying the chosen figure
        const channels = outputChannels(spec)
        expect(channels).toHaveLength(1)
        expect(spec.characters).toHaveLength(1)
        expect(spec.characters[0].channelId).toBe(channels[0].id)
        expect(spec.characters[0].shape).toBe(shapeId)

        // the mechanism solves over the whole turn
        for (const sig of channelSignals(spec)) {
          if (sig.kind === 'path') {
            expect(grashofOk(sig.channel.linkage)).toBe(true)
            expect(sig.table.valid).toBe(true)
          }
        }

        // the mechanism stays inside the box
        const { frame, mechanism: m } = spec
        for (const cam of m.cams) {
          const reach = cam.kind === 'eccentric' ? cam.radius + cam.eccentricity : cam.baseRadius + cam.lift
          expect(m.shaftHeight - reach, 'cam clears the floor').toBeGreaterThan(frame.materialThickness)
          expect(m.shaftHeight + reach, 'cam clears the stage').toBeLessThan(frame.height)
        }

        // scenery never collides with a stage opening
        expect(propConflicts(spec)).toEqual([])
        for (const p of spec.props ?? []) expect(PROP_SHAPES[p.shape]).toBeDefined()

        // both build routes produce a complete kit
        const cut = generateParts(spec).map((p) => p.name)
        expect(cut).toContain('stage')
        expect(cut).toContain('crank-arm')
        expect(cut.some((n) => n.startsWith('figure-'))).toBe(true)
        expect(flatPackSvg(spec)).toContain('</svg>')
        const printed = buildPrintParts(spec).map((p) => p.name)
        for (const need of ['camshaft', 'crank', 'frame-stage', 'frame-side-left', 'frame-bottom'])
          expect(printed, need).toContain(need)
        expect(printed.filter((n) => n.startsWith('prop-'))).toHaveLength((spec.props ?? []).length)
      })
    }
  }
})
