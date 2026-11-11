import { describe, expect, it } from 'vitest'
import type { CustomCamSpec } from '../model/types'
import { camMaxRadius } from '../model/types'
import { simplestAutomaton } from '../model/templates'
import { parseSpec, serializeSpec } from '../model/persistence'
import { basswoodAudit } from '../export/basswood'
import { generateParts } from '../export/svgFlatPack'
import { buildPrintParts } from '../export/stlExport'
import { drawnLift, MAX_PRESSURE_ANGLE, steepestClimb } from './camProfile'
import { displacementTable, sampleDisplacement } from './follower'
import {
  DRAWN_MAX_LIFT,
  DRAWN_POINTS,
  drawnCamIssues,
  drawnFrom,
  MOTION_PRESETS,
  presetLifts,
} from './drawnMotion'

const TWO_PI = Math.PI * 2
const cam = (lifts: number[], over: Partial<CustomCamSpec> = {}): CustomCamSpec => ({
  id: 'cam-drawn',
  kind: 'custom',
  baseRadius: 16,
  lifts,
  position: 0.5,
  phaseDeg: 0,
  thickness: 6,
  ...over,
})

describe('drawn motion → cam', () => {
  it('the curve passes through every control height and never dips below zero', () => {
    const lifts = presetLifts(MOTION_PRESETS.find((p) => p.id === 'peck')!, 12)
    lifts.forEach((v, i) => expect(drawnLift(lifts, (i / lifts.length) * TWO_PI)).toBeCloseTo(v, 9))
    for (let k = 0; k < 720; k++) expect(drawnLift(lifts, (k / 720) * TWO_PI)).toBeGreaterThanOrEqual(0)
  })

  it('a narrow follower plays the drawing back in the order it was drawn', () => {
    // asymmetric on purpose: a slow climb then a drop — played backwards
    // it would be a jump then a slow fall, and this test would fail
    const lifts = presetLifts(MOTION_PRESETS.find((p) => p.id === 'peck')!, 12)
    const c = cam(lifts)
    const table = displacementTable(c, 1, 1)
    for (let i = 0; i < lifts.length - 1; i++) {
      const theta = (i / lifts.length) * TWO_PI
      expect(sampleDisplacement(table, theta) - c.baseRadius, `at ${i * 30}°`).toBeCloseTo(lifts[i], 0)
    }
    // it climbs through the turn
    const at = (deg: number) => sampleDisplacement(table, (deg * Math.PI) / 180)
    expect(at(60)).toBeLessThan(at(150))
    expect(at(150)).toBeLessThan(at(270))
  })

  it('the cam phase still shifts the whole motion later in the turn', () => {
    const lifts = presetLifts(MOTION_PRESETS[0], 10)
    const a = displacementTable(cam(lifts), 1, 1)
    const b = displacementTable(cam(lifts, { phaseDeg: 90 }), 1, 1)
    for (const deg of [0, 45, 130, 250])
      expect(sampleDisplacement(b, (deg * Math.PI) / 180)).toBeCloseTo(
        sampleDisplacement(a, ((deg + 90) * Math.PI) / 180),
        1,
      )
  })

  it('on the counter-rotating layshaft the drawing still plays forwards', () => {
    const lifts = presetLifts(MOTION_PRESETS.find((p) => p.id === 'peck')!, 12)
    const c = cam(lifts, { shaft: 'lay' })
    const table = displacementTable(c, 1, -1)
    const at = (deg: number) => sampleDisplacement(table, (deg * Math.PI) / 180)
    expect(at(60)).toBeLessThan(at(150))
    expect(at(150)).toBeLessThan(at(270))
  })

  it('converting a cam to a drawn one keeps its real motion', () => {
    for (const source of simplestAutomaton.mechanism.cams) {
      const rod = simplestAutomaton.mechanism.pushrods.find((r) => r.camId === source.id)!
      const drawn = drawnFrom(source, rod.padWidth, 1)
      expect(drawn.lifts).toHaveLength(DRAWN_POINTS)
      expect(drawn.id).toBe(source.id)
      expect(drawn.phaseDeg).toBe(source.phaseDeg)
      const before = displacementTable(source, rod.padWidth, 1)
      const after = displacementTable(drawn, rod.padWidth, 1)
      // same travel, to within what 12 control points and a wide pad allow
      expect(Math.abs(after.lift - before.lift), source.id).toBeLessThan(2.5)
      // and the high point lands at the same place in the turn (eccentric)
      if (source.kind === 'eccentric') {
        const peak = (t: typeof before) => t.heights.indexOf(t.max)
        const diff = Math.abs(peak(after) - peak(before))
        expect(Math.min(diff, 360 - diff)).toBeLessThanOrEqual(20)
      }
    }
  })

  it('every preset turns freely; an impossible climb is caught, a sudden drop is not', () => {
    for (const p of MOTION_PRESETS) {
      const c = cam(presetLifts(p, 10))
      expect(drawnCamIssues(c), p.id).toEqual([])
      expect(steepestClimb(c)).toBeLessThan(MAX_PRESSURE_ANGLE)
      expect(Math.max(...c.lifts)).toBeLessThanOrEqual(DRAWN_MAX_LIFT)
    }
    const wall = cam([0, 18, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(drawnCamIssues(wall).join(' ')).toMatch(/too steep/)
    // slow climb, cliff at the end: climbing is gentle, so no complaint
    const cliff = cam([0, 1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5, 15, 16.5], { baseRadius: 22 })
    expect(drawnCamIssues(cliff)).toEqual([])
    // a bigger cam makes the same climb gentler
    expect(steepestClimb(cam(wall.lifts, { baseRadius: 30 }))).toBeLessThan(steepestClimb(wall))
    expect(drawnCamIssues(cam(new Array(12).fill(3))).join(' ')).toMatch(/almost flat/)
  })

  it('a toy with a drawn cam saves, reloads, passes the basswood audit and exports both ways', () => {
    const spec = structuredClone(simplestAutomaton)
    const source = spec.mechanism.cams[0]
    spec.mechanism.cams[0] = cam(presetLifts(MOTION_PRESETS[3], 10), {
      id: source.id,
      position: source.position,
    })
    expect(parseSpec(serializeSpec(spec))).toEqual(spec)
    expect(camMaxRadius(spec.mechanism.cams[0])).toBe(26)
    expect(basswoodAudit(spec)).toEqual([])
    expect(generateParts(spec).some((p) => p.name === source.id)).toBe(true)
    expect(buildPrintParts(spec).some((p) => p.name === `cam-${source.id}`)).toBe(true)
    const bad = structuredClone(spec)
    ;(bad.mechanism.cams[0] as CustomCamSpec).lifts = [1, 2]
    expect(() => parseSpec(serializeSpec(bad))).toThrow(/6–36 heights/)
  })
})
