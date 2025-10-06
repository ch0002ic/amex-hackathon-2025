import { liveMetricCatalog, liveMetricDefinitions, liveMetricMetadataById, type LiveMetricDefinition } from '../../shared/data/liveAnalytics.js'
import type { LiveAnalyticsSnapshot, LiveMetric, LiveMetricTrendPoint } from '../../shared/types/domain.js'
import { evaluateAnomaly, resolveDirection, composeNarrative } from './liveAnalyticsShared.js'

const TREND_POINTS = 10
const syntheticById = new Map(liveMetricDefinitions.map((definition) => [definition.id, definition]))

export function generateSyntheticSnapshot(windowSeconds: number): LiveAnalyticsSnapshot {
  const issuedAt = Date.now()
  const tick = Math.floor(issuedAt / 15_000)

  const metrics: LiveMetric[] = liveMetricCatalog.map((metadata) => {
    const definition = syntheticById.get(metadata.id)
    if (!definition) {
      return buildStaticMetric(metadata.id)
    }

    const trend = buildTrend(definition, tick, issuedAt)
    const latest = trend.at(-1)?.value ?? definition.baseline
    const previous = trend.at(-2)?.value ?? latest
    const delta = Math.round((latest - previous) * 100) / 100

    const thresholds = metadata.thresholds
    const anomaly = evaluateAnomaly(latest, thresholds)

    return {
      id: metadata.id,
      label: metadata.label,
      unit: metadata.unit,
      format: metadata.format,
      value: Math.round(latest * 100) / 100,
      delta,
      direction: resolveDirection(delta),
      trend,
      thresholds,
      anomaly,
    }
  })

  return {
    generatedAt: new Date(issuedAt).toISOString(),
    windowSeconds,
    metrics,
    narrative: composeNarrative(metrics),
  }
}

function buildTrend(definition: LiveMetricDefinition, tick: number, issuedAt: number): LiveMetricTrendPoint[] {
  const points: LiveMetricTrendPoint[] = []
  for (let index = TREND_POINTS - 1; index >= 0; index -= 1) {
    const currentTick = tick - (TREND_POINTS - 1 - index)
    const value = computeValue(definition, currentTick)
    const timestamp = new Date(issuedAt - (TREND_POINTS - 1 - index) * 15_000)
    points.push({ timestamp: timestamp.toISOString(), value: Math.round(value * 100) / 100 })
  }
  return points
}

function computeValue(definition: LiveMetricDefinition, tick: number): number {
  const sinusoid = definition.amplitude * Math.sin((tick + (definition.phase ?? 0)) / definition.wavePeriod)
  const random = (pseudoRandom(tick) - 0.5) * 2 * definition.volatility
  const directionalBias = (() => {
    if (!definition.directionBias) {
      return 0
    }

    const biasAmplitude = definition.amplitude * 0.12
    const modifier = Math.sin((tick + 11) / (definition.wavePeriod * 4)) * biasAmplitude
    return definition.directionBias === 'up' ? Math.abs(modifier) : -Math.abs(modifier)
  })()

  const total = definition.baseline + sinusoid + random + directionalBias
  const bounded = definition.floor !== undefined ? Math.max(definition.floor, total) : total
  return bounded
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function buildStaticMetric(id: string): LiveMetric {
  const metadata = liveMetricMetadataById.get(id)
  if (!metadata) {
    return {
      id,
      label: id,
      unit: '',
      format: 'count',
      value: 0,
      delta: 0,
      direction: 'steady',
      trend: [],
      thresholds: undefined,
      anomaly: {
        status: 'ok',
        breachedThreshold: undefined,
        thresholdValue: undefined,
        message: 'No data',
        magnitude: 0,
      },
    }
  }

  const anomaly = evaluateAnomaly(0, metadata.thresholds)

  return {
    id: metadata.id,
    label: metadata.label,
    unit: metadata.unit,
    format: metadata.format,
    value: 0,
    delta: 0,
    direction: 'steady',
    trend: [],
    thresholds: metadata.thresholds,
    anomaly,
  }
}
