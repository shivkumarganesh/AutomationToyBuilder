import { describe, expect, it } from 'vitest'
import { templates } from '../model/templates'
import { composeToy, FIGURE_INFO } from '../model/catalog'
import { outputChannels, type AutomatonSpec } from '../model/types'
import { PROP_SHAPES } from '../model/props'
import { buildGuide, type BuildMethod } from './buildGuide'
import { generateParts } from './svgFlatPack'
import { buildPrintParts } from './stlExport'
import { auditPart } from './basswood'

/**
 * The instructions must describe the kit in the file — every part they
 * name exists, every part that needs explaining is explained, and no
 * step asks for something that cannot physically be done.
 */
const toys: [string, AutomatonSpec][] = [
  ...Object.entries(templates),
  ...Object.keys(FIGURE_INFO)
    .filter((id) => id !== 'custom')
    .flatMap((id) => FIGURE_INFO[id].motions.slice(0, 2).map((m): [string, AutomatonSpec] => [`${id}+${m}`, composeToy(id, m)])),
]

function check(key: string, spec: AutomatonSpec, method: BuildMethod) {
  const laser = method === 'laser'
  const guide = buildGuide(spec, method)
  const names = (laser ? generateParts(spec).map((p) => p.name) : buildPrintParts(spec).map((p) => p.name)) as string[]
  const text = guide.steps.flatMap((s) => [s.title, ...s.body]).join('\n')
  const has = (prefix: RegExp) => names.some((n) => prefix.test(n))
  const label = `${key}/${method}`

  // no step repeats a line word for word
  for (const s of guide.steps) expect(new Set(s.body).size, `${label}: ${s.title}`).toBe(s.body.length)

  // every mechanism channel and every figure is covered
  for (const ch of outputChannels(spec)) expect(text, `${label}: ${ch.id}`).toContain(`“${ch.id}”`)
  for (const c of spec.characters) expect(text, `${label}: ${c.label}`).toContain(c.label)

  // every part name the text quotes is a real part (or the stem of one)
  for (const m of text.matchAll(/“((?:detail|depth|figure|spinner|pinion|crown|hinge|wing|body|post)-[^”…]*)/g))
    expect(names.some((n) => n.startsWith(m[1])), `${label}: quoted ${m[1]}`).toBe(true)

  // layered figures: explained exactly when the kit has the pieces
  expect(/depth layers/i.test(text), `${label}: depth`).toBe(laser && has(/^depth-/))
  expect(/raised plate/i.test(text), `${label}: detail`).toBe(laser && has(/^detail-/))
  expect(/half1/.test(text), `${label}: halves`).toBe(!laser && has(/-half1$/))

  // rocking figures have a hinge stand to be pinned to
  for (const ch of outputChannels(spec))
    if (ch.kind === 'tilt')
      for (const c of spec.characters.filter((x) => x.channelId === ch.id)) {
        expect(names, label).toContain(`hinge-stand-${c.id}`)
        expect(text, label).toMatch(/hinge stand/)
      }

  // turntables: the drive part for the bottom of the spindle exists, and the
  // platform is its own piece, fitted after the stage
  for (const sp of spec.mechanism.spinners) {
    expect(names, label).toContain(`spinner-platform-${sp.id}`)
    const drive = sp.drive ?? 'friction'
    if (laser) {
      if (drive === 'friction') expect(names, label).toContain(`spinner-driven-${sp.id}`)
      if (drive === 'geneva') expect(names, label).toContain(`geneva-wheel-${sp.id}`)
      if (drive === 'bevel') {
        expect(names, label).toContain(`pinion-${sp.id}`)
        const titles = guide.steps.map((s) => s.title)
        expect(titles.indexOf('Build the crown gear'), label).toBeGreaterThan(-1)
        expect(titles.indexOf('Build the crown gear'), label).toBeLessThan(titles.indexOf('Load the camshaft'))
      }
    } else expect(names, label).toContain(`spinner-spindle-${sp.id}`)
    expect(text, label).toMatch(/platform.*top of (the|its) spindle/i)
    const order = guide.steps.map((s) => s.title)
    expect(order.indexOf(`Turntable “${sp.id}”`), label).toBeLessThan(order.indexOf('Fit the stage and test'))
  }

  // scenery: every kind on the stage is named
  for (const p of spec.props ?? []) expect(text.toLowerCase(), label).toContain(PROP_SHAPES[p.shape].label.toLowerCase())
  expect(guide.steps.some((s) => s.title === 'Add the scenery'), label).toBe((spec.props ?? []).length > 0)

  // the route's own vocabulary: nothing to laminate or saw when printing, nothing "printed" when cutting
  if (laser) expect(text, label).not.toMatch(/printed/i)
  else {
    expect(text, label).not.toMatch(/laminate|dowel|basswood|scored/i)
    expect(guide.hardware.map((h) => h.item).join(' '), label).not.toMatch(/dowel|basswood/i)
  }
  // lamination steps only when the kit really has layered parts
  const layered = laser && generateParts(spec).some((p) => /-layer\d+$/.test(p.name))
  expect(guide.steps.some((s) => s.title.startsWith('Laminate')), label).toBe(layered)

  // the parts list is the kit: same count, everything labelled
  expect(guide.parts.reduce((n, p) => n + p.qty, 0), label).toBe(names.length)
  for (const p of guide.parts) expect(p.label, `${label}: ${p.name}`).not.toBe('Part')
}

describe('the build guide matches the kit, toy by toy', () => {
  for (const [key, spec] of toys)
    it(`${key}`, () => {
      check(key, spec, 'laser')
      check(key, spec, 'print')
    })

  it('the laser friction drive has a driven disc that can be cut', () => {
    const parts = generateParts(templates.nodspin)
    const disc = parts.find((p) => p.name.startsWith('spinner-driven-'))!
    expect(disc).toBeDefined()
    expect(auditPart(disc)).toEqual([])
    expect(disc.holes).toHaveLength(1)
  })

  it('a printed spindle can be threaded up through the stage: nothing wide on its top end', () => {
    for (const key of ['nodspin', 'carousel', 'owl']) {
      const parts = buildPrintParts(templates[key])
      const spindle = parts.find((p) => p.name.startsWith('spinner-spindle-'))!
      const pos = spindle.geometry.getAttribute('position')
      let zMax = -Infinity
      for (let i = 0; i < pos.count; i++) zMax = Math.max(zMax, pos.getZ(i))
      let topRadius = 0
      for (let i = 0; i < pos.count; i++)
        if (pos.getZ(i) > zMax - 10) topRadius = Math.max(topRadius, Math.hypot(pos.getX(i), pos.getY(i)))
      expect(topRadius, key).toBeLessThanOrEqual(3.01)
      expect(parts.some((p) => p.name.startsWith('spinner-platform-')), key).toBe(true)
    }
  })

  it('a layered figure is glued in stacking order', () => {
    const steps = buildGuide(templates.reindeer, 'laser').steps
    const build = steps.find((s) => s.title === 'Build up the figures')!
    const text = build.body.join(' ')
    expect(text).toMatch(/plate 1 .*on the figure plate/)
    expect(text).toMatch(/plate 2 .*on top of the plate before it/)
    expect(steps.findIndex((s) => s.title === 'Build up the figures')).toBeLessThan(
      steps.findIndex((s) => s.title === 'Mount the figures'),
    )
  })
})
