import { useEffect, useState } from 'react'
import { AutomatonScene } from './scene/AutomatonScene'
import { Sidebar } from './ui/Sidebar'
import { CrankControls } from './ui/CrankControls'
import { Home } from './ui/Home'
import { MakeView } from './ui/MakeView'
import { DisplacementChart } from './analysis/DisplacementChart'
import { useDesignerStore } from './model/store'
import { useUiStore, type View } from './ui/uiStore'

const STEPS: { view: View; n: number; label: string }[] = [
  { view: 'home', n: 1, label: 'Choose' },
  { view: 'design', n: 2, label: 'Design' },
  { view: 'make', n: 3, label: 'Make' },
]

/** Editable design name: commits on blur / Enter. */
function NameField() {
  const name = useDesignerStore((s) => s.spec.name)
  const setName = useDesignerStore((s) => s.setName)
  const [draft, setDraft] = useState(name)
  useEffect(() => setDraft(name), [name])
  return (
    <input
      className="design-name"
      value={draft}
      aria-label="Design name"
      title="Rename your toy"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => (draft.trim() ? setName(draft) : setDraft(name))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

export default function App() {
  const view = useUiStore((s) => s.view)
  const setView = useUiStore((s) => s.setView)
  const mode = useUiStore((s) => s.mode)
  const canUndo = useDesignerStore((s) => s.past.length > 0)
  const canRedo = useDesignerStore((s) => s.future.length > 0)
  const undo = useDesignerStore((s) => s.undo)
  const redo = useDesignerStore((s) => s.redo)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) useDesignerStore.getState().redo()
      else useDesignerStore.getState().undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={`app view-${view} mode-${mode}`}>
      <header className="app-header">
        <button className="brand" onClick={() => setView('home')} title="Back to the gallery">
          <span className="brand-mark" aria-hidden="true">
            ⚙
          </span>
          <h1>Automaton Toy Designer</h1>
        </button>
        <nav className="stepper" aria-label="Steps">
          {STEPS.map((s) => (
            <button
              key={s.view}
              className={view === s.view ? 'on' : ''}
              aria-current={view === s.view ? 'step' : undefined}
              onClick={() => setView(s.view)}
            >
              <b>{s.n}</b>
              {s.label}
            </button>
          ))}
        </nav>
        {view !== 'home' && (
          <div className="header-tools">
            <NameField />
            <button className="icon" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
              ↶
            </button>
            <button className="icon" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
              ↷
            </button>
          </div>
        )}
      </header>

      {view === 'home' && <Home />}

      {view === 'design' && (
        <>
          <Sidebar />
          <main className="canvas-pane">
            <AutomatonScene />
            <CrankControls />
          </main>
          {mode === 'advanced' && (
            <section className="chart-pane">
              <DisplacementChart />
            </section>
          )}
        </>
      )}

      {view === 'make' && <MakeView />}
    </div>
  )
}
