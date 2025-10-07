import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger } from '../utils/logger.js'
import {
  composeNarrative,
  evaluateAnomaly,
  resolveDirection,
} from './liveAnalyticsShared.js'
import type {
  LiveAnalyticsSnapshot,
  LiveMetric,
  LiveMetricTrendPoint,
} from '../../shared/types/domain.js'
import { liveMetricCatalog } from '../../shared/data/liveAnalytics.js'
import { generateSyntheticSnapshot } from './liveAnalyticsSynthetic.js'
import { getKafkaStreamEvents, isKafkaLiveAnalyticsEnabled } from './liveAnalyticsKafka.js'
import { normalizeRawEvent } from './liveAnalyticsNormalizer.js'
import type { RawStreamEvent, StreamEvent } from './liveAnalyticsTypes.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const TREND_POINTS = 10
const DEFAULT_WINDOW_SECONDS = 120
const CACHE_TTL_MS = 3_000
const STREAM_PATH = process.env.LIVE_ANALYTICS_STREAM_PATH ?? path.resolve(dirname, '../../storage/live-analytics-stream.ndjson')
const STREAM_URL = process.env.LIVE_ANALYTICS_STREAM_URL
const STREAM_POLL_MS = Math.max(2_000, (Number.parseInt(process.env.LIVE_ANALYTICS_STREAM_POLL_SECONDS ?? '', 10) || 15) * 1000)

let cache: { loadedAt: number; snapshot: LiveAnalyticsSnapshot | null } = {
  loadedAt: 0,
  snapshot: null,
}

let remoteStreamCache: { loadedAt: number; events: StreamEvent[] } = {
  loadedAt: 0,
  events: [],
}

export async function getLiveAnalyticsSnapshot(): Promise<LiveAnalyticsSnapshot> {
  const now = Date.now()
  if (cache.snapshot && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.snapshot
  }

  const events = await loadStreamEvents()
  const snapshot = buildSnapshot(events, now)
  cache = { loadedAt: now, snapshot }
  return snapshot
}

async function loadStreamEvents(): Promise<StreamEvent[]> {
  if (isKafkaLiveAnalyticsEnabled()) {
    try {
      const kafkaEvents = await getKafkaStreamEvents()
      if (kafkaEvents.length > 0) {
        return kafkaEvents
      }
    } catch (error) {
      logger.warn({ err: error }, 'live-analytics-kafka-fetch-failed')
    }
  }

  const now = Date.now()

  if (STREAM_URL) {
    if (remoteStreamCache.events.length > 0 && now - remoteStreamCache.loadedAt < STREAM_POLL_MS) {
      return remoteStreamCache.events
    }

    try {
      const response = await fetch(STREAM_URL, {
        headers: {
          Accept: 'application/x-ndjson, application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`upstream responded with ${response.status}`)
      }

      const text = await response.text()
      const events = parseStreamPayload(text)
      if (events.length > 0) {
        remoteStreamCache = { loadedAt: now, events }
        return events
      }
    } catch (error) {
  logger.warn({ err: error }, 'live-analytics-stream-fetch-failed')
    }
  }

  try {
    const raw = await readFile(STREAM_PATH, 'utf8')
    const events = parseStreamPayload(raw)
    return events
  } catch (error) {
  logger.warn({ err: error }, 'live-analytics-stream-read-failed')
    return []
  }
}

function parseStreamPayload(payload: string): StreamEvent[] {
  const lines = payload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 1) {
    try {
      const parsed = JSON.parse(lines[0])
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => normalizeRawEvent(item as RawStreamEvent))
          .filter((value): value is StreamEvent => value !== null)
      }
    } catch (error) {
  logger.warn({ err: error }, 'live-analytics-stream-json-parse-failed')
    }
  }

  const events: StreamEvent[] = []
  for (const line of lines) {
    const item = safeJsonParse(line)
    const normalized = item && normalizeRawEvent(item)
    if (normalized) {
      events.push(normalized)
    }
  }

  return events
}

function safeJsonParse(line: string): RawStreamEvent | null {
  try {
    return JSON.parse(line) as RawStreamEvent
  } catch {
    return null
  }
}

function buildSnapshot(events: StreamEvent[], now: number): LiveAnalyticsSnapshot {
  const windowSeconds = Number.parseInt(process.env.LIVE_ANALYTICS_WINDOW_SECONDS ?? '', 10) || DEFAULT_WINDOW_SECONDS
  const fallback = generateSyntheticSnapshot(windowSeconds)
  const fallbackById = new Map<string, LiveMetric>(
    fallback.metrics.map((metric: LiveMetric) => [metric.id, metric] as const),
  )

  if (events.length === 0) {
    return fallback
  }

  const grouped = new Map<string, StreamEvent[]>()
  for (const event of events) {
    const bucket = grouped.get(event.metricId)
    if (!bucket) {
      grouped.set(event.metricId, [event])
    } else {
      bucket.push(event)
    }
  }

  let globalLatest = 0
  let globalEarliest = now

  const metrics = liveMetricCatalog.map<LiveMetric>((metadata) => {
    const group = grouped.get(metadata.id)
    if (!group || group.length === 0) {
      return fallbackById.get(metadata.id)!
    }

    const sorted = group.sort((a, b) => a.timestamp - b.timestamp)
    const latestTimestamp = sorted.at(-1)!.timestamp
    const windowStart = latestTimestamp - windowSeconds * 1000
    const clipped = sorted.filter((event) => event.timestamp >= windowStart)
    const trendEvents = clipped.slice(-TREND_POINTS)

    if (latestTimestamp > globalLatest) {
      globalLatest = latestTimestamp
    }
    if (trendEvents[0]) {
      globalEarliest = Math.min(globalEarliest, trendEvents[0].timestamp)
    }

    const latestValue = trendEvents.at(-1)?.value ?? sorted.at(-1)!.value
    const previousValue = trendEvents.length >= 2 ? trendEvents.at(-2)!.value : latestValue
    const delta = Math.round((latestValue - previousValue) * 100) / 100

    const trend: LiveMetricTrendPoint[] = trendEvents.map((event) => ({
      timestamp: new Date(event.timestamp).toISOString(),
      value: Math.round(event.value * 100) / 100,
    }))

    const thresholds = metadata.thresholds
    const anomaly = evaluateAnomaly(latestValue, thresholds)

    return {
      id: metadata.id,
      label: metadata.label,
      unit: metadata.unit,
      format: metadata.format,
      value: Math.round(latestValue * 100) / 100,
      delta,
      direction: resolveDirection(delta),
      trend,
      thresholds,
      anomaly,
    }
  })

  const generatedAt = globalLatest > 0 ? new Date(globalLatest).toISOString() : fallback.generatedAt
  const derivedWindow = globalLatest > 0 ? Math.max(1, Math.round((globalLatest - globalEarliest) / 1000)) : fallback.windowSeconds
  const narrative = composeNarrative(metrics)

  return {
    generatedAt,
    windowSeconds: derivedWindow,
    metrics,
    narrative,
  }
}