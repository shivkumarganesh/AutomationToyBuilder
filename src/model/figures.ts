/**
 * Curated silhouette figure library.
 *
 * Each shape is a closed 2D outline in NORMALIZED coordinates:
 *   x ∈ [-0.5, 0.5]  (scaled by the character's width)
 *   y ∈ [0, 1]       (scaled by the character's height, feet at y = 0)
 * drawn counter-clockwise. Figures cut/print as flat plates (the laser
 * kit style: skaters, storybook characters), stand upright facing the
 * viewer, and mount on any output channel exactly where a block sits.
 *
 * The library is curated — shapes are designed here, reviewed in the 3D
 * scene, and every one must read clearly BOTH on screen and as a single
 * laser-cut piece (no islands, no hairline necks).
 */

export interface Point2 {
  x: number
  y: number
}

export interface FigureShape {
  id: string
  label: string
  /** Closed outline, normalized (see module doc). */
  outline: Point2[]
  /** Sensible default size (mm) when a figure switches to this shape. */
  defaultWidth: number
  defaultHeight: number
}

/**
 * Ballerina in arabesque: standing leg under the body, back leg extended,
 * arms raised ahead — the classic spinning-figure pose from music boxes
 * and the laser-cut skater kits.
 */
const dancer: FigureShape = {
  id: 'dancer',
  label: 'Dancer',
  defaultWidth: 34,
  defaultHeight: 42,
  outline: [
    // pointe-shoe foot: toe forward, then up the FRONT of the standing leg
    { x: 0.13, y: 0.0 },
    { x: 0.05, y: 0.05 },
    { x: 0.045, y: 0.18 },
    { x: 0.038, y: 0.32 },
    { x: 0.05, y: 0.5 },
    // tutu: wide, crisp skirt
    { x: 0.28, y: 0.55 },
    { x: 0.33, y: 0.6 },
    { x: 0.07, y: 0.66 },
    // torso right edge up to the shoulder
    { x: 0.08, y: 0.76 },
    // right arm raised up-and-out
    { x: 0.28, y: 0.92 },
    { x: 0.31, y: 0.965 },
    { x: 0.26, y: 0.975 },
    { x: 0.065, y: 0.835 },
    // neck → head (round, with a top)
    { x: 0.045, y: 0.845 },
    { x: 0.038, y: 0.865 },
    { x: 0.06, y: 0.878 },
    { x: 0.077, y: 0.925 },
    { x: 0.053, y: 0.978 },
    { x: 0.0, y: 1.0 },
    { x: -0.053, y: 0.978 },
    { x: -0.077, y: 0.925 },
    { x: -0.06, y: 0.878 },
    { x: -0.038, y: 0.865 },
    { x: -0.045, y: 0.845 },
    // left arm raised up-and-out (slightly lower — a living pose)
    { x: -0.065, y: 0.83 },
    { x: -0.26, y: 0.965 },
    { x: -0.31, y: 0.955 },
    { x: -0.28, y: 0.905 },
    { x: -0.08, y: 0.755 },
    // torso left edge down to the waist
    { x: -0.07, y: 0.66 },
    // tutu left
    { x: -0.33, y: 0.6 },
    { x: -0.28, y: 0.55 },
    { x: -0.15, y: 0.535 },
    // arabesque leg extended behind, pointed toe
    { x: -0.44, y: 0.5 },
    { x: -0.5, y: 0.47 },
    { x: -0.43, y: 0.448 },
    { x: -0.13, y: 0.49 },
    // under the tutu, back of the standing leg, small heel
    { x: -0.045, y: 0.5 },
    { x: -0.035, y: 0.32 },
    { x: -0.028, y: 0.18 },
    { x: -0.035, y: 0.04 },
    { x: -0.045, y: 0.0 },
  ],
}

export const FIGURE_SHAPES: Record<string, FigureShape> = {
  dancer,
}

export const DEFAULT_FIGURE_SHAPE = 'dancer'

/** Outline scaled to a character's real dimensions (mm), feet at y = 0. */
export function figureOutline(shapeId: string, width: number, height: number): Point2[] {
  const shape = FIGURE_SHAPES[shapeId]
  if (!shape) throw new Error(`unknown figure shape ${shapeId}`)
  return shape.outline.map((p) => ({ x: p.x * width, y: p.y * height }))
}
