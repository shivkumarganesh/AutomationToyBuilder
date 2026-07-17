import { describe, expect, it } from 'vitest'
import { displacementTable, sampleDisplacement } from '../kinematics/follower'
import { tiltTable } from '../kinematics/channels'
import { nodAndSpin } from '../model/templates'
import { padFaceY, rockerAngle } from './rockerLayout'

describe('rocker linkage geometry', () => {
  const spec = nodAndSpin
  const rocker = spec.mechanism.rockers[0]
  const cam = spec.mechanism.cams.find((c) => c.id === rocker.camId)!
  const shaftHeight = spec.mechanism.shaftHeight
  const table = displacementTable(cam, rocker.padWidth)

  it('keeps the follower pad on the cam surface through the whole revolution', () => {
    for (let deg = 0; deg < 360; deg += 5) {
      const theta = (deg * Math.PI) / 180
      const s = sampleDisplacement(table, theta)
      const camSurfaceY = shaftHeight + s
      const angle = rockerAngle(table, rocker.leverLength, s)
      const pad = padFaceY(table, shaftHeight, rocker.leverLength, angle)
      // sine-vs-linear lever error must stay imperceptible
      expect(Math.abs(pad - camSurfaceY), `at ${deg}°`).toBeLessThan(0.5)
    }
  })

  it('pivot sits so the beam is level at mid-travel', () => {
    const mid = (table.min + table.max) / 2
    const angleAtMid = rockerAngle(table, rocker.leverLength, mid)
    expect(angleAtMid).toBeCloseTo(0, 6)
    expect(padFaceY(table, shaftHeight, rocker.leverLength, angleAtMid)).toBeCloseTo(
      shaftHeight + mid,
      6,
    )
  })

  it('the scene beam angle matches the tilt channel signal exactly', () => {
    const signalTable = tiltTable(table, rocker.leverLength)
    for (const deg of [0, 45, 137, 292]) {
      const theta = (deg * Math.PI) / 180
      const s = sampleDisplacement(table, theta)
      const sceneDeg = (rockerAngle(table, rocker.leverLength, s) * 180) / Math.PI
      expect(sceneDeg).toBeCloseTo(sampleDisplacement(signalTable, theta), 1)
    }
  })
})
