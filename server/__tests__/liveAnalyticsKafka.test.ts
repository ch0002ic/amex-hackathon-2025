import { beforeEach, describe, expect, it, vi } from 'vitest'

let getKafkaStreamEvents: typeof import('../services/liveAnalyticsKafka.js').getKafkaStreamEvents
let ingestKafkaEventForTesting: typeof import('../services/liveAnalyticsKafka.js').ingestKafkaEventForTesting
let resetKafkaBuffersForTesting: typeof import('../services/liveAnalyticsKafka.js').resetKafkaBuffersForTesting
let processKafkaBufferForTesting: typeof import('../services/liveAnalyticsKafka.js').processKafkaBufferForTesting

interface LoadOptions {
  schemaDecodedPayload?: unknown
}

async function loadModule(options: LoadOptions = {}) {
  vi.resetModules()

  if (options.schemaDecodedPayload !== undefined) {
    vi.doMock('../services/liveAnalyticsSchemaRegistry.js', () => ({
      decodeWithSchemaRegistry: vi.fn().mockResolvedValue(options.schemaDecodedPayload),
    }))
  } else {
    vi.doUnmock('../services/liveAnalyticsSchemaRegistry.js')
  }

  process.env.LIVE_ANALYTICS_KAFKA_BROKERS = 'localhost:9092'
  const kafka = await import('../services/liveAnalyticsKafka.js')
  getKafkaStreamEvents = kafka.getKafkaStreamEvents
  ingestKafkaEventForTesting = kafka.ingestKafkaEventForTesting
  resetKafkaBuffersForTesting = kafka.resetKafkaBuffersForTesting
  processKafkaBufferForTesting = kafka.processKafkaBufferForTesting
  resetKafkaBuffersForTesting()
}

describe('live analytics kafka buffer', () => {
  beforeEach(async () => {
    await loadModule()
  })

  it('captures normalized events pushed in test mode', async () => {
    const now = Date.now()
    ingestKafkaEventForTesting({ metricId: 'authorization_latency', timestamp: now, value: 320 })
    ingestKafkaEventForTesting({ metricId: 'authorization_latency', timestamp: now + 1000, value: 280 })

    const events = await getKafkaStreamEvents()
    expect(events.length).toBe(2)
    expect(events[0].metricId).toBe('authorization_latency')
  })

  it('ignores malformed events', async () => {
    ingestKafkaEventForTesting({ metricId: 'unknown_metric', timestamp: Date.now(), value: 1 })

    const events = await getKafkaStreamEvents()
    expect(events.length).toBe(0)
  })

  it('decodes schema registry payloads when available', async () => {
    const now = Date.now()
    await loadModule({ schemaDecodedPayload: { metricId: 'authorization_latency', timestamp: now, value: 415 } })

    await processKafkaBufferForTesting(Buffer.from([0, 1, 2, 3]))

    const events = await getKafkaStreamEvents()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ metricId: 'authorization_latency', value: 415 })
  })

  it('falls back to JSON parsing when schema registry decode is unavailable', async () => {
    const payload = JSON.stringify({ metricId: 'authorization_latency', timestamp: Date.now(), value: 512 })
    await loadModule({ schemaDecodedPayload: null })

    await processKafkaBufferForTesting(Buffer.from(payload, 'utf8'))

    const events = await getKafkaStreamEvents()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ metricId: 'authorization_latency', value: 512 })
  })
})
