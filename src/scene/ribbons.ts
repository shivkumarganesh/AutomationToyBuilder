import { BufferGeometry, Float32BufferAttribute } from 'three'
import type { Point2 } from '../model/figures'

/**
 * Engraved lines as geometry with REAL width (mm), so a scored line on
 * the preview is as wide as the one the laser leaves, instead of a
 * hairline that changes thickness with zoom. `to3` places a 2D point of
 * a line (plus a tiny lift off the surface) in the part's own frame.
 */
export function ribbonGeometry(
  lines: { line: Point2[]; lift: number }[],
  width: number,
  to3: (p: Point2, lift: number) => [number, number, number],
): BufferGeometry | null {
  const pos: number[] = []
  const half = width / 2
  for (const { line, lift } of lines) {
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i]
      const b = line[i + 1]
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      if (len < 1e-6) continue
      // overlap the joints a touch so corners do not gap
      const ux = ((b.x - a.x) / len) * half
      const uy = ((b.y - a.y) / len) * half
      const nx = -uy
      const ny = ux
      const p = [
        { x: a.x - ux + nx, y: a.y - uy + ny },
        { x: a.x - ux - nx, y: a.y - uy - ny },
        { x: b.x + ux - nx, y: b.y + uy - ny },
        { x: b.x + ux + nx, y: b.y + uy + ny },
      ].map((q) => to3(q, lift))
      pos.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3])
    }
  }
  if (pos.length === 0) return null
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  return geo
}

/** Width of a scored line and of the scorch halo around it, mm. */
export const SCORE_WIDTH = 0.45
export const SCORCH_WIDTH = 1.3
/** The colour basswood goes where the laser touches it. */
export const BURNT = '#3a2212'
