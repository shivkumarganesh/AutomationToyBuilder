import type { FigureShape } from '../figures'

/**
 * A figure traced from someone's own line drawing by
 * scripts/trace-art.py: the silhouette, the glued-on plates in stacking
 * order (plate k sits on plate k-1), and the inside lines to engrave.
 * Points are [x, y] in the library's unit box.
 */
export interface TracedArt {
  id: string
  label: string
  /** Size the drawing was checked at, mm. */
  width: number
  height: number
  outline: number[][]
  plates: number[][][]
  engrave: number[][][]
}

const pts = (list: number[][]) => list.map(([x, y]) => ({ x, y }))

export function artFigure(art: TracedArt): FigureShape {
  return {
    id: art.id,
    label: art.label,
    defaultWidth: art.width,
    defaultHeight: art.height,
    outline: pts(art.outline),
    engrave: art.engrave.map(pts),
    layers: art.plates.map(pts),
    layerTiers: art.plates.map((_, k) => k + 1),
    sculpted: true,
  }
}
