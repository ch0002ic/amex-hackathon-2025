import { liveMetricDefinitions, liveMetricMetadataById, type LiveMetricDefinition } from '../data/liveAnalytics.js'
import type {
  LiveAnalyticsSnapshot,
  LiveMetric,
  LiveMetricTrendDirection,
  LiveMetricTrendPoint,
} from '../types/domain.js'
import { evaluateAnomaly } from '../../server/services/liveAnalyticsShared.js'

const TREND_POINTS = 8
const TICK_INTERVAL_SECONDS = 15

function toSeed(id: string): number {
  let hash = 0
  for (const char of id) {
    hash = Math.imul(31, hash) + char.charCodeAt(0)
  }
  return Math.abs(hash)
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function computeValue(definition: LiveMetricDefinition, tick: number, seed: number): number {
  const sinusoid = definition.amplitude * Math.sin((tick + (definition.phase ?? 0)) / definition.wavePeriod)
  const noise = (pseudoRandom(seed + tick) - 0.5) * 2 * definition.volatility
  const directionalBias = (() => {
    if (!definition.directionBias) {
      return 0
    }

    const biasAmplitude = definition.amplitude * 0.12
    const modifier = Math.sin((tick + seed) / (definition.wavePeriod * 4)) * biasAmplitude
    return definition.directionBias === 'up' ? Math.abs(modifier) : -Math.abs(modifier)
  })()

  const total = definition.baseline + sinusoid + noise + directionalBias
  const bounded = definition.floor !== undefined ? Math.max(definition.floor, total) : total
  return Math.round(bounded * 100) / 100
}

function resolveDirection(
  delta: number,
  baseline: number,
  bias?: LiveMetricTrendDirection,
): LiveMetricTrendDirection {
  const threshold = Math.max(baseline * 0.001, 0.25)
  if (Math.abs(delta) < threshold) {
    return bias ?? 'steady'
  }
  return delta > 0 ? 'up' : 'down'
}

function buildTrend(
  definition: LiveMetricDefinition,
  baseTick: number,
  seed: number,
  issuedAt: number,
): LiveMetricTrendPoint[] {
  const points: LiveMetricTrendPoint[] = []
  for (let index = TREND_POINTS - 1; index >= 0; index -= 1) {
    const pointTick = baseTick - (TREND_POINTS - 1 - index)
    const value = computeValue(definition, pointTick, seed)
    const timestamp = new Date(issuedAt - (TREND_POINTS - 1 - index) * TICK_INTERVAL_SECONDS * 1000)
    points.push({ timestamp: timestamp.toISOString(), value })
  }
  return points
}

function formatNarrative(metrics: LiveMetric[]): string {
  const definitionById = new Map(liveMetricDefinitions.map((definition) => [definition.id, definition]))

  const ranked = metrics
    .map((metric) => {
      const previous = metric.trend.at(-2)?.value ?? metric.value
      const change = previous === 0 ? 0 : ((metric.value - previous) / previous) * 100
      return { metric, change }
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 2)

  const phrases = ranked.map(({ metric, change }) => {
    const definition = definitionById.get(metric.id)
    const absoluteChange = Math.abs(change)
    const formattedChange = absoluteChange < 0.1 ? absoluteChange.toFixed(2) : absoluteChange.toFixed(1)
    const isImproving = definition?.directionBias === 'down' ? change < 0 : change > 0
  const adjective = isImproving ? 'improved' : change > 0 ? 'climbed' : 'softened'
    const focus = definition?.narrativeFocus ?? metric.label.toLowerCase()
  const direction = metric.direction === 'down' ? 'down' : metric.direction === 'steady' ? 'flat' : 'up'
    return `${metric.label} ${adjective} ${formattedChange}% (${direction}) for ${focus}`
  })

  return phrases.length > 0
    ? `Live telemetry ${phrases.join(' while ')}.`
    : 'Live telemetry steady across monitored signals.'
}

export async function getLiveAnalyticsSnapshot(): Promise<LiveAnalyticsSnapshot> {
  const issuedAt = Date.now()
  const tick = Math.floor(issuedAt / (TICK_INTERVAL_SECONDS * 1000))

  const metrics: LiveMetric[] = liveMetricDefinitions.map((definition) => {
    const seed = toSeed(definition.id)
    const trend = buildTrend(definition, tick, seed, issuedAt)
    const latest = trend.at(-1)?.value ?? definition.baseline
    const prev = trend.at(-2)?.value ?? latest
    const delta = Math.round((latest - prev) * 100) / 100
    const direction = resolveDirection(delta, definition.baseline, definition.directionBias)
    const metadata = liveMetricMetadataById.get(definition.id)
    const thresholds = metadata?.thresholds
    const anomaly = evaluateAnomaly(latest, thresholds)

    return {
      id: definition.id,
      label: definition.label,
      unit: definition.unit,
      format: definition.format,
      value: latest,
      delta,
      direction,
      trend,
      thresholds,
      anomaly,
    }
  })

  return {
    generatedAt: new Date(issuedAt).toISOString(),
    windowSeconds: (TREND_POINTS - 1) * TICK_INTERVAL_SECONDS,
    metrics,
    narrative: formatNarrative(metrics),
  }
}
