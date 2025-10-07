import { refreshPartnerSignalBacklogMetrics } from './partnerSignals.js'
import { logger } from '../utils/logger.js'

const defaultInterval = Math.max(30_000, Number.parseInt(process.env.METRICS_REFRESH_INTERVAL_MS ?? '60000', 10))

let timer: NodeJS.Timeout | null = null

export function startMetricsSchedulers(): void {
  if (process.env.NODE_ENV === 'test' || timer) {
    return
  }

  void runRefresh()

  timer = setInterval(() => {
    void runRefresh()
  }, defaultInterval)

  if (typeof timer.unref === 'function') {
    timer.unref()
  }
}

export function stopMetricsSchedulers(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

async function runRefresh(): Promise<void> {
  try {
    await refreshPartnerSignalBacklogMetrics()
  } catch (error) {
    logger.warn({ err: error }, 'metrics-scheduler-refresh-failed')
  }
}
