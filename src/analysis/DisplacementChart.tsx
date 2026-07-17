import { useMemo, useRef, useState } from 'react'
import { useDesignerStore } from '../model/store'
import { useChannels } from '../scene/useChannels'
import { sampleDisplacement } from '../kinematics/follower'

/** Validated categorical slots (dark surface #1a1f27) in fixed order. */
const SERIES_COLORS = ['#3987e5', '#008300', '#d55181', '#c98500']

const M = { top: 14, right: 96, bottom: 26, left: 44 }
const GRID = '#2a3140'
const AXIS = '#3a4250'
const MUTED = '#9aa3b2'

/**
 * Displacement analysis: follower lift (mm above its lowest point) vs crank
 * angle for every output channel, with a live marker at the current crank
 * angle and a hover crosshair. Reads the same displacement tables that
 * drive the 3D simulation.
 */
export function DisplacementChart() {
  const channels = useChannels()
  const crankAngle = useDesignerStore((s) => s.crankAngle)
  const [hoverDeg, setHoverDeg] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const W = 900
  const H = 190
  const plotW = W - M.left - M.right
  const plotH = H - M.top - M.bottom

  const maxLift = Math.max(4, ...channels.map((c) => c.table.lift))
  const x = (deg: number) => M.left + (deg / 360) * plotW
  const y = (mm: number) => M.top + plotH - (mm / maxLift) * plotH

  const series = useMemo(
    () =>
      channels.map((c, i) => {
        const pts: string[] = []
        for (let deg = 0; deg <= 360; deg += 2) {
          const s = sampleDisplacement(c.table, (deg * Math.PI) / 180) - c.table.min
          pts.push(`${deg === 0 ? 'M' : 'L'}${x(deg).toFixed(1)},${y(s).toFixed(1)}`)
        }
        return {
          id: c.channel.id,
          kind: c.channel.cam.kind,
          color: SERIES_COLORS[i % SERIES_COLORS.length],
          path: pts.join(' '),
          table: c.table,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channels, maxLift],
  )

  const crankDeg = ((crankAngle * 180) / Math.PI) % 360
  const yTicks = useMemo(() => {
    const step = maxLift <= 8 ? 2 : maxLift <= 20 ? 5 : 10
    const ticks: number[] = []
    for (let v = 0; v <= maxLift; v += step) ticks.push(v)
    return ticks
  }, [maxLift])

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const deg = ((px - M.left) / plotW) * 360
    setHoverDeg(deg >= 0 && deg <= 360 ? deg : null)
  }

  const readout = (deg: number) =>
    series.map((s) => ({
      ...s,
      value: sampleDisplacement(s.table, (deg * Math.PI) / 180) - s.table.min,
    }))

  const hover = hoverDeg !== null ? readout(hoverDeg) : null

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
      onPointerMove={onMove}
      onPointerLeave={() => setHoverDeg(null)}
      role="img"
      aria-label="Follower displacement versus crank angle for each output channel"
    >
      <text x={M.left} y={10} fontSize={11} fill={MUTED}>
        Follower displacement · lift (mm) vs crank angle
      </text>

      {/* grid + axes (recessive) */}
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={M.left} x2={M.left + plotW} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
          <text x={M.left - 6} y={y(v) + 3} fontSize={10} fill={MUTED} textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {v}
          </text>
        </g>
      ))}
      {[0, 90, 180, 270, 360].map((deg) => (
        <g key={deg}>
          <line x1={x(deg)} x2={x(deg)} y1={M.top} y2={M.top + plotH} stroke={GRID} strokeWidth={1} />
          <text x={x(deg)} y={H - 8} fontSize={10} fill={MUTED} textAnchor="middle" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {deg}°
          </text>
        </g>
      ))}
      <line x1={M.left} x2={M.left + plotW} y1={M.top + plotH} y2={M.top + plotH} stroke={AXIS} strokeWidth={1} />

      {/* series */}
      {series.map((s) => (
        <path key={s.id} d={s.path} fill="none" stroke={s.color} strokeWidth={2} />
      ))}

      {/* direct labels + legend, ink for text, chip for identity */}
      {series.map((s, i) => (
        <g key={s.id} transform={`translate(${M.left + plotW + 10}, ${M.top + 8 + i * 18})`}>
          <rect x={0} y={-7} width={10} height={10} rx={2} fill={s.color} />
          <text x={15} y={2} fontSize={11} fill="#e6e9ee">
            {s.id} · {s.kind}
          </text>
        </g>
      ))}

      {/* live crank marker */}
      <g>
        <line x1={x(crankDeg)} x2={x(crankDeg)} y1={M.top} y2={M.top + plotH} stroke="#e0a54f" strokeWidth={1.5} />
        {readout(crankDeg).map((s) => (
          <circle key={s.id} cx={x(crankDeg)} cy={y(s.value)} r={4} fill={s.color} stroke="#1a1f27" strokeWidth={2} />
        ))}
      </g>

      {/* hover crosshair + tooltip */}
      {hover && hoverDeg !== null && (
        <g pointerEvents="none">
          <line x1={x(hoverDeg)} x2={x(hoverDeg)} y1={M.top} y2={M.top + plotH} stroke={MUTED} strokeWidth={1} strokeDasharray="3 3" />
          {hover.map((s) => (
            <circle key={s.id} cx={x(hoverDeg)} cy={y(s.value)} r={4} fill={s.color} stroke="#1a1f27" strokeWidth={2} />
          ))}
          {(() => {
            const boxW = 128
            const boxH = 18 + hover.length * 16
            const bx = Math.min(x(hoverDeg) + 10, W - M.right - boxW - 4)
            const by = M.top + 4
            return (
              <g transform={`translate(${bx}, ${by})`}>
                <rect width={boxW} height={boxH} rx={6} fill="#222834" stroke={AXIS} />
                <text x={8} y={14} fontSize={10} fill={MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(hoverDeg)}°
                </text>
                {hover.map((s, i) => (
                  <g key={s.id} transform={`translate(8, ${26 + i * 16})`}>
                    <rect x={0} y={-7} width={8} height={8} rx={2} fill={s.color} />
                    <text x={13} y={0} fontSize={10} fill="#e6e9ee" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {s.id}: {s.value.toFixed(1)} mm
                    </text>
                  </g>
                ))}
              </g>
            )
          })()}
        </g>
      )}
    </svg>
  )
}
