import type { PoolClient } from 'pg'
import type { ModeratorProfile, ReviewerRole } from '../../shared/types/domain.js'
import { dbPool } from '../db/client.js'
import { logger } from '../utils/logger.js'

export interface UpsertModeratorInput {
  id: string
  name: string
  email?: string | null
  role?: ReviewerRole
  source?: string
  metadata?: Record<string, unknown>
  active?: boolean
}

type Queryable = PoolClient | typeof dbPool

function resolveRunner(client?: PoolClient): Queryable {
  return client ?? dbPool
}

export async function upsertModerators(records: UpsertModeratorInput[], client?: PoolClient): Promise<void> {
  if (records.length === 0) {
    return
  }

  const runner = resolveRunner(client)

  const rows: Array<Promise<unknown>> = []

  for (const record of records) {
    const role: ReviewerRole = record.role ?? 'colleague'
    rows.push(
      runner.query(
        `INSERT INTO moderators (id, email, name, role, source, active, synced_at, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           name = EXCLUDED.name,
           role = EXCLUDED.role,
           source = EXCLUDED.source,
           active = EXCLUDED.active,
           synced_at = NOW(),
           metadata = EXCLUDED.metadata`,
        [record.id, record.email ?? null, record.name, role, record.source ?? 'scim', record.active ?? true, record.metadata ?? {}],
      ),
    )
  }

  await Promise.all(rows)
}

export async function deactivateMissingModerators(activeIds: string[], client?: PoolClient): Promise<void> {
  const runner = resolveRunner(client)

  await runner.query(
    `UPDATE moderators
        SET active = FALSE,
            synced_at = NOW()
      WHERE active = TRUE
        AND ($1::text[] IS NULL OR cardinality($1::text[]) = 0 OR id <> ALL($1::text[]))` ,
    [activeIds.length > 0 ? activeIds : null],
  )
}

export async function listActiveModerators(): Promise<ModeratorProfile[]> {
  const result = await dbPool.query<ModeratorRow>(
    `SELECT id,
            name,
            email,
            role,
            source,
            active,
            synced_at,
            metadata
       FROM moderators
      WHERE active = TRUE
      ORDER BY synced_at DESC`
  )

  return result.rows.map(mapRow)
}

export async function selectModeratorForAssignment(client: PoolClient): Promise<ModeratorProfile | null> {
  const result = await client.query<ModeratorWithLoadRow>(
    `SELECT m.id,
            m.name,
            m.email,
            m.role,
            m.source,
            m.active,
            m.synced_at,
            m.metadata,
            COALESCE(load.active_assignments, 0) AS active_assignments
       FROM moderators m
  LEFT JOIN (
            SELECT reviewer_id,
                   COUNT(*)::int AS active_assignments
              FROM partner_signal_assignments
             WHERE active = TRUE
             GROUP BY reviewer_id
          ) AS load ON load.reviewer_id = m.id
      WHERE m.active = TRUE
      ORDER BY COALESCE(load.active_assignments, 0) ASC, m.synced_at ASC
      LIMIT 1`
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRow(result.rows[0])
}

export async function activateModerators(ids: string[], client?: PoolClient): Promise<void> {
  if (ids.length === 0) {
    return
  }

  const runner = resolveRunner(client)

  await runner.query(
    `UPDATE moderators
        SET active = TRUE,
            synced_at = NOW()
      WHERE id = ANY($1::text[])`,
    [ids],
  )
}

interface ModeratorRow {
  id: string
  name: string
  email: string | null
  role: ReviewerRole
  source: string
  active: boolean
  synced_at: string
  metadata: Record<string, unknown> | null
}

interface ModeratorWithLoadRow extends ModeratorRow {
  active_assignments: number
}

function mapRow(row: ModeratorRow): ModeratorProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
    source: row.source,
    syncedAt: row.synced_at,
    metadata: row.metadata ?? {},
  }
}

export async function ensureModeratorTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await dbPool.connect()
  try {
    await client.query('BEGIN')
    const result = await handler(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export function logModeratorSyncResult(count: number): void {
  logger.info({ count }, 'moderator-sync-complete')
}
