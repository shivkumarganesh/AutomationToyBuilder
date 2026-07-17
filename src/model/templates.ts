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
      kind: 'block',
      width: 18,
      height: 24,
      depth: 14,
      color: '#4fb06a',
      label: 'Nodding Bird',
    },
    {
      id: 'figure-dancer',
      channelId: 'spin-stage',
      kind: 'block',
      width: 14,
      height: 22,
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

export const templates: Record<string, AutomatonSpec> = {
  simplest: simplestAutomaton,
  woodpecker: snailWoodpecker,
  nodspin: nodAndSpin,
  hummingbird: gearedHummingbird,
}
