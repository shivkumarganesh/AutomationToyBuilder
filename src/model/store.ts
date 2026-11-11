import { create } from 'zustand'
import type {
  AutomatonSpec,
  CamSpec,
  CharacterSpec,
  ExportSettings,
  FrameSpec,
  GearTrainSpec,
  LimbSpec,
  LinkageSpec,
  MechanismSpec,
  PropSpec,
  PushrodSpec,
  RockerSpec,
  SpinnerSpec,
} from './types'
import { DEFAULT_FIGURE_SHAPE, FIGURE_SHAPES } from './figures'
import { MAX_PROPS, PROP_SHAPES } from './props'
import { FIGURE_INFO, type MotionId } from './catalog'
import { loadInitialSpec, saveToLocalStorage } from './persistence'

interface DesignerState {
  spec: AutomatonSpec
  /** Current crank angle in radians. */
  crankAngle: number
  /** Whether the "Turn Crank" animation is running. */
  isCranking: boolean
  /** Crank speed in revolutions per second. */
  crankSpeed: number
  /** Render box walls semi-transparent to reveal the mechanism. */
  seeThrough: boolean
  /** Figure ids rendered x-ray (translucent body revealing the linkage). */
  xrayFigures: string[]

  setCrankAngle: (angle: number) => void
  /** Toggle a figure between solid and x-ray (click on the figure). */
  toggleFigureXray: (id: string) => void
  advanceCrank: (deltaSeconds: number) => void
  setCranking: (on: boolean) => void
  setCrankSpeed: (revPerSec: number) => void
  setSeeThrough: (on: boolean) => void

  updateFrame: (patch: Partial<FrameSpec>) => void
  updateMechanism: (patch: Partial<Omit<MechanismSpec, 'cams' | 'pushrods'>>) => void
  updateCam: (id: string, patch: Partial<CamSpec>) => void
  updatePushrod: (id: string, patch: Partial<PushrodSpec>) => void
  updateRocker: (id: string, patch: Partial<RockerSpec>) => void
  updateSpinner: (id: string, patch: Partial<SpinnerSpec>) => void
  updateCharacter: (id: string, patch: Partial<CharacterSpec>) => void
  updateExport: (patch: Partial<ExportSettings>) => void
  loadTemplate: (spec: AutomatonSpec) => void

  /** Add a complete lift unit: cam + pushrod + figure riding it. */
  addCam: () => void
  /** Add a complete tilt unit: cam + rocker lever + nodding figure. */
  addRocker: () => void
  /** Add a complete spin unit: friction wheel + spindle + figure on the platform. */
  addSpinner: () => void
  /** Add a complete path unit: four-bar linkage + figure riding the wand. */
  addLinkage: () => void
  updateLinkage: (id: string, patch: Partial<LinkageSpec>) => void
  removeLinkage: (id: string) => void
  /** Remove a cam with its pushrods/rockers and any characters on those channels. */
  removeCam: (id: string) => void
  removeSpinner: (id: string) => void
  /** Install a layshaft gear train (defaults if none given). */
  addGearTrain: () => void
  updateGearTrain: (patch: Partial<GearTrainSpec>) => void
  /** Remove the gear train; layshaft cams move back to the crankshaft. */
  removeGearTrain: () => void
  /** Add a figure bound to the first output channel. */
  addCharacter: () => void
  removeCharacter: (id: string) => void
  /** Convert a figure between rigid block and articulated (jointed limbs). */
  setCharacterKind: (id: string, kind: CharacterSpec['kind']) => void
  /** Add a limb to an articulated figure (next unused kind, bound to its channel). */
  addLimb: (characterId: string) => void
  updateLimb: (characterId: string, limbId: string, patch: Partial<LimbSpec>) => void
  removeLimb: (characterId: string, limbId: string) => void

  /** Rename the design. */
  setName: (name: string) => void
  /**
   * Add a library figure moving in a named way: installs the whole unit
   * (mechanism + channel + silhouette figure) in the widest free stretch
   * of shaft. Returns false when the channel limit is reached.
   */
  addFigureWithMotion: (shapeId: string, motion: MotionId) => boolean
  /** Add a scenery plate from the prop library in its natural row. */
  addProp: (shapeId: string) => void
  updateProp: (id: string, patch: Partial<PropSpec>) => void
  removeProp: (id: string) => void

  /** Undo/redo stacks of whole designs (most recent last / first). */
  past: AutomatonSpec[]
  future: AutomatonSpec[]
  undo: () => void
  redo: () => void
}

export const MAX_LIMBS = 3

/** Chart palette carries four validated series slots; the box also gets crowded. */
export const MAX_CHANNELS = 4
export const MIN_CHANNELS = 1

export function channelCount(spec: AutomatonSpec): number {
  const m = spec.mechanism
  return m.pushrods.length + m.rockers.length + m.spinners.length + (m.linkages?.length ?? 0)
}

/** Next free numeric suffix across all mechanism/character ids. */
function nextIndex(spec: AutomatonSpec): number {
  const ids = [
    ...spec.mechanism.cams.map((c) => c.id),
    ...spec.mechanism.pushrods.map((r) => r.id),
    ...spec.mechanism.rockers.map((r) => r.id),
    ...spec.mechanism.spinners.map((r) => r.id),
    ...(spec.mechanism.linkages ?? []).map((l) => l.id),
    ...spec.characters.map((c) => c.id),
    ...spec.characters.flatMap((c) => (c.limbs ?? []).map((l) => l.id)),
  ]
  let max = 0
  for (const id of ids) {
    const m = /-(\d+)$/.exec(id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

/** Midpoint of the widest free stretch of shaft, keeping clear of the walls. */
function freeShaftPosition(spec: AutomatonSpec): number {
  const used = [
    ...spec.mechanism.cams.map((c) => c.position),
    ...spec.mechanism.spinners.map((sp) => sp.position),
    ...(spec.mechanism.linkages ?? []).map((l) => l.position),
  ].sort((a, b) => a - b)
  const bounds = [0.08, ...used, 0.92]
  let bestGap = 0
  let best = 0.5
  for (let i = 0; i < bounds.length - 1; i++) {
    const gap = bounds[i + 1] - bounds[i]
    if (gap > bestGap) {
      bestGap = gap
      best = (bounds[i] + bounds[i + 1]) / 2
    }
  }
  return Math.round(best * 100) / 100
}

const FIGURE_COLORS = ['#4fb06a', '#8a6fe8', '#e0764f', '#4fa9c9', '#c94f8e']

/**
 * Drop characters riding removed channels, and strip limbs whose drive
 * channel was removed from figures that survive.
 */
function pruneCharacters(
  characters: CharacterSpec[],
  removedChannelIds: string[],
): CharacterSpec[] {
  return characters
    .filter((c) => !removedChannelIds.includes(c.channelId))
    .map((c) =>
      c.limbs?.some((l) => removedChannelIds.includes(l.channelId))
        ? { ...c, limbs: c.limbs.filter((l) => !removedChannelIds.includes(l.channelId)) }
        : c,
    )
}

const TWO_PI = Math.PI * 2
// Wrap the accumulating crank angle only after many whole revolutions:
// spin figures (gears, geneva steps) keep visual continuity, floats stay
// small, and 840 divides evenly by every ratio the UI can produce.
const CRANK_WRAP = TWO_PI * 840

export const useDesignerStore = create<DesignerState>((set, get) => ({
  spec: loadInitialSpec(),
  crankAngle: 0,
  isCranking: true,
  crankSpeed: 0.4,
  seeThrough: true,
  xrayFigures: [],

  toggleFigureXray: (id) =>
    set((s) => ({
      xrayFigures: s.xrayFigures.includes(id)
        ? s.xrayFigures.filter((x) => x !== id)
        : [...s.xrayFigures, id],
    })),

  setCrankAngle: (angle) => set({ crankAngle: ((angle % TWO_PI) + TWO_PI) % TWO_PI }),
  advanceCrank: (dt) =>
    set((s) => ({ crankAngle: (s.crankAngle + dt * s.crankSpeed * TWO_PI) % CRANK_WRAP })),
  setCranking: (on) => set({ isCranking: on }),
  setCrankSpeed: (revPerSec) => set({ crankSpeed: revPerSec }),
  setSeeThrough: (on) => set({ seeThrough: on }),

  updateFrame: (patch) =>
    set((s) => ({ spec: { ...s.spec, frame: { ...s.spec.frame, ...patch } } })),

  updateMechanism: (patch) =>
    set((s) => ({ spec: { ...s.spec, mechanism: { ...s.spec.mechanism, ...patch } } })),

  updateCam: (id, patch) =>
    set((s) => ({
      spec: {
        ...s.spec,
        mechanism: {
          ...s.spec.mechanism,
          cams: s.spec.mechanism.cams.map((c) =>
            c.id === id ? ({ ...c, ...patch } as CamSpec) : c,
          ),
        },
      },
    })),

  updatePushrod: (id, patch) =>
    set((s) => ({
      spec: {
        ...s.spec,
        mechanism: {
          ...s.spec.mechanism,
          pushrods: s.spec.mechanism.pushrods.map((r) =>
            r.id === id ? { ...r, ...patch } : r,
          ),
        },
      },
    })),

  updateRocker: (id, patch) =>
    set((s) => ({
      spec: {
        ...s.spec,
        mechanism: {
          ...s.spec.mechanism,
          rockers: s.spec.mechanism.rockers.map((r) =>
            r.id === id ? { ...r, ...patch } : r,
          ),
        },
      },
    })),

  updateSpinner: (id, patch) =>
    set((s) => ({
      spec: {
        ...s.spec,
        mechanism: {
          ...s.spec.mechanism,
          spinners: s.spec.mechanism.spinners.map((sp) =>
            sp.id === id ? { ...sp, ...patch } : sp,
          ),
        },
      },
    })),

  updateCharacter: (id, patch) =>
    set((s) => ({
      spec: {
        ...s.spec,
        characters: s.spec.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    })),

  updateExport: (patch) =>
    set((s) => ({ spec: { ...s.spec, export: { ...s.spec.export, ...patch } } })),

  loadTemplate: (spec) => set({ spec: structuredClone(spec), crankAngle: 0, xrayFigures: [] }),

  addCam: () =>
    set((s) => {
      if (channelCount(s.spec) >= MAX_CHANNELS) return {}
      const n = nextIndex(s.spec)
      const rodId = `rod-${n}`
      const cam: CamSpec = {
        id: `cam-${n}`,
        kind: 'eccentric',
        radius: 18,
        eccentricity: 6,
        position: freeShaftPosition(s.spec),
        phaseDeg: 0,
        thickness: 6,
      }
      const rod: PushrodSpec = { id: rodId, camId: cam.id, rodWidth: 6, padWidth: 20, length: 60 }
      const figure: CharacterSpec = {
        id: `figure-${n}`,
        channelId: rodId,
        kind: 'block',
        width: 18,
        height: 24,
        depth: 15,
        color: FIGURE_COLORS[(n - 1) % FIGURE_COLORS.length],
        label: `Figure ${n}`,
      }
      return {
        spec: {
          ...s.spec,
          mechanism: {
            ...s.spec.mechanism,
            cams: [...s.spec.mechanism.cams, cam],
            pushrods: [...s.spec.mechanism.pushrods, rod],
          },
          characters: [...s.spec.characters, figure],
        },
      }
    }),

  addRocker: () =>
    set((s) => {
      if (channelCount(s.spec) >= MAX_CHANNELS) return {}
      const n = nextIndex(s.spec)
      const rockerId = `rock-${n}`
      const cam: CamSpec = {
        id: `cam-${n}`,
        kind: 'eccentric',
        radius: 16,
        eccentricity: 6,
        position: freeShaftPosition(s.spec),
        phaseDeg: 0,
        thickness: 6,
      }
      const rocker: RockerSpec = { id: rockerId, camId: cam.id, leverLength: 30, padWidth: 14 }
      const figure: CharacterSpec = {
        id: `figure-${n}`,
        channelId: rockerId,
        kind: 'block',
        width: 18,
        height: 24,
        depth: 15,
        color: FIGURE_COLORS[(n - 1) % FIGURE_COLORS.length],
        label: `Nodder ${n}`,
      }
      return {
        spec: {
          ...s.spec,
          mechanism: {
            ...s.spec.mechanism,
            cams: [...s.spec.mechanism.cams, cam],
            rockers: [...s.spec.mechanism.rockers, rocker],
          },
          characters: [...s.spec.characters, figure],
        },
      }
    }),

  addSpinner: () =>
    set((s) => {
      if (channelCount(s.spec) >= MAX_CHANNELS) return {}
      const n = nextIndex(s.spec)
      const spinnerId = `spin-${n}`
      const spinner: SpinnerSpec = {
        id: spinnerId,
        position: freeShaftPosition(s.spec),
        ratio: 1,
        wheelRadius: 14,
        platformRadius: 26,
      }
      const figure: CharacterSpec = {
        id: `figure-${n}`,
        channelId: spinnerId,
        kind: 'block',
        width: 14,
        height: 22,
        depth: 12,
        color: FIGURE_COLORS[(n - 1) % FIGURE_COLORS.length],
        label: `Rider ${n}`,
      }
      return {
        spec: {
          ...s.spec,
          mechanism: {
            ...s.spec.mechanism,
            spinners: [...s.spec.mechanism.spinners, spinner],
          },
          characters: [...s.spec.characters, figure],
        },
      }
    }),

  removeCam: (id) =>
    set((s) => {
      const removedChannels = [
        ...s.spec.mechanism.pushrods.filter((r) => r.camId === id),
        ...s.spec.mechanism.rockers.filter((r) => r.camId === id),
      ].map((r) => r.id)
      if (channelCount(s.spec) - removedChannels.length < MIN_CHANNELS) return {}
      return {
        spec: {
          ...s.spec,
          mechanism: {
            ...s.spec.mechanism,
            cams: s.spec.mechanism.cams.filter((c) => c.id !== id),
            pushrods: s.spec.mechanism.pushrods.filter((r) => r.camId !== id),
            rockers: s.spec.mechanism.rockers.filter((r) => r.camId !== id),
          },
          characters: pruneCharacters(s.spec.characters, removedChannels),
        },
      }
    }),

  removeSpinner: (id) =>
    set((s) => {
      if (channelCount(s.spec) <= MIN_CHANNELS) return {}
      return {
        spec: {
          ...s.spec,
          mechanism: {
            ...s.spec.mechanism,
            spinners: s.spec.mechanism.spinners.filter((sp) => sp.id !== id),
          },
          characters: pruneCharacters(s.spec.characters, [id]),
        },
      }
    }),

  addLinkage: () =>
    set((s) => {
      if (channelCount(s.spec) >= MAX_CHANNELS) return {}
      const n = nextIndex(s.spec)
      const linkageId = `link-${n}`
      // default Grashof crank-rocker with comfortable margins
      const linkage: LinkageSpec = {
        id: linkageId,
        position: freeShaftPosition(s.spec),
        crankRadius: 10,
        couplerLen: 40,
        rockerLen: 32,
        groundLen: 34,
        couplerExt: 14,
        wandLen: 78,
        phaseDeg: 0,
      }
      const figure: CharacterSpec = {
        id: `figure-${n}`,
        channelId: linkageId,
        kind: 'block',
        width: 16,
        height: 20,
        depth: 14,
        color: FIGURE_COLORS[(n - 1) % FIGURE_COLORS.length],
        label: `Swooper ${n}`,
      }
      return {
        spec: {
          ...s.spec,
          mechanism: {
            ...s.spec.mechanism,
            linkages: [...(s.spec.mechanism.linkages ?? []), linkage],
          },
          characters: [...s.spec.characters, figure],
        },
      }
    }),

  updateLinkage: (id, patch) =>
    set((s) => ({
      spec: {
        ...s.spec,
        mechanism: {
          ...s.spec.mechanism,
          linkages: (s.spec.mechanism.linkages ?? []).map((l) =>
            l.id === id ? { ...l, ...patch } : l,
          ),
        },
      },
    })),

  removeLinkage: (id) =>
    set((s) => {
      if (channelCount(s.spec) <= MIN_CHANNELS) return {}
      return {
        spec: {
          ...s.spec,
          mechanism: {
            ...s.spec.mechanism,
            linkages: (s.spec.mechanism.linkages ?? []).filter((l) => l.id !== id),
          },
          characters: pruneCharacters(s.spec.characters, [id]),
        },
      }
    }),

  addGearTrain: () =>
    set((s) => {
      if (s.spec.mechanism.gearTrain) return {}
      const gearTrain: GearTrainSpec = {
        teethDrive: 24,
        teethDriven: 12,
        module: 1.5,
        position: 0.5,
      }
      return { spec: { ...s.spec, mechanism: { ...s.spec.mechanism, gearTrain } } }
    }),

  updateGearTrain: (patch) =>
    set((s) => {
      if (!s.spec.mechanism.gearTrain) return {}
      return {
        spec: {
          ...s.spec,
          mechanism: {
            ...s.spec.mechanism,
            gearTrain: { ...s.spec.mechanism.gearTrain, ...patch },
          },
        },
      }
    }),

  removeGearTrain: () =>
    set((s) => ({
      spec: {
        ...s.spec,
        mechanism: {
          ...s.spec.mechanism,
          gearTrain: undefined,
          cams: s.spec.mechanism.cams.map((c) =>
            c.shaft === 'lay' ? { ...c, shaft: 'crank' as const } : c,
          ),
        },
      },
    })),

  addCharacter: () =>
    set((s) => {
      const firstChannel =
        s.spec.mechanism.pushrods[0] ??
        s.spec.mechanism.rockers[0] ??
        s.spec.mechanism.spinners[0]
      if (!firstChannel) return {}
      const n = nextIndex(s.spec)
      const figure: CharacterSpec = {
        id: `figure-${n}`,
        channelId: firstChannel.id,
        kind: 'block',
        width: 18,
        height: 24,
        depth: 15,
        color: FIGURE_COLORS[(n - 1) % FIGURE_COLORS.length],
        label: `Figure ${n}`,
      }
      return { spec: { ...s.spec, characters: [...s.spec.characters, figure] } }
    }),

  removeCharacter: (id) =>
    set((s) => ({
      spec: { ...s.spec, characters: s.spec.characters.filter((c) => c.id !== id) },
    })),

  setCharacterKind: (id, kind) =>
    set((s) => ({
      spec: {
        ...s.spec,
        characters: s.spec.characters.map((c) => {
          if (c.id !== id || c.kind === kind) return c
          if (kind === 'block') {
            const { limbs: _limbs, shape: _shape, ...rest } = c
            return { ...rest, kind }
          }
          if (kind === 'silhouette') {
            const { limbs: _limbs, ...rest } = c
            const shape = FIGURE_SHAPES[DEFAULT_FIGURE_SHAPE]
            return {
              ...rest,
              kind,
              shape: DEFAULT_FIGURE_SHAPE,
              width: shape.defaultWidth,
              height: shape.defaultHeight,
            }
          }
          // starting limb: wings driven by the figure's own channel
          const wings: LimbSpec = {
            id: `limb-${nextIndex(s.spec)}`,
            channelId: c.channelId,
            kind: 'wings',
            length: Math.round(c.width * 1.6),
            width: Math.max(8, Math.round(c.depth * 0.75)),
            crankArm: 10,
          }
          return { ...c, kind, limbs: [wings] }
        }),
      },
    })),

  addLimb: (characterId) =>
    set((s) => ({
      spec: {
        ...s.spec,
        characters: s.spec.characters.map((c) => {
          if (c.id !== characterId || c.kind !== 'articulated') return c
          const limbs = c.limbs ?? []
          if (limbs.length >= MAX_LIMBS) return c
          const kinds: LimbSpec['kind'][] = ['wings', 'head', 'tail']
          const kind = kinds.find((k) => !limbs.some((l) => l.kind === k)) ?? 'wings'
          const limb: LimbSpec = {
            id: `limb-${nextIndex(s.spec)}`,
            channelId: c.channelId,
            kind,
            length: kind === 'wings' ? Math.round(c.width * 1.6) : Math.round(c.depth * 1.1),
            width: Math.max(8, Math.round(c.depth * 0.75)),
            crankArm: 10,
          }
          return { ...c, limbs: [...limbs, limb] }
        }),
      },
    })),

  updateLimb: (characterId, limbId, patch) =>
    set((s) => ({
      spec: {
        ...s.spec,
        characters: s.spec.characters.map((c) =>
          c.id === characterId && c.limbs
            ? { ...c, limbs: c.limbs.map((l) => (l.id === limbId ? { ...l, ...patch } : l)) }
            : c,
        ),
      },
    })),

  removeLimb: (characterId, limbId) =>
    set((s) => ({
      spec: {
        ...s.spec,
        characters: s.spec.characters.map((c) =>
          c.id === characterId && c.limbs
            ? { ...c, limbs: c.limbs.filter((l) => l.id !== limbId) }
            : c,
        ),
      },
    })),

  setName: (name) =>
    set((s) => {
      const clean = name.trim().slice(0, 60)
      return clean ? { spec: { ...s.spec, name: clean } } : {}
    }),

  addFigureWithMotion: (shapeId, motion) => {
    const shape = FIGURE_SHAPES[shapeId]
    if (!shape || channelCount(get().spec) >= MAX_CHANNELS) return false
    const before = new Set(get().spec.characters.map((c) => c.id))
    const camsBefore = new Set(get().spec.mechanism.cams.map((c) => c.id))
    // reuse the proven unit builders, then dress the new unit
    if (motion === 'nod') get().addRocker()
    else if (motion === 'spin') get().addSpinner()
    else if (motion === 'swoop') get().addLinkage()
    else get().addCam()
    set((s) => {
      const fresh = s.spec.characters.find((c) => !before.has(c.id))
      if (!fresh) return {}
      const newCam = s.spec.mechanism.cams.find((c) => !camsBefore.has(c.id))
      const base = newCam && {
        id: newCam.id,
        position: newCam.position,
        phaseDeg: newCam.phaseDeg,
        thickness: newCam.thickness,
      }
      const cams = s.spec.mechanism.cams.map((c): CamSpec => {
        if (!base || c.id !== base.id) return c
        if (motion === 'bounce') return { ...base, kind: 'petal', baseRadius: 16, lift: 8, lobes: 3 }
        if (motion === 'drop') return { ...base, kind: 'snail', baseRadius: 14, lift: 12 }
        return c
      })
      return {
        spec: {
          ...s.spec,
          mechanism: { ...s.spec.mechanism, cams },
          characters: s.spec.characters.map((c) =>
            c.id === fresh.id
              ? {
                  ...c,
                  kind: 'silhouette' as const,
                  shape: shapeId,
                  width: shape.defaultWidth,
                  height: shape.defaultHeight,
                  depth: 14,
                  color: FIGURE_INFO[shapeId]?.color ?? c.color,
                  label: shape.label,
                }
              : c,
          ),
        },
      }
    })
    return true
  },

  addProp: (shapeId) =>
    set((s) => {
      const shape = PROP_SHAPES[shapeId]
      const props = s.spec.props ?? []
      if (!shape || props.length >= MAX_PROPS) return {}
      let n = 1
      while (props.some((p) => p.id === `prop-${n}`)) n++
      // first free spot in the prop's row, scanning out from the centre
      const sameRow = props.filter((p) => p.row === shape.defaultRow)
      const spots = [0.5, 0.25, 0.75, 0.15, 0.85, 0.38, 0.62]
      const position =
        spots.find((x) => sameRow.every((p) => Math.abs(p.position - x) > 0.08)) ?? 0.5
      const prop: PropSpec = {
        id: `prop-${n}`,
        shape: shapeId,
        position,
        row: shape.defaultRow,
        width: Math.min(shape.defaultWidth, s.spec.frame.width - 20),
        height: shape.defaultHeight,
        color: shape.defaultColor,
      }
      return { spec: { ...s.spec, props: [...props, prop] } }
    }),

  updateProp: (id, patch) =>
    set((s) => ({
      spec: {
        ...s.spec,
        props: (s.spec.props ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)),
      },
    })),

  removeProp: (id) =>
    set((s) => ({
      spec: { ...s.spec, props: (s.spec.props ?? []).filter((p) => p.id !== id) },
    })),

  past: [],
  future: [],

  undo: () => {
    const { past, future, spec } = get()
    if (past.length === 0) return
    historyMuted = true
    set({ spec: past[past.length - 1], past: past.slice(0, -1), future: [spec, ...future] })
    historyMuted = false
  },

  redo: () => {
    const { past, future, spec } = get()
    if (future.length === 0) return
    historyMuted = true
    set({ spec: future[0], past: [...past, spec], future: future.slice(1) })
    historyMuted = false
  },
}))

// Undo history: every design change pushes the PREVIOUS design, except
// that a burst of changes (a slider drag) collapses into one step.
let historyMuted = false
let lastChangeAt = 0
const HISTORY_LIMIT = 60
const HISTORY_BURST_MS = 600
/** Tests: make the next change start a fresh undo step. */
export function breakHistoryBurst() {
  lastChangeAt = 0
}
useDesignerStore.subscribe((state, prev) => {
  if (state.spec === prev.spec || historyMuted) return
  const now = Date.now()
  const burst = now - lastChangeAt < HISTORY_BURST_MS
  lastChangeAt = now
  if (burst && state.future.length === 0) return
  useDesignerStore.setState({
    past: burst ? state.past : [...state.past, prev.spec].slice(-HISTORY_LIMIT),
    future: [],
  })
})

// Auto-save: any design change lands in localStorage after a short debounce,
// so a reload (without a share link) resumes where the user left off.
if (typeof window !== 'undefined') {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastSpec = useDesignerStore.getState().spec
  useDesignerStore.subscribe((state) => {
    if (state.spec === lastSpec) return
    lastSpec = state.spec
    clearTimeout(timer)
    timer = setTimeout(() => saveToLocalStorage(lastSpec), 400)
  })
}
