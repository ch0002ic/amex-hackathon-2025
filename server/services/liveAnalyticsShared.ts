import { liveMetricMetadataById } from '../../shared/data/liveAnalytics.js'
import type {
  LiveMetric,
  LiveMetricAnomaly,
  LiveMetricThresholds,
  LiveMetricTrendDirection,
} from '../../shared/types/domain.js'

const EPSILON = 0.0001

export function resolveDirection(delta: number): LiveMetricTrendDirection {
  if (Math.abs(delta) <= EPSILON) {
    return 'steady'
  }

  return delta > 0 ? 'up' : 'down'
}

export function evaluateAnomaly(value: number, thresholds?: LiveMetricThresholds): LiveMetricAnomaly {
  if (!thresholds) {
    return {
      status: 'ok',
      breachedThreshold: undefined,
      thresholdValue: undefined,
      message: 'No guardrails configured',
      magnitude: 0,
    }
  }

  const { upperCritical, upperWarning, lowerCritical, lowerWarning } = thresholds

  if (upperCritical !== undefined && value >= upperCritical) {
    return {
      status: 'critical',
      breachedThreshold: 'upper',
      thresholdValue: upperCritical,
      message: `Above critical ceiling (${formatNumber(upperCritical)})`,
      magnitude: roundMagnitude(value - upperCritical),
    }
  }

  if (lowerCritical !== undefined && value <= lowerCritical) {
    return {
      status: 'critical',
      breachedThreshold: 'lower',
      thresholdValue: lowerCritical,
      message: `Below critical floor (${formatNumber(lowerCritical)})`,
      magnitude: roundMagnitude(lowerCritical - value),
    }
  }

  if (upperWarning !== undefined && value >= upperWarning) {
    return {
      status: 'warning',
      breachedThreshold: 'upper',
      thresholdValue: upperWarning,
      message: `Tracking above watch band (${formatNumber(upperWarning)})`,
      magnitude: roundMagnitude(value - upperWarning),
    }
  }

  if (lowerWarning !== undefined && value <= lowerWarning) {
    return {
      status: 'warning',
      breachedThreshold: 'lower',
      thresholdValue: lowerWarning,
      message: `Tracking below watch band (${formatNumber(lowerWarning)})`,
      magnitude: roundMagnitude(lowerWarning - value),
    }
  }

  const closest = determineClosestThreshold(value, thresholds)

  return {
    status: 'ok',
    breachedThreshold: undefined,
    thresholdValue: closest?.value,
    message: closest
      ? `Within healthy band (±${formatNumber(closest.gap)})`
      : 'Within healthy band',
    magnitude: closest?.gap ?? 0,
  }
}

export function composeNarrative(metrics: LiveMetric[]): string {
  const bySeverity = [...metrics].sort((a, b) => severityScore(b) - severityScore(a))
  const primary = bySeverity[0]
  const secondary = bySeverity.find((metric) => metric.id !== primary.id)

  if (!primary) {
    return 'Live telemetry steady across monitored signals.'
  }

  const primaryFocus = liveMetricMetadataById.get(primary.id)?.narrativeFocus ?? primary.label.toLowerCase()
  const primaryPhrase = buildPhrase(primary, primaryFocus)

  if (!secondary) {
    return `Live telemetry ${primaryPhrase}.`
  }

  const secondaryFocus = liveMetricMetadataById.get(secondary.id)?.narrativeFocus ?? secondary.label.toLowerCase()
  const secondaryPhrase = buildPhrase(secondary, secondaryFocus)

  return `Live telemetry ${primaryPhrase} while ${secondaryPhrase}.`
}

function buildPhrase(metric: LiveMetric, focus: string): string {
  const directionWord = metric.direction === 'down' ? 'softened' : metric.direction === 'steady' ? 'held steady' : 'climbed'
  const anomaly = metric.anomaly
  if (anomaly && anomaly.status !== 'ok') {
    const severity = anomaly.status === 'critical' ? 'triggered' : 'nudged'
    const bound = anomaly.thresholdValue !== undefined ? formatNumber(anomaly.thresholdValue) : ''
    const boundary = anomaly.breachedThreshold === 'lower' ? 'floor' : 'ceiling'
    const descriptor = bound ? `${bound} ${metric.unit}`.trim() : 'threshold'
    return `${severity} the ${boundary} (${descriptor}) for ${focus}`
  }

  const change = formatNumber(Math.abs(metric.delta))
  return `${directionWord} ${change}${metric.unit ? ` ${metric.unit}` : ''} for ${focus}`.trim()
}

function severityScore(metric: LiveMetric): number {
  const anomaly = metric.anomaly
  if (!anomaly) {
    return Math.abs(metric.delta)
  }

  const statusScore = anomaly.status === 'critical' ? 1000 : anomaly.status === 'warning' ? 500 : 0
  return statusScore + anomaly.magnitude + Math.abs(metric.delta)
}

function determineClosestThreshold(value: number, thresholds: LiveMetricThresholds): { value: number; gap: number } | undefined {
  const candidates = [
    thresholds.upperWarning,
    thresholds.upperCritical,
    thresholds.lowerWarning,
    thresholds.lowerCritical,
  ].filter((candidate): candidate is number => candidate !== undefined)

  if (candidates.length === 0) {
    return undefined
  }

  const diffs = candidates.map((candidate) => ({ value: candidate, gap: Math.abs(candidate - value) }))
  return diffs.sort((a, b) => a.gap - b.gap)[0]
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }

  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }

  if (Number.isInteger(value)) {
    return value.toString()
  }

  return value.toFixed(1)
}

function roundMagnitude(value: number): number {
  return Math.round(Math.abs(value) * 100) / 100
}
