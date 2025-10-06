import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchLiveAnalyticsSnapshot } from '../api/mockApi'
import { withWebSpan } from '../telemetry/spans'
import type { LiveAnalyticsSnapshot, LiveMetric } from '../types'
import './LiveAnalytics.css'

const REFRESH_INTERVAL_MS = 12_000

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 1,
})

const currencyCompactFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

const numberCompactFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const decimalFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
})

function formatWindow(windowSeconds: number): string {
  const minutes = Math.floor(windowSeconds / 60)
  const seconds = windowSeconds % 60
  if (minutes > 0 && seconds > 0) {
    return `${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m`
  }
  return `${seconds}s`
}

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) {
    return 'pending update'
  }
  const issuedAt = new Date(timestamp).getTime()
  const diffMs = Date.now() - issuedAt
  if (diffMs < 5_000) {
    return 'just now'
  }
  if (diffMs < 60_000) {
    return `${Math.round(diffMs / 1000)}s ago`
  }
  if (diffMs < 3_600_000) {
    return `${Math.floor(diffMs / 60_000)}m ago`
  }
  return `${Math.floor(diffMs / 3_600_000)}h ago`
}

function formatValue(metric: LiveMetric, value: number): string {
  switch (metric.format) {
    case 'currency': {
      const [, cadence] = metric.unit.split('/')
      const base = currencyFormatter.format(value)
      return cadence ? `${base} / ${cadence}` : base
    }
    case 'percentage':
      return `${decimalFormatter.format(value)} ${metric.unit}`.trim()
    case 'duration':
      return `${Math.round(value)} ${metric.unit}`
    default:
      return `${numberFormatter.format(value)} ${metric.unit}`.trim()
  }
}

function formatMetricValue(metric: LiveMetric): string {
  return formatValue(metric, metric.value)
}

function formatMetricDelta(metric: LiveMetric): string {
  const absolute = Math.abs(metric.delta)
  const prefix = metric.delta > 0 ? '+' : metric.delta < 0 ? '-' : ''
  if (absolute === 0) {
    return 'flat vs prior'
  }

  switch (metric.format) {
    case 'currency':
      return `${prefix}${currencyCompactFormatter.format(absolute)} vs prior`
    case 'percentage':
      return `${prefix}${decimalFormatter.format(absolute)} ${metric.unit}`.trim() + ' vs prior'
    case 'duration':
      return `${prefix}${Math.round(absolute)} ${metric.unit} vs prior`
    default:
      return `${prefix}${numberCompactFormatter.format(absolute)} ${metric.unit}`.trim() + ' vs prior'
  }
}

function describeThresholds(metric: LiveMetric): string | null {
  if (!metric.thresholds) {
    return null
  }

  const { upperCritical, upperWarning, lowerCritical, lowerWarning } = metric.thresholds
  const segments: string[] = []

  if (upperCritical !== undefined) {
    segments.push(`Critical ≥ ${formatValue(metric, upperCritical)}`)
  }
  if (upperWarning !== undefined) {
    segments.push(`Watch ≥ ${formatValue(metric, upperWarning)}`)
  }
  if (lowerCritical !== undefined) {
    segments.push(`Critical ≤ ${formatValue(metric, lowerCritical)}`)
  }
  if (lowerWarning !== undefined) {
    segments.push(`Watch ≤ ${formatValue(metric, lowerWarning)}`)
  }

  return segments.length > 0 ? segments.join(' · ') : null
}

function anomalyLabel(status: 'ok' | 'warning' | 'critical'): string {
  switch (status) {
    case 'critical':
      return 'Critical'
    case 'warning':
      return 'Watch'
    default:
      return 'Nominal'
  }
}

function buildSparklinePoints(metric: LiveMetric): string {
  if (metric.trend.length === 0) {
    return ''
  }

  if (metric.trend.length === 1) {
    return `0,20 100,20`
  }

  const values = metric.trend.map((point) => point.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1

  return metric.trend
    .map((point, index) => {
      const x = (index / (metric.trend.length - 1)) * 100
      const normalized = (point.value - min) / range
      const y = 40 - normalized * 36 - 2
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

interface RenderMetricProps {
  metric: LiveMetric
  windowLabel: string
}

function RenderMetric({ metric, windowLabel }: RenderMetricProps) {
  const sparkline = useMemo(() => buildSparklinePoints(metric), [metric])
  const deltaLabel = formatMetricDelta(metric)
  const directionClass = `live-analytics__delta live-analytics__delta--${metric.direction}`

  const anomalyStatus = metric.anomaly?.status ?? 'ok'
  const cardClass = `live-analytics__card live-analytics__card--${anomalyStatus}`
  const anomalyMessage = metric.anomaly?.message ?? 'Within healthy band'
  const thresholds = describeThresholds(metric)

  return (
    <article className={cardClass}>
      <header>
        <h3>{metric.label}</h3>
        <p>{windowLabel} moving window</p>
      </header>
      <div className="live-analytics__value">{formatMetricValue(metric)}</div>
      <div className={directionClass}>{deltaLabel}</div>
      <div className={`live-analytics__anomaly live-analytics__anomaly--${anomalyStatus}`}>
        <span className="live-analytics__anomaly-pill">{anomalyLabel(anomalyStatus)}</span>
        <span>{anomalyMessage}</span>
      </div>
      {thresholds ? <div className="live-analytics__thresholds">{thresholds}</div> : null}
      <svg className="live-analytics__sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" role="presentation">
        <polyline points={sparkline} />
      </svg>
    </article>
  )
}

export function LiveAnalytics() {
  const [snapshot, setSnapshot] = useState<LiveAnalyticsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<number | undefined>(undefined)
  const mountedRef = useRef(true)

  const fetchSnapshot = useCallback(
    async (showSpinner = false) => {
      if (!mountedRef.current) {
        return
      }

      if (showSpinner) {
        setLoading(true)
      }

      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = undefined
      }

      try {
        const next = await withWebSpan(
          'ui.live_analytics.refresh',
          () => fetchLiveAnalyticsSnapshot(),
          {
            attributes: {
              'ui.component': 'LiveAnalytics',
              'ui.operation': showSpinner ? 'manual-retry' : 'scheduled-refresh',
            },
          },
        )
        if (!mountedRef.current) {
          return
        }
        setSnapshot(next)
        setError(null)
        setLoading(false)
      } catch (err) {
        if (!mountedRef.current) {
          return
        }
        const message = err instanceof Error ? err.message : 'Unable to load live analytics'
        setError(message)
        setLoading(false)
      } finally {
        if (!mountedRef.current) {
          return
        }
        timeoutRef.current = window.setTimeout(() => {
          void fetchSnapshot()
        }, REFRESH_INTERVAL_MS)
      }
    },
    [],
  )

  useEffect(() => {
    mountedRef.current = true
    void fetchSnapshot(true)

    return () => {
      mountedRef.current = false
      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [fetchSnapshot])

  const handleRetry = () => {
    void fetchSnapshot(true)
  }

  const windowLabel = snapshot ? formatWindow(snapshot.windowSeconds) : 'rolling'
  const generatedAt = snapshot?.generatedAt ?? null
  const relativeIssued = formatRelativeTime(generatedAt)

  return (
    <div className="live-analytics">
      <div className="live-analytics__meta">
        <span className="live-analytics__meta-dot" aria-hidden="true" />
        <span>Streaming instrumentation</span>
        <span aria-live="polite">Updated {relativeIssued}</span>
      </div>

      {error ? (
        <div className="live-analytics__error">
          <p>{error}</p>
          <button type="button" onClick={handleRetry}>
            Retry feed
          </button>
        </div>
      ) : null}

      {loading && !snapshot ? (
        <div className="live-analytics__loading">Connecting to telemetry feed…</div>
      ) : null}

      {snapshot ? (
        <>
          <p className="live-analytics__narrative">{snapshot.narrative}</p>
          <div className="live-analytics__grid">
            {snapshot.metrics.map((metric) => (
              <RenderMetric key={metric.id} metric={metric} windowLabel={windowLabel} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
