import { describe, expect, it } from 'vitest'
import { composeScene, FIGURE_INFO, MAX_CAST, MAX_SCENE_WIDTH, SCENES, SIMPLE_TEMPLATES, type CastMember, type SceneId } from './catalog'
import { PICKABLE_FIGURES } from './figures'
import { templates } from './templates'
import { outputChannels } from './types'
import { parseSpec, serializeSpec } from './persistence'
import { useDesignerStore } from './store'
import { basswoodAudit } from '../export/basswood'
import { propConflicts } from '../export/svgFlatPack'
import { crowdedFigures, stageFigures } from '../ui/StageMap'
import { channelSignals } from '../kinematics/channels'
import { CHRISTMAS_FIGURES, CHRISTMAS_PROPS } from './christmas'

const simpleOnly = (spec: (typeof templates)[string]) => {
  const m = spec.mechanism
  expect(m.rockers).toHaveLength(0)
  expect(m.spinners).toHaveLength(0)
  expect(m.linkages ?? []).toHaveLength(0)
  expect(m.cams).toHaveLength(spec.characters.length)
  expect(m.pushrods).toHaveLength(spec.characters.length)
  expect(outputChannels(spec).every((c) => c.kind === 'lift')).toBe(true)
}

describe('the scene composer', () => {
  it('lays any cast out on one shaft: nobody touches, everything is cuttable', () => {
    const motions: CastMember['motion'][] = ['bob', 'bounce', 'drop']
    const shapes = PICKABLE_FIGURES.map((f) => f.id)
    let built = 0
    for (let n = 1; n <= MAX_CAST; n++)
      for (let start = 0; start < shapes.length; start += 3) {
        const cast = Array.from({ length: n }, (_, i) => ({
          shape: shapes[(start + i * 5) % shapes.length],
          motion: motions[(start + i) % 3],
        }))
        let spec
        try {
          spec = composeScene('test', cast, FIGURE_INFO[cast[0].shape]?.scene ?? 'none')
        } catch (e) {
          expect(String(e)).toMatch(/too wide/)
          continue
        }
        built++
        const label = cast.map((c) => `${c.shape}/${c.motion}`).join(' + ')
        simpleOnly(spec)
        expect(spec.frame.width, label).toBeLessThanOrEqual(MAX_SCENE_WIDTH)
        expect(crowdedFigures(spec), label).toEqual([])
        // left to right in the order given, all inside the box
        const xs = stageFigures(spec).map((f) => f.x)
        expect([...xs].sort((a, b) => a - b), label).toEqual(xs)
        for (const f of stageFigures(spec)) {
          expect(f.movable).toBe(true)
          expect(Math.abs(f.x) + f.width / 2, label).toBeLessThanOrEqual(spec.frame.width / 2)
        }
        expect(propConflicts(spec), label).toEqual([])
        expect(basswoodAudit(spec), label).toEqual([])
        for (const s of channelSignals(spec)) if (s.kind === 'lift') expect(s.table.lift, label).toBeGreaterThan(3)
        expect(parseSpec(serializeSpec(spec)), label).toEqual(spec)
      }
    expect(built).toBeGreaterThan(15)
  })

  it('staggers the cast round the turn unless told otherwise', () => {
    const three = composeScene('t', [
      { shape: 'reindeer', motion: 'bob' },
      { shape: 'reindeer', motion: 'bob' },
      { shape: 'reindeer', motion: 'bob' },
    ])
    expect(three.mechanism.cams.map((c) => c.phaseDeg)).toEqual([0, 120, 240])
    expect(new Set(three.characters.map((c) => c.id)).size).toBe(3)
    const set = composeScene('t', [{ shape: 'cat', motion: 'drop', phaseDeg: 45 }])
    expect(set.mechanism.cams[0].phaseDeg).toBe(45)
    expect(set.mechanism.cams[0].kind).toBe('snail')
  })

  it('refuses an empty cast, a crowd, and a cast wider than a sheet', () => {
    expect(() => composeScene('t', [])).toThrow()
    expect(() => composeScene('t', Array(MAX_CAST + 1).fill({ shape: 'bird', motion: 'bob' }))).toThrow()
    expect(() => composeScene('t', Array(MAX_CAST).fill({ shape: 'whale', motion: 'bob', scale: 1.6 }))).toThrow(/too wide/)
    expect(() => composeScene('t', [{ shape: 'nope', motion: 'bob' }])).toThrow(/unknown figure/)
  })
})

describe('the easiest builds', () => {
  for (const key of SIMPLE_TEMPLATES) {
    it(`${key}: cams and pushrods only, scenery clear of every slot`, () => {
      const spec = templates[key]
      expect(spec, key).toBeDefined()
      simpleOnly(spec)
      expect(propConflicts(spec)).toEqual([])
      expect(crowdedFigures(spec)).toEqual([])
    })
  }

  it('the Christmas set is in the library with scenery to match', () => {
    expect(CHRISTMAS_FIGURES.map((f) => f.id).sort()).toEqual(['reindeer', 'sleigh', 'snowman', 'xmastree'])
    for (const f of CHRISTMAS_FIGURES) expect(FIGURE_INFO[f.id]?.scene, f.id).toBe('winter')
    expect(CHRISTMAS_PROPS.map((p) => p.id)).toContain('pine')
    const used = new Set(SIMPLE_TEMPLATES.flatMap((k) => (templates[k].props ?? []).map((p) => p.shape)))
    for (const p of CHRISTMAS_PROPS) expect(used.has(p.id), p.id).toBe(true)
  })
})

describe('scenery sets on an existing toy', () => {
  it('swap in one go, fit the stage, and clear', () => {
    const store = useDesignerStore.getState()
    for (const key of ['simplest', 'sleighride', 'dragon']) {
      store.loadTemplate(templates[key])
      for (const scene of Object.keys(SCENES) as SceneId[]) {
        useDesignerStore.getState().setScene(scene)
        const spec = useDesignerStore.getState().spec
        if (scene === 'none') expect(spec.props).toEqual([])
        else expect(spec.props!.length).toBeGreaterThan(0)
        for (const p of spec.props ?? []) expect(p.width).toBeLessThanOrEqual(spec.frame.width - 20)
        expect(parseSpec(serializeSpec(spec))).toEqual(spec)
      }
    }
  })

  it('the stage map knows which figures can be slid along', () => {
    const dragon = stageFigures(templates.dragon)
    expect(dragon.some((f) => !f.movable)).toBe(true)
    const simple = stageFigures(templates.simplest)
    expect(simple.every((f) => f.movable)).toBe(true)
    // push two figures together: the map says so
    const spec = structuredClone(templates.simplest)
    spec.mechanism.cams[1].position = spec.mechanism.cams[0].position + 0.03
    expect(crowdedFigures(spec).sort()).toEqual(['figure-a', 'figure-b'])
  })
})
