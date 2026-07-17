import { create } from 'zustand'
import type {
  AutomatonSpec,
  CamSpec,
  CharacterSpec,
  ExportSettings,
  FrameSpec,
  MechanismSpec,
  PushrodSpec,
} from './types'
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

  setCrankAngle: (angle: number) => void
  advanceCrank: (deltaSeconds: number) => void
  setCranking: (on: boolean) => void
  setCrankSpeed: (revPerSec: number) => void
  setSeeThrough: (on: boolean) => void

  updateFrame: (patch: Partial<FrameSpec>) => void
  updateMechanism: (patch: Partial<Omit<MechanismSpec, 'cams' | 'pushrods'>>) => void
  updateCam: (id: string, patch: Partial<CamSpec>) => void
  updatePushrod: (id: string, patch: Partial<PushrodSpec>) => void
  updateCharacter: (id: string, patch: Partial<CharacterSpec>) => void
  updateExport: (patch: Partial<ExportSettings>) => void
  loadTemplate: (spec: AutomatonSpec) => void

  /** Add a complete channel unit: cam + pushrod + figure riding it. */
  addCam: () => void
  /** Remove a cam with its pushrod and any characters riding that channel. */
  removeCam: (id: string) => void
  /** Add a figure bound to the first output channel. */
  addCharacter: () => void
  removeCharacter: (id: string) => void
}

/** Chart palette carries four validated series slots; the box also gets crowded. */
export const MAX_CAMS = 4
export const MIN_CAMS = 1

/** Next free numeric suffix across all mechanism/character ids. */
function nextIndex(spec: AutomatonSpec): number {
  const ids = [
    ...spec.mechanism.cams.map((c) => c.id),
    ...spec.mechanism.pushrods.map((r) => r.id),
    ...spec.characters.map((c) => c.id),
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
  const bounds = [0.08, ...spec.mechanism.cams.map((c) => c.position).sort((a, b) => a - b), 0.92]
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

const TWO_PI = Math.PI * 2

export const useDesignerStore = create<DesignerState>((set) => ({
  spec: loadInitialSpec(),
  crankAngle: 0,
  isCranking: true,
  crankSpeed: 0.4,
  seeThrough: true,

  setCrankAngle: (angle) => set({ crankAngle: ((angle % TWO_PI) + TWO_PI) % TWO_PI }),
  advanceCrank: (dt) =>
    set((s) => ({ crankAngle: (s.crankAngle + dt * s.crankSpeed * TWO_PI) % TWO_PI })),
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

  updateCharacter: (id, patch) =>
    set((s) => ({
      spec: {
        ...s.spec,
        characters: s.spec.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    })),

  updateExport: (patch) =>
    set((s) => ({ spec: { ...s.spec, export: { ...s.spec.export, ...patch } } })),

  loadTemplate: (spec) => set({ spec: structuredClone(spec), crankAngle: 0 }),

  addCam: () =>
    set((s) => {
      if (s.spec.mechanism.cams.length >= MAX_CAMS) return {}
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

  removeCam: (id) =>
    set((s) => {
      if (s.spec.mechanism.cams.length <= MIN_CAMS) return {}
      const removedRods = s.spec.mechanism.pushrods
        .filter((r) => r.camId === id)
        .map((r) => r.id)
      return {
        spec: {
          ...s.spec,
          mechanism: {
            ...s.spec.mechanism,
            cams: s.spec.mechanism.cams.filter((c) => c.id !== id),
            pushrods: s.spec.mechanism.pushrods.filter((r) => r.camId !== id),
          },
          characters: s.spec.characters.filter((c) => !removedRods.includes(c.channelId)),
        },
      }
    }),

  addCharacter: () =>
    set((s) => {
      const firstChannel = s.spec.mechanism.pushrods[0]
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
}))

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
