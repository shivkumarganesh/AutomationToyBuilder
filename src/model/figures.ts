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

/**
 * Perched songbird in side profile, beak forward (+x). On a tilt channel
 * the plate is turned into the nod plane, so +x points at the hinge and
 * the nod reads as a peck. Outline generated from a hand-tuned control
 * cage via closed Catmull-Rom (sharp corners kept at beak/tail/base).
 */
const bird: FigureShape = {
  id: 'bird',
  label: 'Bird',
  defaultWidth: 34,
  defaultHeight: 26,
  outline: [
    { x: 0, y: 0 },
    { x: 0.073, y: 0.014 },
    { x: 0.15, y: 0.05 },
    { x: 0.186, y: 0.097 },
    { x: 0.213, y: 0.157 },
    { x: 0.23, y: 0.22 },
    { x: 0.233, y: 0.287 },
    { x: 0.225, y: 0.357 },
    { x: 0.21, y: 0.42 },
    { x: 0.183, y: 0.472 },
    { x: 0.15, y: 0.517 },
    { x: 0.13, y: 0.56 },
    { x: 0.13, y: 0.604 },
    { x: 0.144, y: 0.646 },
    { x: 0.17, y: 0.68 },
    { x: 0.236, y: 0.71 },
    { x: 0.32, y: 0.73 },
    { x: 0.5, y: 0.77 },
    { x: 0.32, y: 0.81 },
    { x: 0.292, y: 0.851 },
    { x: 0.27, y: 0.9 },
    { x: 0.231, y: 0.938 },
    { x: 0.184, y: 0.977 },
    { x: 0.14, y: 1 },
    { x: 0.102, y: 0.998 },
    { x: 0.068, y: 0.98 },
    { x: 0.04, y: 0.95 },
    { x: 0.023, y: 0.906 },
    { x: 0.013, y: 0.851 },
    { x: 0, y: 0.8 },
    { x: -0.02, y: 0.756 },
    { x: -0.044, y: 0.716 },
    { x: -0.07, y: 0.68 },
    { x: -0.097, y: 0.65 },
    { x: -0.126, y: 0.625 },
    { x: -0.16, y: 0.6 },
    { x: -0.201, y: 0.563 },
    { x: -0.247, y: 0.526 },
    { x: -0.3, y: 0.52 },
    { x: -0.414, y: 0.625 },
    { x: -0.5, y: 0.72 },
    { x: -0.42, y: 0.56 },
    { x: -0.35, y: 0.471 },
    { x: -0.28, y: 0.38 },
    { x: -0.25, y: 0.319 },
    { x: -0.227, y: 0.259 },
    { x: -0.2, y: 0.2 },
    { x: -0.163, y: 0.141 },
    { x: -0.123, y: 0.084 },
    { x: -0.09, y: 0.04 },
    { x: -0.066, y: 0.01 },
    { x: -0.05, y: 0 },
  ],
}

export const FIGURE_SHAPES: Record<string, FigureShape> = {
  dancer,
  bird,
}

export const DEFAULT_FIGURE_SHAPE = 'dancer'

/** Outline scaled to a character's real dimensions (mm), feet at y = 0. */
export function figureOutline(shapeId: string, width: number, height: number): Point2[] {
  const shape = FIGURE_SHAPES[shapeId]
  if (!shape) throw new Error(`unknown figure shape ${shapeId}`)
  return shape.outline.map((p) => ({ x: p.x * width, y: p.y * height }))
}
