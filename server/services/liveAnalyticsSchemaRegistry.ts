import { SchemaRegistry } from '@kafkajs/confluent-schema-registry'
import { logger } from '../utils/logger.js'

type SchemaRegistryAuth =
  | { username: string; password: string }
  | { token: string }

type SchemaRegistryConfig = {
  enabled: boolean
  host: string
  auth?: SchemaRegistryAuth
  clientId?: string
}

type SchemaRegistryHeaders = Record<string, unknown> | undefined

const config = resolveConfig()
let registry: SchemaRegistry | null = null
let initializationFailed = false

function resolveConfig(): SchemaRegistryConfig {
  const host = (process.env.LIVE_ANALYTICS_SCHEMA_REGISTRY_URL ?? '').trim()
  if (!host) {
    return { enabled: false, host: '' }
  }

  const auth = resolveAuth()
  return {
    enabled: true,
    host,
    auth,
    clientId: process.env.LIVE_ANALYTICS_SCHEMA_REGISTRY_CLIENT_ID,
  }
}

function resolveAuth(): SchemaRegistryAuth | undefined {
  const username = process.env.LIVE_ANALYTICS_SCHEMA_REGISTRY_BASIC_USER
  const password = process.env.LIVE_ANALYTICS_SCHEMA_REGISTRY_BASIC_PASSWORD
  if (username && password) {
    return { username, password }
  }

  const token = process.env.LIVE_ANALYTICS_SCHEMA_REGISTRY_BEARER_TOKEN
  if (token) {
    return { token }
  }

  return undefined
}

function ensureRegistry(): SchemaRegistry | null {
  if (!config.enabled || initializationFailed) {
    return null
  }

  if (registry) {
    return registry
  }

  try {
    registry = new SchemaRegistry(config)
    return registry
  } catch (error) {
    initializationFailed = true
    logger.error({ err: error }, 'schema-registry-init-failed')
    return null
  }
}

export function isSchemaRegistryEnabled(): boolean {
  return config.enabled && !initializationFailed
}

export async function decodeWithSchemaRegistry(value: Buffer, headers?: SchemaRegistryHeaders): Promise<unknown | null> {
  const instance = ensureRegistry()
  if (!instance) {
    return null
  }

  try {
    return await instance.decode(value, headers)
  } catch (error) {
    logger.warn({ err: error }, 'schema-registry-decode-failed')
    return null
  }
}
