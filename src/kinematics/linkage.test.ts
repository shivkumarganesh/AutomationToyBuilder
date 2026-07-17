import { describe, expect, it } from 'vitest'
import { soaringGull } from '../model/templates'
import {
  couplerPlateOutline,
  grashofOk,
  linkagePose,
  meanCouplerAngle,
  pathTable,
  samplePath,
  wandPlaneCrossing,
} from './linkage'

const linkage = soaringGull.mechanism.linkages![0]
const shaftY = soaringGull.mechanism.shaftHeight
const TWO_PI = Math.PI * 2

describe('four-bar linkage solver', () => {
  const phiMean = meanCouplerAngle(linkage)

  it('is a Grashof crank-rocker with margin — the crank turns forever', () => {
    expect(grashofOk(linkage)).toBe(true)
    expect(pathTable(linkage).valid).toBe(true)
  })

  it('preserves the link lengths exactly at every crank angle', () => {
    // THE four-bar invariant: rigid bars never stretch. |AB| = coupler,
    // |O4B| = rocker, |A| = crank radius.
    for (let deg = 0; deg < 360; deg += 2) {
      const pose = linkagePose(linkage, (deg / 360) * TWO_PI, phiMean)
      expect(Math.hypot(pose.a.u, pose.a.v), `crank at ${deg}°`).toBeCloseTo(
        linkage.crankRadius,
        9,
      )
      expect(
        Math.hypot(pose.b.u - pose.a.u, pose.b.v - pose.a.v),
        `coupler at ${deg}°`,
      ).toBeCloseTo(linkage.couplerLen, 9)
      expect(
        Math.hypot(pose.b.u - linkage.groundLen, pose.b.v),
        `rocker at ${deg}°`,
      ).toBeCloseTo(linkage.rockerLen, 9)
    }
  })

  it('the coupler point sits on the coupler line, one extension past B', () => {
    for (let deg = 0; deg < 360; deg += 10) {
      const pose = linkagePose(linkage, (deg / 360) * TWO_PI, phiMean)
      const reach = linkage.couplerLen + linkage.couplerExt
      expect(Math.hypot(pose.p.u - pose.a.u, pose.p.v - pose.a.v)).toBeCloseTo(reach, 9)
      // collinear with A→B
      const cross =
        (pose.b.u - pose.a.u) * (pose.p.v - pose.a.v) -
        (pose.b.v - pose.a.v) * (pose.p.u - pose.a.u)
      expect(Math.abs(cross)).toBeLessThan(1e-6)
    }
  })

  it('never snaps between assembly branches: the motion is continuous', () => {
    let prev = linkagePose(linkage, 0, phiMean)
    for (let i = 1; i <= 720; i++) {
      const pose = linkagePose(linkage, (i / 720) * TWO_PI, phiMean)
      const jump = Math.hypot(pose.b.u - prev.b.u, pose.b.v - prev.b.v)
      expect(jump, `step ${i}`).toBeLessThan(2.5)
      prev = pose
    }
  })

  it('the path is periodic: one crank turn returns the mount exactly', () => {
    const p0 = linkagePose(linkage, 0.3, phiMean)
    const p1 = linkagePose(linkage, 0.3 + TWO_PI, phiMean)
    expect(p1.mount.u).toBeCloseTo(p0.mount.u, 9)
    expect(p1.mount.v).toBeCloseTo(p0.mount.v, 9)
  })

  it('the rocker oscillates — it never crosses its pivot', () => {
    let minAng = Infinity
    let maxAng = -Infinity
    for (let i = 0; i < 720; i++) {
      const pose = linkagePose(linkage, (i / 720) * TWO_PI, phiMean)
      const ang = Math.atan2(pose.b.v, pose.b.u - linkage.groundLen)
      minAng = Math.min(minAng, ang)
      maxAng = Math.max(maxAng, ang)
    }
    // a crank-rocker's output swings through less than a half turn
    expect(maxAng - minAng).toBeGreaterThan(0.1)
    expect(maxAng - minAng).toBeLessThan(Math.PI)
  })

  it('samplePath interpolates the table faithfully', () => {
    const table = pathTable(linkage)
    const s = samplePath(table, (37.5 / 360) * TWO_PI)
    const lo = table.v[37]
    const hi = table.v[38]
    expect(s.v).toBeGreaterThanOrEqual(Math.min(lo, hi) - 1e-9)
    expect(s.v).toBeLessThanOrEqual(Math.max(lo, hi) + 1e-9)
  })
})

describe('soaring gull layout', () => {
  const table = pathTable(linkage)
  const frame = soaringGull.frame
  const stageTop = frame.height + frame.materialThickness

  it('the gull flies above the stage for the whole revolution', () => {
    expect(shaftY + table.vMin).toBeGreaterThan(stageTop + 4)
  })

  it('the flight stays inside the box footprint', () => {
    expect(table.uMax).toBeLessThan(frame.depth / 2 - 4)
    expect(table.uMin).toBeGreaterThan(-frame.depth / 2 + 4)
    // and the rocker pivot post too
    expect(linkage.groundLen).toBeLessThan(frame.depth / 2 - 4)
  })

  it('the stage slot is derived from the wand crossing, and fits the stage', () => {
    const planeV = frame.height + frame.materialThickness / 2 - shaftY
    const cross = wandPlaneCrossing(linkage, planeV)
    expect(cross.max).toBeGreaterThan(cross.min)
    // slot inside the stage plate
    expect(cross.max).toBeLessThan(frame.depth / 2 - 6)
    expect(cross.min).toBeGreaterThan(-frame.depth / 2 + 6)
    // the mount travels farther than the slot needs to be — the slot is
    // where the wand pierces, well below the mount
    expect(cross.max - cross.min).toBeLessThanOrEqual(table.uMax - table.uMin + 1e-9)
  })

  it('a real dive: meaningful travel in BOTH directions plus pitch', () => {
    expect(table.uMax - table.uMin).toBeGreaterThan(20)
    expect(table.vMax - table.vMin).toBeGreaterThan(5)
    const pitchSpan = Math.max(...table.pitchDeg) - Math.min(...table.pitchDeg)
    expect(pitchSpan).toBeGreaterThan(15)
  })

  it('the coupler plate carries the wand at the derived angle', () => {
    const pts = couplerPlateOutline(linkage)
    expect(pts).toHaveLength(8)
    // the wand tip vertices sit one wand length from the coupler point
    const reach = linkage.couplerLen + linkage.couplerExt
    const tipMid = {
      x: (pts[4].x + pts[5].x) / 2,
      y: (pts[4].y + pts[5].y) / 2,
    }
    expect(Math.hypot(tipMid.x - reach, tipMid.y)).toBeCloseTo(linkage.wandLen, 6)
  })
})
