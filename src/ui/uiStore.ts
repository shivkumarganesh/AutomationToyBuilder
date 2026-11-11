import { create } from 'zustand'
import type { BuildMethod } from '../export/buildGuide'

/**
 * App-shell state (which screen, which editing mode, which build
 * route). Deliberately separate from the design store: none of this is
 * part of a design, so it never travels in saves or share links.
 */

export type View = 'home' | 'design' | 'make'
export type EditMode = 'simple' | 'advanced'

const KEY = 'automaton-designer.ui.v1'
const SPEC_KEY = 'automaton-designer.spec.v1'

interface Persisted {
  mode: EditMode
  method: BuildMethod
}

function loadPersisted(): Persisted {
  const fallback: Persisted = { mode: 'simple', method: 'laser' }
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Persisted> | null
    if (!raw) return fallback
    return {
      mode: raw.mode === 'advanced' ? 'advanced' : 'simple',
      method: raw.method === 'print' ? 'print' : 'laser',
    }
  } catch {
    return fallback
  }
}

/** First visit lands in the gallery; a share link or saved design opens the editor. */
function initialView(): View {
  try {
    if (window.location.hash.startsWith('#d=')) return 'design'
    if (localStorage.getItem(SPEC_KEY)) return 'design'
  } catch {
    // storage blocked — fall through to the gallery
  }
  return 'home'
}

interface UiState extends Persisted {
  view: View
  setView: (view: View) => void
  setMode: (mode: EditMode) => void
  setMethod: (method: BuildMethod) => void
}

export const useUiStore = create<UiState>((set, get) => {
  const save = () => {
    try {
      const { mode, method } = get()
      localStorage.setItem(KEY, JSON.stringify({ mode, method }))
    } catch {
      // storage blocked — preference just won't stick
    }
  }
  return {
    ...loadPersisted(),
    view: initialView(),
    setView: (view) => set({ view }),
    setMode: (mode) => {
      set({ mode })
      save()
    },
    setMethod: (method) => {
      set({ method })
      save()
    },
  }
})
