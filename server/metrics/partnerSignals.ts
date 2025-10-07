import { Gauge, Histogram } from 'prom-client'
import { dbPool } from '../db/client.js'
import { logger } from '../utils/logger.js'
import { metricsRegistry } from './registry.js'

const sloTargetMinutes = Math.max(1, Number.parseInt(process.env.PARTNER_SIGNAL_SLO_TARGET_MINUTES ?? '60', 10))
const lookbackMinutes = Number.parseInt(process.env.PARTNER_SIGNAL_METRICS_LOOKBACK_MINUTES ?? String(6 * 60), 10)
const histogramBuckets = (process.env.PARTNER_SIGNAL_LATENCY_BUCKETS ?? '60,120,300,600,900,1800,3600,7200,14400,28800,86400')
  .split(',')
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isFinite(value) && value > 0)

const pendingGauge = new Gauge({
  name: 'partner_signal_pending_total',
  help: 'Number of partner signals awaiting review',
  registers: [metricsRegistry],
})

const pendingP95Gauge = new Gauge({
  name: 'partner_signal_pending_p95_age_minutes',
  help: '95th percentile age (in minutes) of pending partner signals',
  registers: [metricsRegistry],
})

const sloBreachGauge = new Gauge({
  name: 'partner_signal_latency_slo_breach_total',
  help: 'Count of partner signals breaching the latency SLO threshold',
  registers: [metricsRegistry],
})

const sloTargetGauge = new Gauge({
  name: 'partner_signal_latency_slo_target_minutes',
  help: 'Configured SLO threshold (in minutes) for partner signal moderation latency',
  registers: [metricsRegistry],
})

const reviewLatencyHistogram = new Histogram({
  name: 'partner_signal_review_latency_seconds',
  help: 'Histogram of partner signal review latency (submission to resolution)',
  buckets: histogramBuckets.length > 0 ? histogramBuckets : undefined,
  registers: [metricsRegistry],
})

sloTargetGauge.set(sloTargetMinutes)

interface PartnerSignalMetricsSnapshot {
  pendingTotal: number
  pendingP95Minutes: number
  sloBreachTotal: number
}

let snapshot: PartnerSignalMetricsSnapshot = {
  pendingTotal: 0,
  pendingP95Minutes: 0,
  sloBreachTotal: 0,
}

export async function refreshPartnerSignalBacklogMetrics(): Promise<void> {
  try {
    const result = await dbPool.query<{
      status: string
      submitted_at: string | Date
    }>(
      `SELECT status,
              submitted_at
         FROM partner_signals`,
    )

    const pendingAges: number[] = []
    const now = Date.now()

    for (const row of result.rows) {
      if (row.status === 'pending') {
        const submittedAt = new Date(row.submitted_at).getTime()
        if (!Number.isNaN(submittedAt)) {
          const ageMinutes = (now - submittedAt) / 1000 / 60
            if (Number.isFinite(ageMinutes) && ageMinutes >= 0 && ageMinutes <= lookbackMinutes) {
            pendingAges.push(ageMinutes)
          }
        }
      }
    }

    const pendingTotal = pendingAges.length
    const pendingP95Minutes = pendingTotal > 0 ? computePercentile(pendingAges, 0.95) : 0
    const sloBreachTotal = pendingAges.filter((age) => age > sloTargetMinutes).length

    snapshot = {
      pendingTotal,
      pendingP95Minutes,
      sloBreachTotal,
    }

    pendingGauge.set(pendingTotal)
    pendingP95Gauge.set(pendingP95Minutes)
    sloBreachGauge.set(sloBreachTotal)
  } catch (error) {
    logger.warn({ err: error }, 'partner-signal-metrics-refresh-failed')
  }
}

export function observePartnerSignalReviewLatency(durationMs: number): void {
  const seconds = durationMs / 1000
  if (Number.isFinite(seconds) && seconds >= 0) {
    reviewLatencyHistogram.observe(seconds)
  }
}

export function getPartnerSignalMetricsSnapshot(): PartnerSignalMetricsSnapshot {
  return { ...snapshot }
}

export function getPartnerSignalSloThresholdMinutes(): number {
  return sloTargetMinutes
}

function computePercentile(values: number[], percentile: number): number {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentile * sorted.length) - 1))
  return sorted[rank]
}
