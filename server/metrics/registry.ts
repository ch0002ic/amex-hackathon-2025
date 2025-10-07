import { Registry, collectDefaultMetrics } from 'prom-client'

const defaultPrefix = process.env.METRICS_PREFIX ?? 'ecosystem_'

export const metricsRegistry = new Registry()

collectDefaultMetrics({
  register: metricsRegistry,
  prefix: defaultPrefix,
})
