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

export const templates: Record<string, AutomatonSpec> = {
  simplest: simplestAutomaton,
}
