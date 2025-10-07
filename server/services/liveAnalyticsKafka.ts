import { Kafka, logLevel, type Consumer, type KafkaConfig } from 'kafkajs'
import { logger } from '../utils/logger.js'
import type { RawStreamEvent, StreamEvent } from './liveAnalyticsTypes.js'
import { normalizeRawEvent } from './liveAnalyticsNormalizer.js'
import { liveMetricMetadataById } from '../../shared/data/liveAnalytics.js'
import { decodeWithSchemaRegistry } from './liveAnalyticsSchemaRegistry.js'

const brokers = parseList(process.env.LIVE_ANALYTICS_KAFKA_BROKERS)
const topic = process.env.LIVE_ANALYTICS_KAFKA_TOPIC ?? 'live-analytics'
const groupId = process.env.LIVE_ANALYTICS_KAFKA_GROUP_ID ?? 'ecosystem-live-analytics'
const clientId = process.env.LIVE_ANALYTICS_KAFKA_CLIENT_ID ?? 'ecosystem-live-analytics'
const maxEventsPerMetric = Math.max(25, Number.parseInt(process.env.LIVE_ANALYTICS_KAFKA_MAX_EVENTS ?? '180', 10))
const fromBeginning = process.env.LIVE_ANALYTICS_KAFKA_FROM_BEGINNING === 'true'
const isTestEnvironment = process.env.NODE_ENV === 'test'

let consumerPromise: Promise<void> | null = null
let kafkaUnavailable = false

const buffers = new Map<string, StreamEvent[]>()

export function isKafkaLiveAnalyticsEnabled(): boolean {
  return !kafkaUnavailable && brokers.length > 0
}

export async function getKafkaStreamEvents(): Promise<StreamEvent[]> {
  if (!isKafkaLiveAnalyticsEnabled()) {
    return []
  }

  if (!consumerPromise && !isTestEnvironment) {
    consumerPromise = startConsumer()
  }

  if (consumerPromise) {
    try {
      await consumerPromise
    } catch (error) {
      kafkaUnavailable = true
      consumerPromise = null
      logger.warn({ err: error }, 'live-analytics-kafka-consumer-failed')
      return []
    }
  }

  return flattenBuffers()
}

export function ingestKafkaEventForTesting(event: RawStreamEvent | StreamEvent): void {
  if (!isTestEnvironment) {
    return
  }

  const normalizedCandidate = isStreamEvent(event) ? event : normalizeRawEvent(event)
  if (normalizedCandidate && liveMetricMetadataById.has(normalizedCandidate.metricId)) {
    ingestEvent(normalizedCandidate)
  }
}

export function resetKafkaBuffersForTesting(): void {
  if (!isTestEnvironment) {
    return
  }

  buffers.clear()
}

async function startConsumer(): Promise<void> {
  const kafkaConfig: KafkaConfig = {
    clientId,
    brokers,
    logLevel: logLevel.ERROR,
    ssl: parseSslConfig(),
    sasl: parseSaslConfig(),
  }

  const kafka = new Kafka(kafkaConfig)
  const consumer: Consumer = kafka.consumer({ groupId })
  await consumer.connect()
  await consumer.subscribe({ topic, fromBeginning })

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) {
        return
      }

      await processKafkaMessage(message.value, message.headers)
    },
  })
}

async function processKafkaMessage(value: Buffer, headers?: Record<string, unknown>): Promise<void> {
  const decoded = await decodeWithSchemaRegistry(value, headers)
  if (decoded !== null && decoded !== undefined) {
    processDecodedPayload(decoded)
    return
  }

  const payload = value.toString('utf8').trim()
  if (!payload) {
    return
  }

  processKafkaTextPayload(payload)
}

function processKafkaTextPayload(payload: string): void {
  const fragments = payload
    .split(/\n+/)
    .map((fragment) => fragment.trim())
    .filter(Boolean)

  for (const fragment of fragments) {
    try {
      const parsed = JSON.parse(fragment) as unknown
      processDecodedPayload(parsed)
    } catch (error) {
      logger.warn({ err: error, sample: fragment.slice(0, 200) }, 'live-analytics-kafka-parse-error')
    }
  }
}

function processDecodedPayload(candidate: unknown): void {
  if (candidate === null || candidate === undefined) {
    return
  }

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      processDecodedPayload(item)
    }
    return
  }

  if (typeof candidate === 'string') {
    processKafkaTextPayload(candidate)
    return
  }

  if (candidate instanceof Uint8Array) {
    processKafkaTextPayload(Buffer.from(candidate).toString('utf8'))
    return
  }

  addRawEvent(candidate as RawStreamEvent)
}

function addRawEvent(raw: RawStreamEvent | null | undefined): void {
  const normalized = normalizeRawEvent(raw ?? null)
  if (!normalized) {
    return
  }

  ingestEvent(normalized)
}

function ingestEvent(event: StreamEvent): void {
  const bucket = buffers.get(event.metricId) ?? []
  bucket.push(event)
  bucket.sort((a, b) => a.timestamp - b.timestamp)

  if (bucket.length > maxEventsPerMetric) {
    bucket.splice(0, bucket.length - maxEventsPerMetric)
  }

  buffers.set(event.metricId, bucket)
}

function flattenBuffers(): StreamEvent[] {
  const events: StreamEvent[] = []
  for (const bucket of buffers.values()) {
    events.push(...bucket)
  }

  return events
}

export async function processKafkaBufferForTesting(value: Buffer, headers?: Record<string, unknown>): Promise<void> {
  if (!isTestEnvironment) {
    return
  }

  await processKafkaMessage(value, headers)
}

function parseSslConfig(): KafkaConfig['ssl'] {
  const sslEnabled = process.env.LIVE_ANALYTICS_KAFKA_SSL === 'true'
  if (!sslEnabled) {
    return undefined
  }

  return {
    rejectUnauthorized: process.env.LIVE_ANALYTICS_KAFKA_SSL_REJECT_UNAUTHORIZED !== 'false',
  }
}

function parseSaslConfig(): KafkaConfig['sasl'] {
  const mechanism = process.env.LIVE_ANALYTICS_KAFKA_SASL_MECHANISM
  const username = process.env.LIVE_ANALYTICS_KAFKA_USERNAME
  const password = process.env.LIVE_ANALYTICS_KAFKA_PASSWORD

  if (!mechanism || !username || !password) {
    return undefined
  }

  return {
    mechanism,
    username,
    password,
  } as KafkaConfig['sasl']
}

function parseList(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function isStreamEvent(event: RawStreamEvent | StreamEvent): event is StreamEvent {
  return typeof (event as StreamEvent).metricId === 'string' && typeof (event as StreamEvent).timestamp === 'number'
}
