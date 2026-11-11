import type { AutomatonSpec, CamSpec, CharacterSpec, PropSpec } from './types'
import { CUSTOM_SHAPE, FIGURE_SHAPES, type Point2 } from './figures'
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

export type SceneId = 'none' | 'sea' | 'meadow' | 'sky' | 'winter'

export const SCENES: Record<SceneId, { label: string }> = {
  none: { label: 'No scenery' },
  sea: { label: 'Sea' },
  meadow: { label: 'Meadow' },
  sky: { label: 'Sky' },
  winter: { label: 'Christmas' },
}

export interface FigureInfo {
  /** One line for the gallery card. */
  blurb: string
  /** Motions that suit this figure, best first. */
  motions: MotionId[]
  scene: SceneId
  color: string
  /** Depth levels a new toy with this figure starts with (0 = flat). */
  relief?: number
}

export const FIGURE_INFO: Record<string, FigureInfo> = {
  whale: {
    blurb: 'A gentle giant rolling through the swell.',
    motions: ['bob', 'swoop', 'nod'],
    scene: 'sea',
    color: '#4f7fc9',
    relief: 2,
  },
  dolphin: {
    blurb: 'Leaps out of the waves and dives back in.',
    motions: ['swoop', 'bounce', 'bob'],
    scene: 'sea',
    color: '#5aa0c8',
    relief: 2,
  },
  fish: {
    blurb: 'Darts and wiggles between the waves.',
    motions: ['bounce', 'bob', 'swoop'],
    scene: 'sea',
    color: '#e0764f',
    relief: 2,
  },
  ray: {
    blurb: 'Glides like a kite under water.',
    motions: ['swoop', 'bob', 'spin'],
    scene: 'sea',
    color: '#8a6fe8',
    relief: 2,
  },
  sailboat: {
    blurb: 'Pitches and rolls on a choppy sea.',
    motions: ['nod', 'bob', 'swoop'],
    scene: 'sea',
    color: '#e6e9ee',
    relief: 1,
  },
  bird: {
    blurb: 'Pecks at the ground or hops about.',
    motions: ['nod', 'drop', 'bounce'],
    scene: 'meadow',
    color: '#4fb06a',
    relief: 1,
  },
  butterfly: {
    blurb: 'Flutters over the grass.',
    motions: ['bounce', 'swoop', 'spin'],
    scene: 'meadow',
    color: '#e0a54f',
    relief: 1,
  },
  cat: {
    blurb: 'Watches, waits… and pounces.',
    motions: ['drop', 'nod', 'spin'],
    scene: 'meadow',
    color: '#3c3f47',
    relief: 1,
  },
  dancer: {
    blurb: 'A ballerina turning on her toes.',
    motions: ['spin', 'bob', 'bounce'],
    scene: 'none',
    color: '#c94f8e',
  },
  custom: {
    blurb: 'Your own drawing or picture.',
    motions: ['bob', 'bounce', 'spin'],
    scene: 'none',
    color: '#e0a54f',
    relief: 1,
  },
  reindeer: {
    blurb: 'Gallops through the snow, antlers high.',
    motions: ['bounce', 'bob', 'drop'],
    scene: 'winter',
    color: '#a9713f',
    relief: 1,
  },
  prancer: {
    blurb: 'Leaps in a bow and bell — built up in layers from a line drawing.',
    motions: ['bounce', 'bob', 'drop'],
    scene: 'winter',
    color: '#b07a45',
  },
  snowman: {
    blurb: 'Bobs about in his scarf and top hat.',
    motions: ['bob', 'spin', 'bounce'],
    scene: 'winter',
    color: '#f2f5f9',
    relief: 2,
  },
  xmastree: {
    blurb: 'Turns slowly to show off every bauble.',
    motions: ['spin', 'bob', 'bounce'],
    scene: 'winter',
    color: '#2f8f5a',
    relief: 1,
  },
  sleigh: {
    blurb: 'Rides the drifts, loaded for the big night.',
    motions: ['bob', 'nod', 'bounce'],
    scene: 'winter',
    color: '#c93a2e',
    relief: 1,
  },
  rocket: {
    blurb: 'Climbs through the clouds, falls back, tries again.',
    motions: ['drop', 'bob', 'spin'],
    scene: 'sky',
    color: '#c93a2e',
    relief: 1,
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
  reindeer: {
    blurb: 'One reindeer, one cam, three hops a turn. The easiest Christmas build.',
    tags: ['1 cam', 'Christmas'],
    difficulty: 1,
  },
  sleighride: {
    blurb: 'Two reindeer gallop out of step ahead of a bobbing sleigh.',
    tags: ['3 cams', 'Christmas'],
    difficulty: 1,
  },
  winterfriends: {
    blurb: 'A snowman and a Christmas tree take turns bobbing outside a snowy cabin.',
    tags: ['2 cams', 'Christmas'],
    difficulty: 1,
  },
  seaside: {
    blurb: 'A whale, a fish and a sailboat rise and fall like one long wave.',
    tags: ['3 cams', 'sea'],
    difficulty: 1,
  },
}

/** The easiest builds: nothing but cams and pushrods on one straight shaft. */
export const SIMPLE_TEMPLATES = ['reindeer', 'sleighride', 'winterfriends', 'seaside']

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
    case 'winter':
      return [
        make('prop-snow', 'snowdrift', 0.5),
        make('prop-pine-1', 'pine', 0.13),
        make('prop-pine-2', 'pine', 0.88, 0.8),
      ]
    case 'none':
      return []
  }
}

/** One member of a scene's cast: a library figure and how it moves. */
export interface CastMember {
  shape: string
  /** Only the three motions that need nothing but a cam and a rod. */
  motion: 'bob' | 'bounce' | 'drop'
  /** When in the turn it moves, degrees; defaults to an even stagger along the row. */
  phaseDeg?: number
  /** Size relative to the library default. */
  scale?: number
}

/** Clear stage either side of each figure, mm. */
const CAST_GAP = 10
/** Widest toy the composer lays out: its stage still fits the 300 mm sheet. */
export const MAX_SCENE_WIDTH = 280
export const MAX_CAST = 5

/**
 * Compose a whole SCENE from a cast list: every figure gets its own cam
 * and pushrod on ONE straight shaft — the simplest mechanism there is —
 * spaced so neighbours never touch, in a box grown to fit them, with
 * scenery in front and behind. Figures are staggered round the turn so
 * a row of them moves like a wave.
 */
export function composeScene(name: string, cast: CastMember[], scene: SceneId = 'none'): AutomatonSpec {
  if (cast.length < 1 || cast.length > MAX_CAST) throw new Error(`a scene has 1 to ${MAX_CAST} figures`)
  const t = 3
  const sized = cast.map((m) => {
    const shape = FIGURE_SHAPES[m.shape]
    if (!shape) throw new Error(`unknown figure shape ${m.shape}`)
    const k = m.scale ?? 1
    return { m, shape, width: Math.round(shape.defaultWidth * k), height: Math.round(shape.defaultHeight * k) }
  })
  // every figure gets a slot at least as wide as its cam's follower pad
  const slots = sized.map((f) => Math.max(f.width, 30) + CAST_GAP)
  const inner = Math.max(140 - 2 * t, slots.reduce((a, b) => a + b, 0) + CAST_GAP)
  const width = inner + 2 * t
  if (width > MAX_SCENE_WIDTH) throw new Error('this cast is too wide for one sheet: use fewer or smaller figures')
  const spare = (inner - slots.reduce((a, b) => a + b, 0)) / slots.length
  let x = 0
  const used = new Map<string, number>()
  const units = sized.map((f, i) => {
    const slot = slots[i] + spare
    const position = Math.round(((x + slot / 2) / inner) * 1000) / 1000
    x += slot
    const n = (used.get(f.m.shape) ?? 0) + 1
    used.set(f.m.shape, n)
    const id = `${f.m.shape}-${n}`
    const cam: CamSpec = {
      ...liftCam(f.m.motion, position),
      id: `cam-${id}`,
      phaseDeg: f.m.phaseDeg ?? Math.round((360 / sized.length) * i),
    }
    const info = FIGURE_INFO[f.m.shape]
    const character: CharacterSpec = {
      id: `figure-${id}`,
      channelId: `rod-${id}`,
      kind: 'silhouette',
      shape: f.m.shape,
      width: f.width,
      height: f.height,
      depth: 14,
      color: info?.color ?? '#e0a54f',
      label: n > 1 ? `${f.shape.label} ${n}` : f.shape.label,
      ...(info?.relief ? { relief: info.relief } : {}),
    }
    return {
      cam,
      rod: { id: `rod-${id}`, camId: cam.id, rodWidth: 6, padWidth: f.m.motion === 'drop' ? 8 : 22, length: 46 },
      character,
    }
  })
  const props = sceneProps(scene).map((p) => ({ ...p, width: Math.min(Math.round(p.width * Math.max(1, width / 160)), width - 20) }))
  return {
    name,
    frame: { width, depth: 80, height: 100, materialThickness: t },
    mechanism: {
      shaftDiameter: 6,
      shaftHeight: 50,
      crank: { ...CRANK },
      cams: units.map((u) => u.cam),
      pushrods: units.map((u) => u.rod),
      rockers: [],
      spinners: [],
    },
    characters: units.map((u) => u.character),
    ...(props.length > 0 ? { props } : {}),
    export: { ...DEFAULT_EXPORT },
  }
}

/**
 * Compose a complete one-figure toy: the library figure `shapeId`
 * driven by `motion`, centred in a box sized for that mechanism, with
 * the figure's natural scenery around it.
 */
export function composeToy(
  shapeId: string,
  motion: MotionId,
  /** For shapeId 'custom': the user's own traced figure. */
  custom?: { outline: Point2[]; width: number; height: number; label?: string },
): AutomatonSpec {
  const shape =
    shapeId === CUSTOM_SHAPE && custom
      ? { label: custom.label ?? 'My figure', defaultWidth: custom.width, defaultHeight: custom.height }
      : FIGURE_SHAPES[shapeId]
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
    color: info?.color ?? '#e0a54f',
    label: shape.label,
    ...(shapeId === CUSTOM_SHAPE && custom ? { outline: custom.outline } : {}),
    ...(info?.relief ? { relief: info.relief } : {}),
  })
  const name =
    shapeId === CUSTOM_SHAPE
      ? `My ${MOTION_ADJECTIVE[motion].toLowerCase()} figure`
      : `${MOTION_ADJECTIVE[motion]} ${shape.label}`
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
