import type { AutomatonSpec } from './types'

/**
 * Toy template registry. Each template is pure data — adding a new toy to
 * the designer means adding an entry here (plus, if it introduces a new
 * mechanism, a profile function in kinematics/).
 */

/**
 * The Simplest Automaton — the foundational template: a hand crank turning
 * a straight camshaft with one eccentric cam and one petal cam, driving two
 * vertical pushrods through stage guide slots, each carrying a plain figure
 * block. Translates manual rotation into linear vertical movement.
 */
export const simplestAutomaton: AutomatonSpec = {
  name: 'Simplest Automaton',
  frame: {
    width: 160,
    depth: 80,
    height: 100,
    materialThickness: 3,
  },
  mechanism: {
    shaftDiameter: 6,
    shaftHeight: 50,
    crank: {
      armLength: 25,
      handleLength: 30,
      handleDiameter: 10,
    },
    cams: [
      {
        id: 'cam-eccentric',
        kind: 'eccentric',
        radius: 20,
        eccentricity: 8,
        position: 0.3,
        phaseDeg: 0,
        thickness: 6,
      },
      {
        id: 'cam-petal',
        kind: 'petal',
        baseRadius: 16,
        lift: 8,
        lobes: 4,
        position: 0.7,
        phaseDeg: 90,
        thickness: 6,
      },
    ],
    pushrods: [
      { id: 'rod-a', camId: 'cam-eccentric', rodWidth: 6, padWidth: 24, length: 60 },
      { id: 'rod-b', camId: 'cam-petal', rodWidth: 6, padWidth: 20, length: 60 },
    ],
    rockers: [],
    spinners: [],
  },
  characters: [
    {
      id: 'figure-a',
      channelId: 'rod-a',
      kind: 'block',
      width: 20,
      height: 26,
      depth: 16,
      color: '#e07a4f',
      label: 'Figure A',
    },
    {
      id: 'figure-b',
      channelId: 'rod-b',
      kind: 'block',
      width: 20,
      height: 26,
      depth: 16,
      color: '#4f8fe0',
      label: 'Figure B',
    },
  ],
  export: {
    kerf: 0.1,
    fdmClearance: 0.2,
  },
}

/**
 * The Snail Cam Woodpecker — the second toy. A snail cam winds the
 * woodpecker slowly upward and drops it off the step once per revolution:
 * the classic pecking motion. A small eccentric cam bobs a chick beside it
 * for contrast. The follower pad on the pecker rod is deliberately narrow
 * so the drop stays sharp instead of riding the step corner.
 */
export const snailWoodpecker: AutomatonSpec = {
  name: 'Snail Cam Woodpecker',
  frame: {
    width: 160,
    depth: 80,
    height: 100,
    materialThickness: 3,
  },
  mechanism: {
    shaftDiameter: 6,
    shaftHeight: 50,
    crank: {
      armLength: 25,
      handleLength: 30,
      handleDiameter: 10,
    },
    cams: [
      {
        id: 'cam-snail',
        kind: 'snail',
        baseRadius: 14,
        lift: 12,
        position: 0.35,
        phaseDeg: 0,
        thickness: 6,
      },
      {
        id: 'cam-bob',
        kind: 'eccentric',
        radius: 16,
        eccentricity: 5,
        position: 0.72,
        phaseDeg: 90,
        thickness: 6,
      },
    ],
    pushrods: [
      { id: 'rod-pecker', camId: 'cam-snail', rodWidth: 6, padWidth: 8, length: 60 },
      { id: 'rod-chick', camId: 'cam-bob', rodWidth: 6, padWidth: 20, length: 60 },
    ],
    rockers: [],
    spinners: [],
  },
  characters: [
    {
      id: 'figure-pecker',
      channelId: 'rod-pecker',
      kind: 'block',
      width: 18,
      height: 30,
      depth: 16,
      color: '#c93a2e',
      label: 'Woodpecker',
    },
    {
      id: 'figure-chick',
      channelId: 'rod-chick',
      kind: 'block',
      width: 16,
      height: 20,
      depth: 14,
      color: '#e0b64f',
      label: 'Chick',
    },
  ],
  export: {
    kerf: 0.1,
    fdmClearance: 0.2,
  },
}

/**
 * Nod & Spin Carousel — the third toy, showing the non-lift output
 * channels: a cam-driven rocker makes a bird nod (tilt channel) while a
 * friction wheel on the same shaft spins a carousel platform with a
 * dancer riding it (spin channel).
 */
export const nodAndSpin: AutomatonSpec = {
  name: 'Nod & Spin Carousel',
  frame: {
    width: 180,
    depth: 90,
    height: 100,
    materialThickness: 3,
  },
  mechanism: {
    shaftDiameter: 6,
    shaftHeight: 45,
    crank: {
      armLength: 25,
      handleLength: 30,
      handleDiameter: 10,
    },
    cams: [
      {
        id: 'cam-nod',
        kind: 'eccentric',
        radius: 16,
        eccentricity: 6,
        position: 0.25,
        phaseDeg: 0,
        thickness: 6,
      },
    ],
    pushrods: [],
    rockers: [{ id: 'rock-nod', camId: 'cam-nod', leverLength: 30, padWidth: 14 }],
    spinners: [
      { id: 'spin-stage', position: 0.68, ratio: 1, wheelRadius: 14, platformRadius: 28 },
    ],
  },
  characters: [
    {
      id: 'figure-nodder',
      channelId: 'rock-nod',
      kind: 'silhouette',
      shape: 'bird',
      width: 40,
      height: 31,
      depth: 14,
      color: '#4fb06a',
      label: 'Nodding Bird',
    },
    {
      id: 'figure-dancer',
      channelId: 'spin-stage',
      kind: 'silhouette',
      shape: 'dancer',
      width: 34,
      height: 42,
      depth: 12,
      color: '#8a6fe8',
      label: 'Dancer',
    },
  ],
  export: {
    kerf: 0.1,
    fdmClearance: 0.2,
  },
}

/**
 * Geared Hummingbird — the fourth toy, showing the gear train: a 2:1
 * speed-up gear pair drives a layshaft carrying a small petal cam, so the
 * bee flutters twelve times per crank turn while the flower bobs slowly
 * on the crankshaft.
 */
export const gearedHummingbird: AutomatonSpec = {
  name: 'Geared Hummingbird',
  frame: {
    width: 160,
    depth: 80,
    height: 110,
    materialThickness: 3,
  },
  mechanism: {
    shaftDiameter: 6,
    shaftHeight: 60,
    crank: {
      armLength: 25,
      handleLength: 30,
      handleDiameter: 10,
    },
    gearTrain: { teethDrive: 24, teethDriven: 12, module: 1.5, position: 0.45 },
    cams: [
      {
        id: 'cam-bob',
        kind: 'eccentric',
        radius: 18,
        eccentricity: 7,
        position: 0.22,
        phaseDeg: 0,
        thickness: 6,
        shaft: 'crank',
      },
      {
        id: 'cam-flutter',
        kind: 'petal',
        baseRadius: 12,
        lift: 5,
        lobes: 6,
        position: 0.7,
        phaseDeg: 0,
        thickness: 6,
        shaft: 'lay',
      },
    ],
    pushrods: [
      { id: 'rod-flower', camId: 'cam-bob', rodWidth: 6, padWidth: 22, length: 60 },
      { id: 'rod-bee', camId: 'cam-flutter', rodWidth: 6, padWidth: 8, length: 92 },
    ],
    rockers: [],
    spinners: [],
  },
  characters: [
    {
      id: 'figure-flower',
      channelId: 'rod-flower',
      kind: 'block',
      width: 20,
      height: 24,
      depth: 16,
      color: '#c94f8e',
      label: 'Flower',
    },
    {
      id: 'figure-bee',
      channelId: 'rod-bee',
      kind: 'block',
      width: 14,
      height: 16,
      depth: 12,
      color: '#e0b64f',
      label: 'Bee',
    },
  ],
  export: {
    kerf: 0.1,
    fdmClearance: 0.2,
  },
}

/**
 * Bevel Gear Carousel — the fifth toy: a crown gear on the camshaft
 * meshes a small pinion at the base of the vertical spindle (90° positive
 * drive, ratio = crown/pinion teeth = 3), spinning the carousel three
 * turns per crank revolution while a rocker nods the ticket bear beside it.
 */
export const bevelCarousel: AutomatonSpec = {
  name: 'Bevel Gear Carousel',
  frame: {
    width: 180,
    depth: 90,
    height: 100,
    materialThickness: 3,
  },
  mechanism: {
    shaftDiameter: 6,
    shaftHeight: 45,
    crank: {
      armLength: 25,
      handleLength: 30,
      handleDiameter: 10,
    },
    cams: [
      {
        id: 'cam-nod',
        kind: 'eccentric',
        radius: 16,
        eccentricity: 5,
        position: 0.22,
        phaseDeg: 0,
        thickness: 6,
      },
    ],
    pushrods: [],
    rockers: [{ id: 'rock-bear', camId: 'cam-nod', leverLength: 30, padWidth: 14 }],
    spinners: [
      {
        id: 'spin-carousel',
        position: 0.66,
        ratio: 1,
        wheelRadius: 14,
        platformRadius: 30,
        drive: 'bevel',
        // 16:8 at module 2.25 — teeth and tooth tabs wide enough to cut
        // from 3 mm basswood (tab ≥ 3 mm, pinion wall ≥ 2 mm)
        crownTeeth: 16,
        pinionTeeth: 8,
        module: 2.25,
      },
    ],
  },
  characters: [
    {
      id: 'figure-bear',
      channelId: 'rock-bear',
      kind: 'block',
      width: 18,
      height: 24,
      depth: 14,
      color: '#8a6248',
      label: 'Ticket Bear',
    },
    {
      id: 'figure-horse',
      channelId: 'spin-carousel',
      kind: 'block',
      width: 14,
      height: 20,
      depth: 12,
      color: '#4f8fe0',
      label: 'Carousel Horse',
    },
  ],
  export: {
    kerf: 0.1,
    fdmClearance: 0.2,
  },
}

/**
 * Stepping Owl — the sixth toy, showing the Geneva drive: a pin on the
 * camshaft indexes a six-slot star wheel, so the owl snaps its gaze
 * around in crisp 60° steps (dwell — step — dwell) while a petal cam
 * bounces the mouse it never quite catches.
 */
export const steppingOwl: AutomatonSpec = {
  name: 'Stepping Owl',
  frame: {
    width: 170,
    depth: 85,
    height: 100,
    materialThickness: 3,
  },
  mechanism: {
    shaftDiameter: 6,
    shaftHeight: 45,
    crank: {
      armLength: 25,
      handleLength: 30,
      handleDiameter: 10,
    },
    cams: [
      {
        id: 'cam-scurry',
        kind: 'petal',
        baseRadius: 14,
        lift: 6,
        lobes: 3,
        position: 0.2,
        phaseDeg: 0,
        thickness: 6,
      },
    ],
    pushrods: [
      { id: 'rod-mouse', camId: 'cam-scurry', rodWidth: 6, padWidth: 12, length: 62 },
    ],
    rockers: [],
    spinners: [
      {
        id: 'spin-owl',
        position: 0.62,
        ratio: 1,
        wheelRadius: 16,
        platformRadius: 24,
        drive: 'geneva',
        stations: 6,
      },
    ],
  },
  characters: [
    {
      id: 'figure-owl',
      channelId: 'spin-owl',
      kind: 'block',
      width: 18,
      height: 26,
      depth: 15,
      color: '#8a6248',
      label: 'Owl',
    },
    {
      id: 'figure-mouse',
      channelId: 'rod-mouse',
      kind: 'block',
      width: 12,
      height: 12,
      depth: 10,
      color: '#9aa3b2',
      label: 'Mouse',
    },
  ],
  export: {
    kerf: 0.1,
    fdmClearance: 0.2,
  },
}

/**
 * Flapping Bird — the seventh toy, introducing ARTICULATED characters:
 * the figure itself stays fixed on its stand while pivot-jointed limbs
 * move. An eccentric cam's pushrod drives a wire yoke that flaps both
 * wings and nods the head (asin(d / crankArm) joints, mirrored shoulders),
 * while a petal cam wags the tail three times per crank turn through a
 * bent overhead wire crank.
 */
export const flappingBird: AutomatonSpec = {
  name: 'Flapping Bird',
  frame: {
    width: 170,
    depth: 85,
    height: 105,
    materialThickness: 3,
  },
  mechanism: {
    shaftDiameter: 6,
    shaftHeight: 48,
    crank: {
      armLength: 25,
      handleLength: 30,
      handleDiameter: 10,
    },
    cams: [
      {
        id: 'cam-flap',
        kind: 'eccentric',
        radius: 18,
        eccentricity: 7,
        position: 0.42,
        phaseDeg: 0,
        thickness: 6,
      },
      {
        id: 'cam-wag',
        kind: 'petal',
        baseRadius: 14,
        lift: 6,
        lobes: 3,
        position: 0.58,
        phaseDeg: 60,
        thickness: 6,
      },
    ],
    pushrods: [
      { id: 'rod-flap', camId: 'cam-flap', rodWidth: 6, padWidth: 24, length: 62 },
      // short on purpose: the wag rod's top must stay BELOW the wings'
      // lowest sweep — the tail wire sets back behind the flapping plane
      // from here (clearance pinned by the wing-sweep test)
      { id: 'rod-wag', camId: 'cam-wag', rodWidth: 6, padWidth: 12, length: 40 },
    ],
    rockers: [],
    spinners: [],
  },
  characters: [
    {
      id: 'figure-bird',
      channelId: 'rod-flap',
      kind: 'articulated',
      width: 20,
      height: 28,
      depth: 16,
      color: '#4f8fe0',
      label: 'Bird',
      limbs: [
        {
          id: 'limb-wings',
          channelId: 'rod-flap',
          kind: 'wings',
          length: 34,
          width: 12,
          crankArm: 10,
        },
        {
          id: 'limb-head',
          channelId: 'rod-flap',
          kind: 'head',
          length: 12,
          width: 10,
          crankArm: 12,
        },
        {
          id: 'limb-tail',
          channelId: 'rod-wag',
          kind: 'tail',
          length: 18,
          width: 9,
          crankArm: 6,
        },
      ],
    },
  ],
  export: {
    kerf: 0.1,
    fdmClearance: 0.2,
  },
}

/**
 * Soaring Gull — the eighth toy, introducing FOUR-BAR LINKAGES: a
 * crank-rocker below the stage swoops a gull along a closed coupler
 * curve, diving and climbing with real pitch, while a petal cam rolls a
 * wave beneath it. The path channel is the first output that moves a
 * figure in TWO directions at once.
 */
export const soaringGull: AutomatonSpec = {
  name: 'Soaring Gull',
  frame: {
    width: 180,
    depth: 100,
    height: 110,
    materialThickness: 3,
  },
  mechanism: {
    shaftDiameter: 6,
    shaftHeight: 45,
    crank: {
      armLength: 25,
      handleLength: 30,
      handleDiameter: 10,
    },
    cams: [
      {
        id: 'cam-wave',
        kind: 'petal',
        baseRadius: 15,
        lift: 6,
        lobes: 2,
        position: 0.75,
        phaseDeg: 0,
        thickness: 6,
      },
    ],
    pushrods: [
      { id: 'rod-wave', camId: 'cam-wave', rodWidth: 6, padWidth: 20, length: 60 },
    ],
    rockers: [],
    spinners: [],
    linkages: [
      {
        id: 'link-glide',
        position: 0.35,
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
  characters: [
    {
      id: 'figure-gull',
      channelId: 'link-glide',
      kind: 'block',
      width: 18,
      height: 14,
      depth: 26,
      color: '#e6e9ee',
      label: 'Gull',
    },
    {
      id: 'figure-wave',
      channelId: 'rod-wave',
      kind: 'block',
      width: 26,
      height: 12,
      depth: 18,
      color: '#4fa9c9',
      label: 'Wave',
    },
  ],
  export: {
    kerf: 0.1,
    fdmClearance: 0.2,
  },
}

const CRANK = { armLength: 25, handleLength: 30, handleDiameter: 10 }

/** A plain eccentric cam + pushrod pair for a wing plate or body segment. */
function wingDrive(
  id: string,
  position: number,
  eccentricity: number,
  phaseDeg: number,
  length: number,
  radius = 18,
) {
  return {
    cam: {
      id: `cam-${id}`,
      kind: 'eccentric' as const,
      radius,
      eccentricity,
      position,
      phaseDeg,
      thickness: 6,
    },
    rod: { id: `rod-${id}`, camId: `cam-${id}`, rodWidth: 6, padWidth: 16, length },
  }
}

/**
 * Flying Bird — the classic first articulated automaton: the body sits
 * still on a post while two pushrods lift its hinged wings together.
 * Rod positions are 31 mm either side of centre: 9 mm to the hinge
 * (half the body + half the hinge gap) plus a 22 mm lever arm.
 */
export const flyingBird: AutomatonSpec = (() => {
  const inner = 160 - 6
  const drives = [
    wingDrive('wing-l', 0.5 - 31 / inner, 6, 0, 95),
    wingDrive('wing-r', 0.5 + 31 / inner, 6, 0, 95),
  ]
  return {
    name: 'Flying Bird',
    frame: { width: 160, depth: 80, height: 100, materialThickness: 3 },
    mechanism: {
      shaftDiameter: 6,
      shaftHeight: 50,
      crank: { ...CRANK },
      cams: drives.map((d) => d.cam),
      pushrods: drives.map((d) => d.rod),
      rockers: [],
      spinners: [],
    },
    characters: [
      {
        id: 'figure-bird',
        channelId: 'rod-wing-l',
        kind: 'flyer',
        shape: 'bird',
        width: 16,
        height: 24,
        depth: 68,
        color: '#e0a54f',
        label: 'Bird',
        flyer: { left: ['rod-wing-l'], right: ['rod-wing-r'] },
      },
    ],
    props: [
      {
        id: 'prop-hills',
        shape: 'hills',
        position: 0.5,
        row: 'back',
        width: 120,
        height: 30,
        color: '#6f9a5a',
      },
    ],
    export: { kerf: 0.1, fdmClearance: 0.2 },
  }
})()

/**
 * Manta Ray — two plates per wing, four rods. The outer cams trail the
 * inner ones by 50°, so a wave rolls out along each wing. Hinge at
 * ±12 mm; rods at ±30 mm and ±56 mm (lever arms 18 and 44 mm), the
 * mid-wing hinge derived halfway between them.
 */
export const mantaRay: AutomatonSpec = (() => {
  const inner = 180 - 6
  const drives = [
    wingDrive('l-outer', 0.5 - 56 / inner, 8, 50, 95),
    wingDrive('l-inner', 0.5 - 30 / inner, 4, 0, 95),
    wingDrive('r-inner', 0.5 + 30 / inner, 4, 0, 95),
    wingDrive('r-outer', 0.5 + 56 / inner, 8, 50, 95),
  ]
  return {
    name: 'Manta Ray',
    frame: { width: 180, depth: 90, height: 100, materialThickness: 3 },
    mechanism: {
      shaftDiameter: 6,
      shaftHeight: 50,
      crank: { ...CRANK },
      cams: drives.map((d) => d.cam),
      pushrods: drives.map((d) => d.rod),
      rockers: [],
      spinners: [],
    },
    characters: [
      {
        id: 'figure-manta',
        channelId: 'rod-l-inner',
        kind: 'flyer',
        shape: 'manta',
        width: 22,
        height: 16,
        depth: 74,
        color: '#c8793a',
        label: 'Manta ray',
        flyer: { left: ['rod-l-inner', 'rod-l-outer'], right: ['rod-r-inner', 'rod-r-outer'] },
      },
    ],
    props: [
      {
        id: 'prop-waves',
        shape: 'waves',
        position: 0.5,
        row: 'front',
        width: 120,
        height: 14,
        color: '#4fa9c9',
      },
    ],
    export: { kerf: 0.1, fdmClearance: 0.2 },
  }
})()

/**
 * Dragon — bat wings in two plates each on four rods, beating with a
 * 40° lag between wrist and shoulder. Hinge at ±8 mm; rods at ±28 mm
 * and ±54 mm.
 */
export const dragon: AutomatonSpec = (() => {
  const inner = 180 - 6
  const drives = [
    wingDrive('l-outer', 0.5 - 54 / inner, 9, 40, 100),
    wingDrive('l-inner', 0.5 - 28 / inner, 5, 0, 100),
    wingDrive('r-inner', 0.5 + 28 / inner, 5, 0, 100),
    wingDrive('r-outer', 0.5 + 54 / inner, 9, 40, 100),
  ]
  return {
    name: 'Dragon',
    frame: { width: 180, depth: 90, height: 100, materialThickness: 3 },
    mechanism: {
      shaftDiameter: 6,
      shaftHeight: 50,
      crank: { ...CRANK },
      cams: drives.map((d) => d.cam),
      pushrods: drives.map((d) => d.rod),
      rockers: [],
      spinners: [],
    },
    characters: [
      {
        id: 'figure-dragon',
        channelId: 'rod-l-inner',
        kind: 'flyer',
        shape: 'dragon',
        width: 14,
        height: 14,
        depth: 112,
        color: '#a8623a',
        label: 'Dragon',
        flyer: { left: ['rod-l-inner', 'rod-l-outer'], right: ['rod-r-inner', 'rod-r-outer'] },
      },
    ],
    export: { kerf: 0.1, fdmClearance: 0.2 },
  }
})()

/**
 * Swimming Fish — the body is cut into four segments, each on its own
 * pushrod; every cam trails the one ahead by 60°, so a wave travels
 * from head to tail. Rod positions follow each segment's mounting stem.
 */
export const swimmingFish: AutomatonSpec = (() => {
  const inner = 160 - 6
  const at = (x: number) => 0.5 + x / inner
  const segments = [
    { id: 'tail', shape: 'fish-tail', x: -27, phase: 180, w: 24, h: 37, label: 'Fish tail' },
    { id: 'rear', shape: 'fish-rear', x: -10, phase: 120, w: 18, h: 37, label: 'Fish body (rear)' },
    { id: 'front', shape: 'fish-front', x: 10, phase: 60, w: 18, h: 43, label: 'Fish body (front)' },
    { id: 'head', shape: 'fish-head', x: 30, phase: 0, w: 20, h: 36, label: 'Fish head' },
  ]
  const drives = segments.map((sg) => wingDrive(sg.id, at(sg.x), 4, sg.phase, 42, 16))
  return {
    name: 'Swimming Fish',
    frame: { width: 160, depth: 80, height: 100, materialThickness: 3 },
    mechanism: {
      shaftDiameter: 6,
      shaftHeight: 50,
      crank: { ...CRANK },
      cams: drives.map((d) => d.cam),
      pushrods: drives.map((d) => d.rod),
      rockers: [],
      spinners: [],
    },
    characters: segments.map((sg) => ({
      id: `figure-${sg.id}`,
      channelId: `rod-${sg.id}`,
      kind: 'silhouette' as const,
      shape: sg.shape,
      width: sg.w,
      height: sg.h,
      depth: 14,
      color: '#e0764f',
      label: sg.label,
    })),
    props: [
      {
        id: 'prop-waves',
        shape: 'waves',
        position: 0.5,
        row: 'front',
        width: 110,
        height: 14,
        color: '#4fa9c9',
      },
    ],
    export: { kerf: 0.1, fdmClearance: 0.2 },
  }
})()

export const templates: Record<string, AutomatonSpec> = {
  simplest: simplestAutomaton,
  woodpecker: snailWoodpecker,
  nodspin: nodAndSpin,
  hummingbird: gearedHummingbird,
  carousel: bevelCarousel,
  owl: steppingOwl,
  bird: flappingBird,
  gull: soaringGull,
  flyingbird: flyingBird,
  manta: mantaRay,
  dragon,
  fish: swimmingFish,
}
