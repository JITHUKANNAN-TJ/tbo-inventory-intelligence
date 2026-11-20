import { useEffect, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DemandPoint } from '../lib/analytics'

/** Shared chart colors — kept in sync with tailwind.config.js and index.css. */
const CHART_COLOR = {
  brand: '#3B5BDB',
  brandLight: '#6C84EE',
  brandDark: '#2B43A6',
  ink: '#16202C',
  inkDeep: '#0C1520',
  grid: '#E2E8F0',
  tick: '#94A3B8',
} as const

function useChartAnimation() {
  const [animate, setAnimate] = useState(true)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setAnimate(false)
  }, [])
  return animate
}

const axisProps = {
  tick: { fill: CHART_COLOR.tick, fontSize: 10 },
  tickLine: false,
  axisLine: false,
} as const

function compactTick(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${Math.round(value / 1000)}K`
  return String(value)
}

function DemandTooltip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number | null; dataKey?: string | number }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  const values = new Map(payload.map((entry) => [String(entry.dataKey), entry.value]))
  const actual = values.get('actual')
  const forecast = values.get('forecast')
  const low = values.get('low')
  const high = values.get('high')

  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-2xs shadow-pop">
      <p className="mb-1 font-semibold text-ink">Week of {label}</p>
      {typeof actual === 'number' ? (
        <p className="text-ink-muted">
          Actual <span className="font-medium text-ink">{Math.round(actual).toLocaleString('en-IN')} units</span>
        </p>
      ) : null}
      {typeof forecast === 'number' ? (
        <p className="text-ink-muted">
          Forecast <span className="font-medium text-brand">{Math.round(forecast).toLocaleString('en-IN')} units</span>
        </p>
      ) : null}
      {typeof low === 'number' && typeof high === 'number' ? (
        <p className="mt-0.5 text-ink-muted">
          Range {Math.round(low).toLocaleString('en-IN')} – {Math.round(high).toLocaleString('en-IN')}
        </p>
      ) : null}
    </div>
  )
}

export function DemandChart({ data, height = 240 }: { data: DemandPoint[]; height?: number }) {
  const animate = useChartAnimation()
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="demand-confidence" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLOR.brand} stopOpacity={0.16} />
              <stop offset="100%" stopColor={CHART_COLOR.brandLight} stopOpacity={0.015} />
            </linearGradient>
            <linearGradient id="demand-forecast" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={CHART_COLOR.brandDark} />
              <stop offset="100%" stopColor={CHART_COLOR.brandLight} />
            </linearGradient>
            <linearGradient id="demand-actual" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={CHART_COLOR.inkDeep} />
              <stop offset="100%" stopColor={CHART_COLOR.ink} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_COLOR.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" {...axisProps} interval={1} dy={6} />
          <YAxis {...axisProps} tickFormatter={compactTick} width={54} />
          <Tooltip content={<DemandTooltip />} cursor={{ stroke: CHART_COLOR.tick, strokeDasharray: '3 3' }} />
          <Area type="monotone" dataKey="high" stroke="none" fill="url(#demand-confidence)" isAnimationActive={animate}
            animationDuration={850}
            animationEasing="ease-out" />
          <Area type="monotone" dataKey="low" stroke="none" fill="#FFFFFF" fillOpacity={1} isAnimationActive={animate}
            animationDuration={850}
            animationEasing="ease-out" />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="url(#demand-actual)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={animate}
            animationDuration={850}
            animationEasing="ease-out"
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="url(#demand-forecast)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={animate}
            animationDuration={850}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ChartLegend({ showForecast = true }: { showForecast?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-2xs text-ink-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded bg-ink" /> Actual
      </span>
      {showForecast ? (
        <>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-brand" style={{ backgroundImage: `repeating-linear-gradient(90deg,${CHART_COLOR.brand} 0 5px,transparent 5px 9px)` }} /> Forecast
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded bg-brand/10" /> Confidence range
          </span>
        </>
      ) : null}
    </div>
  )
}

export function RateHistoryChart({ data, height = 200 }: { data: { month: string; rate: number }[]; height?: number }) {
  const animate = useChartAnimation()
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="rate-history" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={CHART_COLOR.brandDark} />
              <stop offset="100%" stopColor={CHART_COLOR.brandLight} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_COLOR.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" {...axisProps} dy={6} />
          <YAxis {...axisProps} tickFormatter={compactTick} width={54} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: `1px solid ${CHART_COLOR.grid}`, fontSize: 11, boxShadow: '0 12px 32px rgba(22,32,44,.14)' }}
            formatter={(value: number) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Average rate']}
            labelFormatter={(label) => `Month ${label}`}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="url(#rate-history)"
            strokeWidth={2}
            dot={{ r: 2, fill: CHART_COLOR.brand }}
            activeDot={{ r: 4 }}
            isAnimationActive={animate}
            animationDuration={850}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
