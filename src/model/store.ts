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
import { simplestAutomaton } from './templates'

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
}

const TWO_PI = Math.PI * 2

export const useDesignerStore = create<DesignerState>((set) => ({
  spec: structuredClone(simplestAutomaton),
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
}))
