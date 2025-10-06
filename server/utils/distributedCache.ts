import type { Redis as RedisClient } from 'ioredis'
import { TTLCache } from './cache.js'
import { getRedisClient } from './redis.js'
import { logger } from './logger.js'

export class DistributedCache<T> {
  private readonly memoryCache: TTLCache<T>
  private readonly redis: RedisClient | null
  private readonly ttlSeconds: number

  constructor(private readonly namespace: string, ttlMs: number) {
    this.memoryCache = new TTLCache<T>(ttlMs)
    this.redis = getRedisClient()
    this.ttlSeconds = Math.max(1, Math.floor(ttlMs / 1000))
  }

  private buildKey(key: string): string {
    return `${this.namespace}:${key}`
  }

  async get(key: string): Promise<T | undefined> {
    const local = this.memoryCache.get(key)
    if (local !== undefined) {
      return local
    }

    if (!this.redis) {
      return undefined
    }

    try {
      const raw = await this.redis.get(this.buildKey(key))
      if (!raw) return undefined

      const value = JSON.parse(raw) as T
      this.memoryCache.set(key, value)
      return value
    } catch (err) {
      logger.warn({ err }, 'distributed-cache-redis-get-failed')
      return undefined
    }
  }

  async set(key: string, value: T): Promise<void> {
    this.memoryCache.set(key, value)

    if (!this.redis) {
      return
    }

    try {
      await this.redis.set(this.buildKey(key), JSON.stringify(value), 'EX', this.ttlSeconds)
    } catch (err) {
      logger.warn({ err }, 'distributed-cache-redis-set-failed')
    }
  }

  clear(): void {
    this.memoryCache.clear()
  }
}
