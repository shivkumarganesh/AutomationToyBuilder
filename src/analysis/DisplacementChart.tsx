import { useMemo, useRef, useState } from 'react'
import { useDesignerStore } from '../model/store'
import { useChannels } from '../scene/useChannels'
import { channelValue, type ChannelSignal } from '../kinematics/channels'

/** Validated categorical slots (dark surface #1a1f27) in fixed order. */
const SERIES_COLORS = ['#3987e5', '#008300', '#d55181', '#c98500']

const W = 900
const H = 190
const M = { top: 14, right: 116, bottom: 24, left: 44 }
const GRID = '#2a3140'
const AXIS = '#3a4250'
const MUTED = '#9aa3b2'

interface Series {
  id: string
  label: string
  color: string
  signal: ChannelSignal
  /** plotted value at theta (lift is re-based to 0 at its lowest point) */
  value: (theta: number) => number
}

interface Panel {
  unit: string
  series: Series[]
  min: number
  max: number
  y0: number
  height: number
}

/**
 * Motion analysis for every output channel over one crank revolution:
 * lift channels in mm and tilt channels in degrees as stacked panels
 * (one unit per axis — never a dual axis), spin channels as constant-rate
 * legend entries. A live marker tracks the 3D simulation.
 */
export function DisplacementChart() {
  const signals = useChannels()
  const crankAngle = useDesignerStore((s) => s.crankAngle)
  const [hoverDeg, setHoverDeg] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const plotW = W - M.left - M.right

  const { panels, spins } = useMemo(() => {
    const withColors = signals.map((signal, i) => ({
      signal,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
    }))
    const makeSeries = ({ signal, color }: (typeof withColors)[number]): Series => ({
      id: signal.channel.id,
      label:
        signal.kind === 'spin'
          ? signal.channel.spinner.drive === 'geneva'
            ? `${signal.channel.id} · geneva ${signal.channel.spinner.stations} steps`
            : `${signal.channel.id} · spin ×${signal.ratio}`
          : `${signal.channel.id} · ${signal.channel.cam.kind}`,
      color,
      signal,
      value: (theta) =>
        signal.kind === 'lift'
          ? channelValue(signal, theta) - signal.table.min
          : channelValue(signal, theta),
    })

    const lift = withColors.filter((s) => s.signal.kind === 'lift').map(makeSeries)
    const tilt = withColors.filter((s) => s.signal.kind === 'tilt').map(makeSeries)
    // geneva steps are bounded within a revolution (0 → 360/N) — chartable
    // in the degrees panel; continuous spins stay legend-only
    const genevaSpins = withColors
      .filter(
        (s) => s.signal.kind === 'spin' && s.signal.channel.spinner.drive === 'geneva',
      )
      .map(makeSeries)
    const spins = withColors
      .filter(
        (s) => s.signal.kind === 'spin' && s.signal.channel.spinner.drive !== 'geneva',
      )
      .map(makeSeries)

    const defs: { unit: string; series: Series[]; min: number; max: number }[] = []
    if (lift.length) {
      const max = Math.max(4, ...lift.map((s) => (s.signal.kind === 'lift' ? s.signal.table.lift : 0)))
      defs.push({ unit: 'mm', series: lift, min: 0, max })
    }
    const degSeries = [...tilt, ...genevaSpins]
    if (degSeries.length) {
      const tables = tilt.map((s) => (s.signal.kind === 'tilt' ? s.signal.table : null))
      const stationMax = Math.max(
        0,
        ...genevaSpins.map((s) =>
          s.signal.kind === 'spin' ? 360 / (s.signal.channel.spinner.stations ?? 1) : 0,
        ),
      )
      const lo = Math.min(-2, ...tables.map((t) => t?.min ?? 0))
      const hi = Math.max(2, stationMax, ...tables.map((t) => t?.max ?? 0))
      defs.push({ unit: '°', series: degSeries, min: lo, max: hi })
    }

    const plotH = H - M.top - M.bottom
    const gap = defs.length > 1 ? 16 : 0
    const each = (plotH - gap * (defs.length - 1)) / Math.max(defs.length, 1)
    const panels: Panel[] = defs.map((d, i) => ({
      ...d,
      y0: M.top + i * (each + gap),
      height: each,
    }))
    return { panels, spins }
  }, [signals])

  const x = (deg: number) => M.left + (deg / 360) * plotW
  const yOf = (panel: Panel) => (v: number) =>
    panel.y0 + panel.height - ((v - panel.min) / (panel.max - panel.min)) * panel.height

  const crankDeg = ((crankAngle * 180) / Math.PI) % 360
  const legend = [...panels.flatMap((p) => p.series), ...spins]

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const deg = ((px - M.left) / plotW) * 360
    setHoverDeg(deg >= 0 && deg <= 360 ? deg : null)
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
      onPointerMove={onMove}
      onPointerLeave={() => setHoverDeg(null)}
      role="img"
      aria-label="Channel motion versus crank angle"
    >
      <text x={M.left} y={10} fontSize={11} fill={MUTED}>
        Channel motion vs crank angle
      </text>

      {panels.map((panel) => {
        const y = yOf(panel)
        const ticks = [panel.min, (panel.min + panel.max) / 2, panel.max]
        return (
          <g key={panel.unit}>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={M.left} x2={M.left + plotW} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} />
                <text x={M.left - 6} y={y(v) + 3} fontSize={9} fill={MUTED} textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(v)}{panel.unit}
                </text>
              </g>
            ))}
            <line x1={M.left} x2={M.left + plotW} y1={panel.y0 + panel.height} y2={panel.y0 + panel.height} stroke={AXIS} strokeWidth={1} />
            {panel.series.map((s) => {
              const pts: string[] = []
              for (let deg = 0; deg <= 360; deg += 2) {
                const v = s.value((deg * Math.PI) / 180)
                pts.push(`${deg === 0 ? 'M' : 'L'}${x(deg).toFixed(1)},${y(v).toFixed(1)}`)
              }
              return <path key={s.id} d={pts.join(' ')} fill="none" stroke={s.color} strokeWidth={2} />
            })}
          </g>
        )
      })}

      {/* shared x axis labels */}
      {[0, 90, 180, 270, 360].map((deg) => (
        <g key={deg}>
          <line x1={x(deg)} x2={x(deg)} y1={M.top} y2={H - M.bottom} stroke={GRID} strokeWidth={1} />
          <text x={x(deg)} y={H - 8} fontSize={10} fill={MUTED} textAnchor="middle" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {deg}°
          </text>
        </g>
      ))}

      {/* legend: every channel, spin entries carry their ratio */}
      {legend.map((s, i) => (
        <g key={s.id} transform={`translate(${M.left + plotW + 10}, ${M.top + 8 + i * 16})`}>
          <rect x={0} y={-7} width={10} height={10} rx={2} fill={s.color} />
          <text x={15} y={2} fontSize={10} fill="#e6e9ee">
            {s.label}
          </text>
        </g>
      ))}

      {/* live crank marker across all panels */}
      <line x1={x(crankDeg)} x2={x(crankDeg)} y1={M.top} y2={H - M.bottom} stroke="#e0a54f" strokeWidth={1.5} />
      {panels.map((panel) =>
        panel.series.map((s) => (
          <circle
            key={s.id}
            cx={x(crankDeg)}
            cy={yOf(panel)(s.value((crankDeg * Math.PI) / 180))}
            r={4}
            fill={s.color}
            stroke="#1a1f27"
            strokeWidth={2}
          />
        )),
      )}

      {/* hover crosshair + tooltip */}
      {hoverDeg !== null && (
        <g pointerEvents="none">
          <line x1={x(hoverDeg)} x2={x(hoverDeg)} y1={M.top} y2={H - M.bottom} stroke={MUTED} strokeWidth={1} strokeDasharray="3 3" />
          {(() => {
            const rows = panels.flatMap((panel) =>
              panel.series.map((s) => ({
                ...s,
                text: `${s.id}: ${s.value((hoverDeg * Math.PI) / 180).toFixed(1)} ${panel.unit}`,
              })),
            )
            const boxW = 148
            const boxH = 18 + rows.length * 15
            const bx = Math.min(x(hoverDeg) + 10, W - M.right - boxW - 4)
            return (
              <g transform={`translate(${bx}, ${M.top + 4})`}>
                <rect width={boxW} height={boxH} rx={6} fill="#222834" stroke={AXIS} />
                <text x={8} y={14} fontSize={10} fill={MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(hoverDeg)}°
                </text>
                {rows.map((s, i) => (
                  <g key={s.id} transform={`translate(8, ${26 + i * 15})`}>
                    <rect x={0} y={-7} width={8} height={8} rx={2} fill={s.color} />
                    <text x={13} y={0} fontSize={10} fill="#e6e9ee" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {s.text}
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
