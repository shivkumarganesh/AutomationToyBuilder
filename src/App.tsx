import { AutomatonScene } from './scene/AutomatonScene'
import { Sidebar } from './ui/Sidebar'
import { CrankControls } from './ui/CrankControls'
import { DisplacementChart } from './analysis/DisplacementChart'
import { useDesignerStore } from './model/store'
import { templates } from './model/templates'

export default function App() {
  const name = useDesignerStore((s) => s.spec.name)
  const loadTemplate = useDesignerStore((s) => s.loadTemplate)

  const currentKey =
    Object.entries(templates).find(([, spec]) => spec.name === name)?.[0] ?? ''

  return (
    <div className="app">
      <header className="app-header">
        <h1>Automaton Toy Designer</h1>
        <select
          value={currentKey}
          onChange={(e) => {
            const spec = templates[e.target.value]
            if (spec) loadTemplate(spec)
          }}
          aria-label="Toy template"
        >
          {currentKey === '' && (
            <option value="" disabled>
              Custom design — {name}
            </option>
          )}
          {Object.entries(templates).map(([key, spec]) => (
            <option key={key} value={key}>
              {spec.name}
            </option>
          ))}
        </select>
        <span className="subtitle">crank → cams → pushrods → figures</span>
      </header>
      <Sidebar />
      <main className="canvas-pane">
        <AutomatonScene />
        <CrankControls />
      </main>
      <section className="chart-pane">
        <DisplacementChart />
      </section>
    </div>
  )
}
