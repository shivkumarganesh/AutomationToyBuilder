import type { AutomatonSpec } from '../model/types'
import type { Point2 } from '../model/figures'
import { generateParts, type Part } from './svgFlatPack'

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
export const BASSWOOD = {
  /** The stock every laser design is validated against. */
  thickness: 3,
  /** A common hobby-laser sheet (A4-ish, sold in packs). */
  sheetWidth: 300,
  sheetHeight: 200,
  /** Narrowest neck allowed to carry a meaningful piece of the part. */
  minWeb: 2,
  /** A neck only matters if more than this much wood hangs beyond it (mm²). */
  minCarried: 8,
  /** Least wood between a hole and the edge, or between two holes. */
  minLigament: 2,
  /** Smallest dimension of any part — anything less is lost in the kerf. */
  minPart: 3,
}

export type AuditRule = 'thickness' | 'size' | 'sheet' | 'web' | 'ligament'

export interface AuditIssue {
  part: string
  rule: AuditRule
  message: string
}

function area(poly: Point2[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.y - q.x * p.y
  }
  return Math.abs(a) / 2
}

function inside(poly: Point2[], pt: Point2): boolean {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x)
      hit = !hit
  }
  return hit
}

/** Resample a closed outline to points no more than `step` apart. */
function densify(poly: Point2[], step: number): Point2[] {
  const out: Point2[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step))
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })
  }
  return out
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

/**
 * The narrowest neck of an outline that carries a real piece of the
 * part: the shortest chord across the material which, if it snapped,
 * would break off at least `minCarried` mm². Pointed tips are not necks
 * (almost nothing hangs beyond them). Returns Infinity when no chord
 * shorter than `limit` qualifies.
 */
export function narrowestWeb(
  outline: Point2[],
  limit = BASSWOOD.minWeb,
  minCarried = BASSWOOD.minCarried,
): number {
  const perimeter = outline.reduce(
    (s, p, i) => s + Math.hypot(outline[(i + 1) % outline.length].x - p.x, outline[(i + 1) % outline.length].y - p.y),
    0,
  )
  const step = Math.max(0.5, perimeter / 900)
  const pts = densify(outline, step)
  const n = pts.length
  const total = area(pts)
  // points this close along the outline are neighbours, not a neck
  const skip = Math.ceil((limit * 2) / step) + 1
  let best = Infinity
  for (let i = 0; i < n; i++) {
    for (let j = i + skip; j < n; j++) {
      if (n - (j - i) < skip) continue
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
      if (d >= limit || d >= best) continue
      const mid = { x: (pts[i].x + pts[j].x) / 2, y: (pts[i].y + pts[j].y) / 2 }
      if (!inside(pts, mid)) continue
      const piece = area(pts.slice(i, j + 1))
      if (Math.min(piece, total - piece) < minCarried) continue
      best = d
    }
  }
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
