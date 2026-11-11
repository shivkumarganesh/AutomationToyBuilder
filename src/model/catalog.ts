import type { AutomatonSpec, CamSpec, CharacterSpec, PropSpec } from './types'
import { FIGURE_SHAPES } from './figures'
import { PROP_SHAPES } from './props'

/**
 * The product catalogue: plain-language descriptions of every motion,
 * figure and ready-made toy, and the RECIPES that compose a working toy
 * from "this figure, moving like that".
 *
 * Recipes are pure data → spec functions built from parameter sets the
 * shipped templates already prove (same cams, rods, levers, linkage
 * proportions), so a composed toy is as buildable as a template.
 */

export type MotionId = 'bob' | 'bounce' | 'drop' | 'nod' | 'spin' | 'swoop'

export interface MotionInfo {
  id: MotionId
  label: string
  /** What the figure does, in words a first-timer understands. */
  blurb: string
  /** The hardware under the stage that produces it. */
  mechanism: string
  /** 1 = easiest build … 3 = most parts and fiddling. */
  difficulty: 1 | 2 | 3
}

export const MOTIONS: Record<MotionId, MotionInfo> = {
  bob: {
    id: 'bob',
    label: 'Bob',
    blurb: 'Rises and sinks smoothly, once per turn — swimming, floating, breathing.',
    mechanism: 'Round off-centre cam + pushrod',
    difficulty: 1,
  },
  bounce: {
    id: 'bounce',
    label: 'Bounce',
    blurb: 'Three quick hops every turn — fluttering, hopping, jumping for joy.',
    mechanism: 'Three-lobed petal cam + pushrod',
    difficulty: 1,
  },
  drop: {
    id: 'drop',
    label: 'Climb & drop',
    blurb: 'Creeps slowly upward, then suddenly drops — pecking, pouncing, lift-off.',
    mechanism: 'Snail cam + pushrod',
    difficulty: 1,
  },
  nod: {
    id: 'nod',
    label: 'Rock',
    blurb: 'Tips forward and back on a hinge — nodding, pecking, rocking on waves.',
    mechanism: 'Cam + rocker lever and hinge',
    difficulty: 2,
  },
  spin: {
    id: 'spin',
    label: 'Spin',
    blurb: 'Twirls round and round on a turntable — dancing, circling, orbiting.',
    mechanism: 'Friction wheel + spindle',
    difficulty: 2,
  },
  swoop: {
    id: 'swoop',
    label: 'Swoop',
    blurb: 'Glides forward, dips and rises along a loop — flying, leaping, diving.',
    mechanism: 'Four-bar linkage + wand',
    difficulty: 3,
  },
}

export type SceneId = 'none' | 'sea' | 'meadow' | 'sky'

export const SCENES: Record<SceneId, { label: string }> = {
  none: { label: 'No scenery' },
  sea: { label: 'Sea' },
  meadow: { label: 'Meadow' },
  sky: { label: 'Sky' },
}

export interface FigureInfo {
  /** One line for the gallery card. */
  blurb: string
  /** Motions that suit this figure, best first. */
  motions: MotionId[]
  scene: SceneId
  color: string
}

export const FIGURE_INFO: Record<string, FigureInfo> = {
  whale: {
    blurb: 'A gentle giant rolling through the swell.',
    motions: ['bob', 'swoop', 'nod'],
    scene: 'sea',
    color: '#4f7fc9',
  },
  dolphin: {
    blurb: 'Leaps out of the waves and dives back in.',
    motions: ['swoop', 'bounce', 'bob'],
    scene: 'sea',
    color: '#5aa0c8',
  },
  fish: {
    blurb: 'Darts and wiggles between the waves.',
    motions: ['bounce', 'bob', 'swoop'],
    scene: 'sea',
    color: '#e0764f',
  },
  ray: {
    blurb: 'Glides like a kite under water.',
    motions: ['swoop', 'bob', 'spin'],
    scene: 'sea',
    color: '#8a6fe8',
  },
  sailboat: {
    blurb: 'Pitches and rolls on a choppy sea.',
    motions: ['nod', 'bob', 'swoop'],
    scene: 'sea',
    color: '#e6e9ee',
  },
  bird: {
    blurb: 'Pecks at the ground or hops about.',
    motions: ['nod', 'drop', 'bounce'],
    scene: 'meadow',
    color: '#4fb06a',
  },
  butterfly: {
    blurb: 'Flutters over the grass.',
    motions: ['bounce', 'swoop', 'spin'],
    scene: 'meadow',
    color: '#e0a54f',
  },
  cat: {
    blurb: 'Watches, waits… and pounces.',
    motions: ['drop', 'nod', 'spin'],
    scene: 'meadow',
    color: '#3c3f47',
  },
  dancer: {
    blurb: 'A ballerina turning on her toes.',
    motions: ['spin', 'bob', 'bounce'],
    scene: 'none',
    color: '#c94f8e',
  },
  rocket: {
    blurb: 'Climbs through the clouds, falls back, tries again.',
    motions: ['drop', 'bob', 'spin'],
    scene: 'sky',
    color: '#c93a2e',
  },
}

export interface TemplateInfo {
  blurb: string
  tags: string[]
  difficulty: 1 | 2 | 3
}

/** Keyed like the template registry. */
export const TEMPLATE_INFO: Record<string, TemplateInfo> = {
  simplest: {
    blurb: 'Two figures, two cams. The classic first automaton — start here.',
    tags: ['cams', 'pushrods'],
    difficulty: 1,
  },
  woodpecker: {
    blurb: 'A snail cam winds the woodpecker up, then lets it drop — tock!',
    tags: ['snail cam'],
    difficulty: 1,
  },
  nodspin: {
    blurb: 'A bird nods on a rocker while a dancer twirls on a turntable.',
    tags: ['rocker', 'spinner'],
    difficulty: 2,
  },
  hummingbird: {
    blurb: 'Gears speed up a second shaft so the bee flutters while the flower sways.',
    tags: ['gears', 'layshaft'],
    difficulty: 3,
  },
  carousel: {
    blurb: 'Bevel gears turn the crank motion through 90° to drive a carousel.',
    tags: ['bevel gears'],
    difficulty: 3,
  },
  owl: {
    blurb: 'A Geneva drive turns the owl in crisp steps, pausing between each.',
    tags: ['geneva drive'],
    difficulty: 3,
  },
  bird: {
    blurb: 'Jointed wings, head and tail — all flapping from wires inside the body.',
    tags: ['articulated', 'wire linkage'],
    difficulty: 3,
  },
  gull: {
    blurb: 'A four-bar linkage carries the gull in a true gliding loop over a wave.',
    tags: ['four-bar linkage'],
    difficulty: 3,
  },
  flyingbird: {
    blurb: 'The body stays still on its post while two rods lift the hinged wings.',
    tags: ['hinged wings', '2 rods'],
    difficulty: 2,
  },
  manta: {
    blurb: 'Two plates per wing on four rods — a wave rolls out to the wing tips.',
    tags: ['rippling wings', '4 rods'],
    difficulty: 3,
  },
  dragon: {
    blurb: 'Bat wings that beat from the shoulder and whip at the wrist.',
    tags: ['two-part wings', '4 rods'],
    difficulty: 3,
  },
  fish: {
    blurb: 'A body cut in four, each piece on its own cam — the fish swims.',
    tags: ['segmented body', '4 rods'],
    difficulty: 2,
  },
}

/** Templates whose figure itself is jointed or segmented — shown first in the gallery. */
export const ARTICULATED_TEMPLATES = ['flyingbird', 'manta', 'dragon', 'fish', 'bird']

const DEFAULT_EXPORT = { kerf: 0.1, fdmClearance: 0.2 }
const CRANK = { armLength: 25, handleLength: 30, handleDiameter: 10 }

function liftCam(motion: 'bob' | 'bounce' | 'drop', position: number): CamSpec {
  const base = { id: `cam-${motion}`, position, phaseDeg: 0, thickness: 6 }
  switch (motion) {
    case 'bob':
      return { ...base, kind: 'eccentric', radius: 20, eccentricity: 8 }
    case 'bounce':
      return { ...base, kind: 'petal', baseRadius: 16, lift: 8, lobes: 3 }
    case 'drop':
      return { ...base, kind: 'snail', baseRadius: 14, lift: 12 }
  }
}

/** Scenery for a scene, laid out for a stage of the given width. */
export function sceneProps(scene: SceneId): PropSpec[] {
  const make = (id: string, shape: string, position: number, scale = 1): PropSpec => {
    const s = PROP_SHAPES[shape]
    return {
      id,
      shape,
      position,
      row: s.defaultRow,
      width: Math.round(s.defaultWidth * scale),
      height: Math.round(s.defaultHeight * scale),
      color: s.defaultColor,
    }
  }
  switch (scene) {
    case 'sea':
      return [make('prop-waves', 'waves', 0.5)]
    case 'meadow':
      return [make('prop-grass', 'grass', 0.3), make('prop-tree', 'tree', 0.84)]
    case 'sky':
      return [make('prop-cloud-1', 'cloud', 0.2), make('prop-cloud-2', 'cloud', 0.82, 0.8)]
    case 'none':
      return []
  }
}

/**
 * Compose a complete one-figure toy: the library figure `shapeId`
 * driven by `motion`, centred in a box sized for that mechanism, with
 * the figure's natural scenery around it.
 */
export function composeToy(shapeId: string, motion: MotionId): AutomatonSpec {
  const shape = FIGURE_SHAPES[shapeId]
  if (!shape) throw new Error(`unknown figure shape ${shapeId}`)
  const info = FIGURE_INFO[shapeId]
  const figure = (channelId: string): CharacterSpec => ({
    id: `figure-${shapeId}`,
    channelId,
    kind: 'silhouette',
    shape: shapeId,
    width: shape.defaultWidth,
    height: shape.defaultHeight,
    depth: 14,
    color: info?.color ?? '#4f8fe0',
    label: shape.label,
  })
  const name = `${MOTION_ADJECTIVE[motion]} ${shape.label}`
  const props = sceneProps(info?.scene ?? 'none')
  const withProps = props.length > 0 ? { props } : {}

  switch (motion) {
    case 'bob':
    case 'bounce':
    case 'drop':
      return {
        name,
        frame: { width: 140, depth: 80, height: 100, materialThickness: 3 },
        mechanism: {
          shaftDiameter: 6,
          shaftHeight: 50,
          crank: { ...CRANK },
          cams: [liftCam(motion, 0.5)],
          pushrods: [
            {
              id: 'rod-main',
              camId: `cam-${motion}`,
              rodWidth: 6,
              padWidth: motion === 'drop' ? 8 : 22,
              // short rod: the figure rides low, just clearing the scenery
              length: 46,
            },
          ],
          rockers: [],
          spinners: [],
        },
        characters: [figure('rod-main')],
        ...withProps,
        export: { ...DEFAULT_EXPORT },
      }
    case 'nod':
      return {
        name,
        frame: { width: 140, depth: 90, height: 100, materialThickness: 3 },
        mechanism: {
          shaftDiameter: 6,
          shaftHeight: 45,
          crank: { ...CRANK },
          cams: [
            {
              id: 'cam-nod',
              kind: 'eccentric',
              radius: 16,
              eccentricity: 6,
              position: 0.5,
              phaseDeg: 0,
              thickness: 6,
            },
          ],
          pushrods: [],
          rockers: [{ id: 'rock-main', camId: 'cam-nod', leverLength: 30, padWidth: 14 }],
          spinners: [],
        },
        characters: [figure('rock-main')],
        ...withProps,
        export: { ...DEFAULT_EXPORT },
      }
    case 'spin':
      return {
        name,
        frame: { width: 140, depth: 90, height: 100, materialThickness: 3 },
        mechanism: {
          shaftDiameter: 6,
          shaftHeight: 45,
          crank: { ...CRANK },
          cams: [],
          pushrods: [],
          rockers: [],
          spinners: [
            { id: 'spin-main', position: 0.5, ratio: 1, wheelRadius: 14, platformRadius: 28 },
          ],
        },
        characters: [figure('spin-main')],
        ...withProps,
        export: { ...DEFAULT_EXPORT },
      }
    case 'swoop':
      return {
        name,
        frame: { width: 150, depth: 100, height: 110, materialThickness: 3 },
        mechanism: {
          shaftDiameter: 6,
          shaftHeight: 45,
          crank: { ...CRANK },
          cams: [],
          pushrods: [],
          rockers: [],
          spinners: [],
          linkages: [
            {
              id: 'link-main',
              position: 0.5,
              crankRadius: 8,
              couplerLen: 34,
              rockerLen: 34,
              groundLen: 36,
              couplerExt: 8,
              wandLen: 58,
              phaseDeg: 0,
            },
          ],
        },
        characters: [figure('link-main')],
        ...withProps,
        export: { ...DEFAULT_EXPORT },
      }
  }
}

const MOTION_ADJECTIVE: Record<MotionId, string> = {
  bob: 'Bobbing',
  bounce: 'Bouncing',
  drop: 'Leaping',
  nod: 'Rocking',
  spin: 'Spinning',
  swoop: 'Swooping',
}
