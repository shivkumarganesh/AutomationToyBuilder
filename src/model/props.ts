import type { Point2 } from './figures'
import { CHRISTMAS_PROPS } from './christmas'

/**
 * Curated scenery library: static flat plates that stand on the stage
 * and set the scene around the moving figures (waves in front of a
 * whale, hills behind a bird). Same normalized outline convention as
 * the figure library — x ∈ [-0.5, 0.5] × width, y ∈ [0, 1] × height —
 * and every shape has a flat base at y = 0 centred on x = 0, where its
 * mounting tabs drop into the stage.
 */
export interface PropShape {
  id: string
  label: string
  outline: Point2[]
  defaultWidth: number
  defaultHeight: number
  defaultColor: string
  /** Row the prop naturally belongs in. */
  defaultRow: 'front' | 'back'
}

const waves: PropShape = {
  id: 'waves',
  label: 'Waves',
  defaultWidth: 100,
  defaultHeight: 14,
  defaultColor: '#4fa9c9',
  defaultRow: 'front',
  outline: [
    { x: -0.5, y: 0 },
    { x: 0.5, y: 0 },
    { x: 0.5, y: 0.462 },
    { x: 0.484, y: 0.601 },
    { x: 0.46, y: 0.769 },
    { x: 0.431, y: 0.918 },
    { x: 0.4, y: 1 },
    { x: 0.369, y: 0.923 },
    { x: 0.34, y: 0.769 },
    { x: 0.316, y: 0.563 },
    { x: 0.3, y: 0.385 },
    { x: 0.284, y: 0.563 },
    { x: 0.26, y: 0.769 },
    { x: 0.231, y: 0.923 },
    { x: 0.2, y: 1 },
    { x: 0.169, y: 0.923 },
    { x: 0.14, y: 0.769 },
    { x: 0.116, y: 0.563 },
    { x: 0.1, y: 0.385 },
    { x: 0.084, y: 0.563 },
    { x: 0.06, y: 0.769 },
    { x: 0.031, y: 0.923 },
    { x: 0, y: 1 },
    { x: -0.031, y: 0.923 },
    { x: -0.06, y: 0.769 },
    { x: -0.084, y: 0.563 },
    { x: -0.1, y: 0.385 },
    { x: -0.116, y: 0.563 },
    { x: -0.14, y: 0.769 },
    { x: -0.169, y: 0.923 },
    { x: -0.2, y: 1 },
    { x: -0.231, y: 0.923 },
    { x: -0.26, y: 0.769 },
    { x: -0.284, y: 0.563 },
    { x: -0.3, y: 0.385 },
    { x: -0.316, y: 0.563 },
    { x: -0.34, y: 0.769 },
    { x: -0.369, y: 0.923 },
    { x: -0.4, y: 1 },
    { x: -0.431, y: 0.923 },
    { x: -0.46, y: 0.769 },
    { x: -0.484, y: 0.563 },
    { x: -0.5, y: 0.385 },
  ],
}

const grass: PropShape = {
  id: 'grass',
  label: 'Grass',
  defaultWidth: 60,
  defaultHeight: 14,
  defaultColor: '#4fb06a',
  defaultRow: 'front',
  outline: [
    { x: -0.5, y: 0 },
    { x: 0.5, y: 0 },
    { x: 0.5, y: 0.167 },
    { x: 0.42, y: 0.5 },
    { x: 0.4, y: 0.167 },
    { x: 0.36, y: 0.833 },
    { x: 0.3, y: 0.167 },
    { x: 0.22, y: 0.556 },
    { x: 0.2, y: 0.167 },
    { x: 0.16, y: 1 },
    { x: 0.1, y: 0.167 },
    { x: 0.02, y: 0.667 },
    { x: 0, y: 0.167 },
    { x: -0.04, y: 0.889 },
    { x: -0.1, y: 0.167 },
    { x: -0.18, y: 0.444 },
    { x: -0.2, y: 0.167 },
    { x: -0.24, y: 0.778 },
    { x: -0.3, y: 0.167 },
    { x: -0.38, y: 0.611 },
    { x: -0.4, y: 0.167 },
    { x: -0.44, y: 0.944 },
    { x: -0.5, y: 0.167 },
  ],
}

const hills: PropShape = {
  id: 'hills',
  label: 'Hills',
  defaultWidth: 110,
  defaultHeight: 34,
  defaultColor: '#6f9a5a',
  defaultRow: 'back',
  outline: [
    { x: -0.5, y: 0 },
    { x: 0.5, y: 0 },
    { x: 0.5, y: 0.2 },
    { x: 0.459, y: 0.362 },
    { x: 0.4, y: 0.55 },
    { x: 0.333, y: 0.681 },
    { x: 0.26, y: 0.75 },
    { x: 0.188, y: 0.7 },
    { x: 0.12, y: 0.6 },
    { x: 0.061, y: 0.491 },
    { x: 0.02, y: 0.4 },
    { x: -0.01, y: 0.511 },
    { x: -0.054, y: 0.667 },
    { x: -0.1, y: 0.8 },
    { x: -0.169, y: 0.941 },
    { x: -0.24, y: 1 },
    { x: -0.311, y: 0.916 },
    { x: -0.38, y: 0.75 },
    { x: -0.426, y: 0.598 },
    { x: -0.47, y: 0.424 },
    { x: -0.5, y: 0.3 },
  ],
}

const tree: PropShape = {
  id: 'tree',
  label: 'Tree',
  defaultWidth: 30,
  defaultHeight: 56,
  defaultColor: '#3f8f58',
  defaultRow: 'back',
  outline: [
    { x: 0, y: 0 },
    { x: 0.083, y: 0 },
    { x: 0.078, y: 0.052 },
    { x: 0.072, y: 0.126 },
    { x: 0.067, y: 0.2 },
    { x: 0.065, y: 0.274 },
    { x: 0.066, y: 0.348 },
    { x: 0.067, y: 0.4 },
    { x: 0.173, y: 0.383 },
    { x: 0.3, y: 0.38 },
    { x: 0.4, y: 0.429 },
    { x: 0.467, y: 0.5 },
    { x: 0.456, y: 0.579 },
    { x: 0.433, y: 0.66 },
    { x: 0.475, y: 0.731 },
    { x: 0.5, y: 0.8 },
    { x: 0.433, y: 0.877 },
    { x: 0.333, y: 0.94 },
    { x: 0.231, y: 0.956 },
    { x: 0.133, y: 0.96 },
    { x: 0.063, y: 0.984 },
    { x: 0, y: 1 },
    { x: -0.063, y: 0.984 },
    { x: -0.133, y: 0.96 },
    { x: -0.231, y: 0.956 },
    { x: -0.333, y: 0.94 },
    { x: -0.433, y: 0.877 },
    { x: -0.5, y: 0.8 },
    { x: -0.475, y: 0.731 },
    { x: -0.433, y: 0.66 },
    { x: -0.456, y: 0.579 },
    { x: -0.467, y: 0.5 },
    { x: -0.4, y: 0.429 },
    { x: -0.3, y: 0.38 },
    { x: -0.173, y: 0.383 },
    { x: -0.067, y: 0.4 },
    { x: -0.066, y: 0.348 },
    { x: -0.065, y: 0.274 },
    { x: -0.067, y: 0.2 },
    { x: -0.072, y: 0.126 },
    { x: -0.078, y: 0.052 },
    { x: -0.083, y: 0 },
  ],
}

const cloud: PropShape = {
  id: 'cloud',
  label: 'Cloud',
  defaultWidth: 40,
  defaultHeight: 70,
  defaultColor: '#dfe6ee',
  defaultRow: 'back',
  outline: [
    { x: 0, y: 0 },
    { x: 0.06, y: 0 },
    { x: 0.06, y: 0.62 },
    { x: 0.138, y: 0.619 },
    { x: 0.238, y: 0.62 },
    { x: 0.327, y: 0.625 },
    { x: 0.405, y: 0.64 },
    { x: 0.464, y: 0.675 },
    { x: 0.5, y: 0.72 },
    { x: 0.494, y: 0.775 },
    { x: 0.476, y: 0.82 },
    { x: 0.449, y: 0.869 },
    { x: 0.405, y: 0.92 },
    { x: 0.335, y: 0.939 },
    { x: 0.262, y: 0.94 },
    { x: 0.205, y: 0.921 },
    { x: 0.167, y: 0.9 },
    { x: 0.137, y: 0.939 },
    { x: 0.095, y: 0.98 },
    { x: 0.049, y: 0.996 },
    { x: 0, y: 1 },
    { x: -0.049, y: 0.996 },
    { x: -0.095, y: 0.98 },
    { x: -0.137, y: 0.939 },
    { x: -0.167, y: 0.9 },
    { x: -0.205, y: 0.921 },
    { x: -0.262, y: 0.94 },
    { x: -0.335, y: 0.939 },
    { x: -0.405, y: 0.92 },
    { x: -0.449, y: 0.869 },
    { x: -0.476, y: 0.82 },
    { x: -0.494, y: 0.775 },
    { x: -0.5, y: 0.72 },
    { x: -0.464, y: 0.675 },
    { x: -0.405, y: 0.64 },
    { x: -0.327, y: 0.625 },
    { x: -0.238, y: 0.62 },
    { x: -0.138, y: 0.619 },
    { x: -0.06, y: 0.62 },
    { x: -0.06, y: 0 },
  ],
}

/** The stage has two rows; more than a handful of plates just hides the figures. */
export const MAX_PROPS = 6

export const PROP_SHAPES: Record<string, PropShape> = {
  waves,
  grass,
  hills,
  tree,
  cloud,
  ...Object.fromEntries(CHRISTMAS_PROPS.map((p) => [p.id, p])),
}

/** Outline scaled to real dimensions (mm), base at y = 0. */
export function propOutline(shapeId: string, width: number, height: number): Point2[] {
  const shape = PROP_SHAPES[shapeId]
  if (!shape) throw new Error(`unknown prop shape ${shapeId}`)
  return shape.outline.map((p) => ({ x: p.x * width, y: p.y * height }))
}
