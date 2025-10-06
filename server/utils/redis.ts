import { Redis } from 'ioredis'
import type { Redis as RedisClient, RedisOptions } from 'ioredis'
import { logger } from './logger.js'

const REDIS_URL = process.env.REDIS_URL
let client: RedisClient | null = null

function createClient(url: string, options?: RedisOptions): RedisClient {
  const instance = new Redis(url, options ?? {})

  instance.on('error', (err: unknown) => {
    logger.error({ err }, 'redis-error')
  })

  instance.on('connect', () => {
    logger.info('redis-connected')
  })

  return instance
}

export function getRedisClient(): RedisClient | null {
  if (!REDIS_URL) {
    return null
  }

  if (!client) {
    client = createClient(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    })

    client.connect().catch((err: unknown) => {
      logger.warn({ err }, 'redis-initial-connect-failed')
    })
  }

  return client
}
