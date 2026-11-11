import type { Point2 } from './figures'

/**
 * The basswood limits and the neck measurement, in a module with no
 * dependency on the part generators — so layout code that DECIDES what
 * to cut (for example, how many depth layers a figure can carry) can
 * apply the same rule the audit later checks.
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


export function area(poly: Point2[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.y - q.x * p.y
  }
  return Math.abs(a) / 2
}

export function inside(poly: Point2[], pt: Point2): boolean {
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
export function densify(poly: Point2[], step: number): Point2[] {
  const out: Point2[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step))
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })
  }
  return out
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

