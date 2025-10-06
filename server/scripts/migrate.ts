#!/usr/bin/env node
import process from 'node:process'
import { migrateDatabase, dbPool } from '../db/client.js'
import { logger } from '../utils/logger.js'

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2))
  const shouldSeed = args.has('--seed') || args.has('--with-seed')

  logger.info({ seed: shouldSeed }, 'Starting database migration')

  try {
    await migrateDatabase({ seed: shouldSeed })
    logger.info('Database migration completed successfully')
  } finally {
    await dbPool.end()
  }
}

main().catch((error) => {
  logger.error({ err: error }, 'Database migration failed')
  process.exitCode = 1
})
