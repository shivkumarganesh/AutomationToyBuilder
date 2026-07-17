import { AutomatonScene } from './scene/AutomatonScene'
import { Sidebar } from './ui/Sidebar'
import { CrankControls } from './ui/CrankControls'
import { DisplacementChart } from './analysis/DisplacementChart'
import { useDesignerStore } from './model/store'

export default function App() {
  const name = useDesignerStore((s) => s.spec.name)
  return (
    <div className="app">
      <header className="app-header">
        <h1>Automaton Toy Designer</h1>
        <span className="subtitle">{name} — crank → cams → pushrods → figures</span>
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
