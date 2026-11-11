import { useDesignerStore } from '../model/store'
import { useUiStore, type Finish } from './uiStore'
import { unlockSound } from './sound'

/** Play/scrub controls for the crank simulation, overlaid on the 3D view. */
export function CrankControls() {
  const isCranking = useDesignerStore((s) => s.isCranking)
  const crankSpeed = useDesignerStore((s) => s.crankSpeed)
  const crankAngle = useDesignerStore((s) => s.crankAngle)
  const seeThrough = useDesignerStore((s) => s.seeThrough)
  const { setCranking, setCrankSpeed, setCrankAngle, setSeeThrough } = useDesignerStore()

  const finish = useUiStore((s) => s.finish)
  const setFinish = useUiStore((s) => s.setFinish)
  const sound = useUiStore((s) => s.sound)
  const setSound = useUiStore((s) => s.setSound)

  const deg = Math.round((crankAngle * 180) / Math.PI) % 360

  return (
    <div className="crank-controls">
      <button
        className="primary"
        title="Or grab the red handle in the 3D view and turn it yourself"
        onClick={() => {
          unlockSound()
          setCranking(!isCranking)
        }}
      >
        {isCranking ? '⏸ Stop crank' : '▶ Turn crank'}
      </button>
      <label>
        Speed
        <input
          type="range"
          min={0.05}
          max={1.5}
          step={0.05}
          value={crankSpeed}
          onChange={(e) => setCrankSpeed(Number(e.target.value))}
        />
      </label>
      <label className="angle-scrub">
        Angle {deg}°
        <input
          style={{ flex: 1 }}
          type="range"
          min={0}
          max={359}
          value={deg}
          onChange={(e) => {
            setCranking(false)
            setCrankAngle((Number(e.target.value) * Math.PI) / 180)
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={seeThrough}
          onChange={(e) => setSeeThrough(e.target.checked)}
        />
        See through
      </label>
      <label title="Wooden ticks and knocks as the mechanism moves">
        <input
          type="checkbox"
          checked={sound}
          onChange={(e) => {
            unlockSound()
            setSound(e.target.checked)
          }}
        />
        Sound
      </label>
      <label title="How the toy is finished on screen — the cut files are the same">
        Finish
        <select value={finish} onChange={(e) => setFinish(e.target.value as Finish)}>
          <option value="painted">Painted</option>
          <option value="natural">Natural basswood</option>
          <option value="walnut">Walnut stain</option>
        </select>
      </label>
    </div>
  )
}
