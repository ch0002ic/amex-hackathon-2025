import { liveMetricMetadataById } from '../../shared/data/liveAnalytics.js'
import type { RawStreamEvent, StreamEvent } from './liveAnalyticsTypes.js'

export function normalizeRawEvent(parsed: RawStreamEvent | null): StreamEvent | null {
  if (!parsed) {
    return null
  }

  const candidate = parsed as RawStreamEvent & Record<string, unknown>
  const metricId = coerceString(candidate.metricId) ?? coerceString(candidate.metric_id) ?? coerceString(candidate.metricID)
  if (!metricId) {
    return null
  }

  const metadata = liveMetricMetadataById.get(metricId)
  if (!metadata) {
    return null
  }

  let timestamp: number | null = coerceTimestamp(candidate.timestamp)
  if (!timestamp) {
    timestamp = coerceTimestamp(candidate.timestampMs)
  }
  if (!timestamp) {
    timestamp = coerceTimestamp(candidate.timestamp_ms)
  }
  if (!timestamp) {
    timestamp = coerceTimestamp(candidate.eventTime)
  }

  if (!timestamp) {
    return null
  }

  const numericValueCandidate =
    coerceNumber(candidate.value) ?? coerceNumber(candidate.metricValue) ?? coerceNumber(candidate.valueNumeric)

  if (numericValueCandidate === null || !Number.isFinite(numericValueCandidate)) {
    return null
  }

  return {
    metricId,
    timestamp,
    value: numericValueCandidate,
  }
}

function coerceString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value
  }

  return null
}

function coerceTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.length > 0) {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  return null
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}
