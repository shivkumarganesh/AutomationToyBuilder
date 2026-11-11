import type { AutomatonSpec } from '../model/types'
import type { Point2 } from '../model/figures'
import { generateParts, type Part } from './svgFlatPack'
import { BASSWOOD, densify, narrowestWeb } from '../model/webCheck'

export { BASSWOOD, narrowestWeb }

/**
 * Buildability audit for the laser route in 3 mm basswood.
 *
 * Basswood is soft and splits along the grain, so a part that is fine
 * in a 3D print can snap in the hand: a thin neck carrying a big piece,
 * a hole burnt too close to an edge, a sliver too small to hold. This
 * module measures every flat-pack part against those limits. The same
 * functions back the automated tests (every shipped toy and recipe must
 * pass) and the live check in the Make view (a user's edits must pass
 * before they cut).
 */
export type AuditRule = 'thickness' | 'size' | 'sheet' | 'web' | 'ligament'

export interface AuditIssue {
  part: string
  rule: AuditRule
  message: string
}

function segDist(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

/** Smallest distance from any point of `pts` to the closed polyline `poly`. */
function minDistance(pts: Point2[], poly: Point2[]): number {
  let best = Infinity
  for (const p of pts)
    for (let i = 0; i < poly.length; i++)
      best = Math.min(best, segDist(p, poly[i], poly[(i + 1) % poly.length]))
  return best
}

/** Audit one flat-pack part against the basswood limits. */
export function auditPart(part: Part): AuditIssue[] {
  const issues: AuditIssue[] = []
  const B = BASSWOOD
  if (Math.min(part.width, part.height) < B.minPart - 1e-6)
    issues.push({
      part: part.name,
      rule: 'size',
      message: `only ${Math.min(part.width, part.height).toFixed(1)} mm across — too small to cut and handle`,
    })
  const fits =
    (part.width <= B.sheetWidth && part.height <= B.sheetHeight) ||
    (part.width <= B.sheetHeight && part.height <= B.sheetWidth)
  if (!fits)
    issues.push({
      part: part.name,
      rule: 'sheet',
      message: `${Math.round(part.width)} × ${Math.round(part.height)} mm does not fit a ${B.sheetWidth} × ${B.sheetHeight} mm sheet`,
    })
  const web = narrowestWeb(part.outline)
  if (web < B.minWeb)
    issues.push({
      part: part.name,
      rule: 'web',
      message: `has a neck only ${web.toFixed(1)} mm wide — it would snap in ${B.thickness} mm basswood`,
    })
  const outline = densify(part.outline, 1)
  const holes = part.holes.map((h) => densify(h, 0.5))
  let lig = Infinity
  for (const h of holes) lig = Math.min(lig, minDistance(h, outline))
  for (let i = 0; i < holes.length; i++)
    for (let j = i + 1; j < holes.length; j++) lig = Math.min(lig, minDistance(holes[i], holes[j]))
  if (lig < B.minLigament - 1e-6)
    issues.push({
      part: part.name,
      rule: 'ligament',
      message: `has only ${lig.toFixed(1)} mm of wood beside a hole — it would break out`,
    })
  return issues
}

/** Audit a whole design as a 3 mm basswood laser build. Empty = buildable. */
export function basswoodAudit(spec: AutomatonSpec): AuditIssue[] {
  const issues: AuditIssue[] = []
  if (Math.abs(spec.frame.materialThickness - BASSWOOD.thickness) > 1e-6)
    issues.push({
      part: 'sheet',
      rule: 'thickness',
      message: `design is set to ${spec.frame.materialThickness} mm sheet, not ${BASSWOOD.thickness} mm basswood`,
    })
  for (const part of generateParts(spec)) issues.push(...auditPart(part))
  return issues
}
