import crypto from 'node:crypto'
import { Pool, type PoolConfig } from 'pg'
import { newDb } from 'pg-mem'
import { partnerSignals as seedSignals } from '../../shared/data/partnerSignals.js'
import { logger } from '../utils/logger.js'

const isTestEnvironment = process.env.NODE_ENV === 'test'

function resolvePoolConfig(): PoolConfig {
  if (isTestEnvironment) {
    return {}
  }

  const connectionString = process.env.DATABASE_URL ?? 'postgres://localhost:5432/amex_ecosystem'
  const poolSize = Number.parseInt(process.env.PARTNER_DB_POOL_SIZE ?? '10', 10)
  const enableSSL = process.env.DATABASE_SSL === 'true' || connectionString.includes('planetscale')

  return {
    connectionString,
    max: Number.isNaN(poolSize) ? 10 : poolSize,
    ssl: enableSSL
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  }
}

const basePoolConfig = resolvePoolConfig()

function createPool(): Pool {
  if (isTestEnvironment) {
    const inMemoryDb = newDb({ autoCreateForeignKeyIndices: true })
    const { Pool: MemoryPool } = inMemoryDb.adapters.createPg()
    return new MemoryPool()
  }

  return new Pool(basePoolConfig)
}

export const dbPool = createPool()

async function ensureDatabaseExists(): Promise<void> {
  if (isTestEnvironment) {
    return
  }

  const connectionString = basePoolConfig.connectionString
  if (!connectionString) {
    return
  }

  let databaseName: string | null = null

  try {
    const dbUrl = new URL(connectionString)
    databaseName = dbUrl.pathname.replace(/^\/+/, '').trim()

    if (!databaseName) {
      return
    }

    const adminUrl = new URL(connectionString)
    adminUrl.pathname = '/postgres'

    const adminPool = new Pool({
      ...basePoolConfig,
      connectionString: adminUrl.toString(),
      max: 1,
    })

    try {
      const existsResult = await adminPool.query<{ exists: boolean }>(
        'SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
        [databaseName],
      )

      if (!existsResult.rows[0]?.exists) {
        const sanitizedName = databaseName.replace(/"/g, '""')
        await adminPool.query(`CREATE DATABASE "${sanitizedName}"`)
      }
    } catch (error: unknown) {
      if (typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === '42P04') {
        return
      }

      throw error
    } finally {
      await adminPool.end()
    }
  } catch (error) {
    if (databaseName) {
      logger.error({ err: error, database: databaseName }, 'Failed to ensure database exists')
    }
    throw error
  }
}

async function applyMigrations(): Promise<void> {
  const migrations: string[] = [
    `CREATE TABLE IF NOT EXISTS partner_signals (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      merchant_name TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      description TEXT NOT NULL,
      confidence DOUBLE PRECISION NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      submitted_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      assigned_reviewer_id TEXT,
      assigned_reviewer_name TEXT,
      assigned_reviewer_role TEXT,
      assigned_at TIMESTAMPTZ
    )`,
    `CREATE TABLE IF NOT EXISTS partner_signal_assignments (
      id UUID PRIMARY KEY,
      signal_id TEXT NOT NULL REFERENCES partner_signals(id) ON DELETE CASCADE,
      reviewer_id TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      reviewer_role TEXT NOT NULL,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      active BOOLEAN NOT NULL DEFAULT TRUE
    )`,
    `CREATE TABLE IF NOT EXISTS partner_signal_audits (
      id UUID PRIMARY KEY,
      signal_id TEXT NOT NULL REFERENCES partner_signals(id) ON DELETE CASCADE,
      reviewer_id TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      reviewer_role TEXT NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_partner_signals_submitted_at ON partner_signals(submitted_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_partner_signals_status ON partner_signals(status)`,
    `CREATE INDEX IF NOT EXISTS idx_signal_assignments_signal_id ON partner_signal_assignments(signal_id)`,
    `CREATE INDEX IF NOT EXISTS idx_signal_audits_signal_id ON partner_signal_audits(signal_id)`,
    `CREATE INDEX IF NOT EXISTS idx_signal_audits_created_at ON partner_signal_audits(created_at DESC)`
  ]

  for (const statement of migrations) {
    await dbPool.query(statement)
  }

  if (!isTestEnvironment) {
    await dbPool.query(`ALTER TABLE partner_signals
    ALTER COLUMN metadata TYPE JSONB USING metadata::JSONB`)
  }
  await dbPool.query(`ALTER TABLE partner_signals
    ADD COLUMN IF NOT EXISTS assigned_reviewer_id TEXT`)
  await dbPool.query(`ALTER TABLE partner_signals
    ADD COLUMN IF NOT EXISTS assigned_reviewer_name TEXT`)
  await dbPool.query(`ALTER TABLE partner_signals
    ADD COLUMN IF NOT EXISTS assigned_reviewer_role TEXT`)
  await dbPool.query(`ALTER TABLE partner_signals
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ`)
}

async function seedPartnerSignals(): Promise<void> {
  const result = await dbPool.query<{ count: string }>('SELECT COUNT(*)::text as count FROM partner_signals')
  const currentCount = Number.parseInt(result.rows[0]?.count ?? '0', 10)

  if (currentCount > 0) {
    return
  }

  const client = await dbPool.connect()

  try {
    await client.query('BEGIN')

    for (const signal of seedSignals) {
      const assignment = signal.assignedReviewerId
        ? {
            reviewerId: signal.assignedReviewerId,
            reviewerName: signal.assignedReviewerName ?? 'Unassigned',
            reviewerRole: signal.assignedReviewerRole ?? 'colleague',
            assignedAt: signal.assignedAt ?? signal.submittedAt,
          }
        : null

      await client.query(
        `INSERT INTO partner_signals (
          id,
          partner_id,
          partner_name,
          merchant_id,
          merchant_name,
          signal_type,
          description,
          confidence,
          metadata,
          submitted_at,
          status,
          assigned_reviewer_id,
          assigned_reviewer_name,
          assigned_reviewer_role,
          assigned_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)` ,
        [
          signal.id,
          signal.partnerId,
          signal.partnerName,
          signal.merchantId,
          signal.merchantName,
          signal.signalType,
          signal.description,
          signal.confidence,
          signal.metadata ?? {},
          signal.submittedAt,
          signal.status,
          assignment?.reviewerId ?? null,
          assignment?.reviewerName ?? null,
          assignment?.reviewerRole ?? null,
          assignment?.assignedAt ?? null,
        ],
      )

      await client.query(
        `INSERT INTO partner_signal_audits (
          id,
          signal_id,
          reviewer_id,
          reviewer_name,
          reviewer_role,
          action,
          from_status,
          to_status,
          notes,
          created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)` ,
        [
          crypto.randomUUID(),
          signal.id,
          assignment?.reviewerId ?? 'seeder@amex.dev',
          assignment?.reviewerName ?? 'Seeder Bot',
          assignment?.reviewerRole ?? 'colleague',
          'created',
          null,
          signal.status,
          null,
          signal.submittedAt,
        ],
      )

      if (assignment) {
        const assignmentId = crypto.randomUUID()

        await client.query(
          `INSERT INTO partner_signal_assignments (
            id,
            signal_id,
            reviewer_id,
            reviewer_name,
            reviewer_role,
            assigned_at,
            active
          ) VALUES ($1,$2,$3,$4,$5,$6,$7)` ,
          [
            assignmentId,
            signal.id,
            assignment.reviewerId,
            assignment.reviewerName,
            assignment.reviewerRole,
            assignment.assignedAt,
            true,
          ],
        )

        await client.query(
          `INSERT INTO partner_signal_audits (
            id,
            signal_id,
            reviewer_id,
            reviewer_name,
            reviewer_role,
            action,
            from_status,
            to_status,
            notes,
            created_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)` ,
          [
            crypto.randomUUID(),
            signal.id,
            assignment.reviewerId,
            assignment.reviewerName,
            assignment.reviewerRole,
            'assigned',
            signal.status,
            signal.status,
            'Initial reviewer assignment',
            assignment.assignedAt,
          ],
        )
      }
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export interface MigrateOptions {
  seed?: boolean
}

export async function migrateDatabase(options: MigrateOptions = {}): Promise<void> {
  const { seed = false } = options

  await ensureDatabaseExists()
  await applyMigrations()

  if (seed) {
    await seedPartnerSignals()
  }
}

async function initialize(): Promise<void> {
  try {
    const shouldSeed = process.env.PARTNER_DB_AUTO_SEED !== 'false'
    await migrateDatabase({ seed: shouldSeed })
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize partner signal database')
    throw error
  }
}

export async function reseedPartnerSignals(): Promise<void> {
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    await client.query('TRUNCATE TABLE partner_signal_audits RESTART IDENTITY CASCADE')
    await client.query('TRUNCATE TABLE partner_signal_assignments RESTART IDENTITY CASCADE')
    await client.query('TRUNCATE TABLE partner_signals RESTART IDENTITY CASCADE')
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  await seedPartnerSignals()
}

export const databaseReady = initialize()
