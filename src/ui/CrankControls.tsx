import { useDesignerStore } from '../model/store'

/** Play/scrub controls for the crank simulation, overlaid on the 3D view. */
export function CrankControls() {
  const isCranking = useDesignerStore((s) => s.isCranking)
  const crankSpeed = useDesignerStore((s) => s.crankSpeed)
  const crankAngle = useDesignerStore((s) => s.crankAngle)
  const seeThrough = useDesignerStore((s) => s.seeThrough)
  const { setCranking, setCrankSpeed, setCrankAngle, setSeeThrough } = useDesignerStore()

  const deg = Math.round((crankAngle * 180) / Math.PI)

  return (
    <div className="crank-controls">
      <button className="primary" onClick={() => setCranking(!isCranking)}>
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
    </div>
  )
}
