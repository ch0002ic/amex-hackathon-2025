import crypto from 'node:crypto'
import type { PoolClient } from 'pg'
import type { PartnerSignal, ReviewerRole } from '../../shared/types/domain.js'
import { dbPool } from '../db/client.js'
import { logger } from '../utils/logger.js'

export type ShadowApprovalStatus = 'pending' | 'acknowledged' | 'escalated'

export interface ShadowApprovalQueueItem {
  id: string
  signalId: string
  signalPartnerName: string
  signalMerchantName: string
  signalType: PartnerSignal['signalType']
  signalStatus: PartnerSignal['status']
  submittedAt: string
  reviewerId: string
  reviewerName: string
  reviewerRole: ReviewerRole
  tier: string
  status: ShadowApprovalStatus
  createdAt: string
  decisionAt: string | null
  decisionById: string | null
  decisionByName: string | null
  notes: string | null
}

interface ModeratorRow {
  id: string
  name: string
  role: ReviewerRole
  metadata: unknown
}

interface ShadowQueueRow {
  id: string
  signal_id: string
  reviewer_id: string
  reviewer_name: string
  reviewer_role: ReviewerRole
  tier: string
  status: ShadowApprovalStatus
  created_at: string | Date
  decision_at: string | Date | null
  decision_by_id: string | null
  decision_by_name: string | null
  notes: string | null
  partner_name: string
  merchant_name: string
  signal_type: PartnerSignal['signalType']
  signal_status: PartnerSignal['status']
  submitted_at: string | Date
}

interface QueueDecisionInput {
  action: 'acknowledged' | 'escalated'
  notes?: string
}

const queueConfig = resolveQueueConfig()
const eligibleGroups = new Set(queueConfig.groups.map((group) => group.toLowerCase()))

interface QueueConfig {
  enabled: boolean
  tier: string
  groups: string[]
}

function resolveQueueConfig(): QueueConfig {
  const enabled = process.env.SHADOW_APPROVAL_QUEUE_ENABLED !== 'false'
  const groups = parseList(process.env.SHADOW_APPROVAL_QUEUE_GROUPS) ?? ['ecosystem-shadow-approvers']
  const tier = process.env.SHADOW_APPROVAL_QUEUE_TIER ?? 'pilot'

  return {
    enabled,
    tier,
    groups: groups.length > 0 ? groups : ['ecosystem-shadow-approvers'],
  }
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

export function isShadowQueueEnabled(): boolean {
  return queueConfig.enabled
}

export async function enqueueShadowApprovers(client: PoolClient, signalId: string): Promise<void> {
  if (!queueConfig.enabled) {
    return
  }

  const moderatorResult = await client.query<ModeratorRow>(
    `SELECT id, name, role, metadata
       FROM moderators
      WHERE active = TRUE` ,
  )

  const eligibleModerators = moderatorResult.rows.filter((moderator) => isModeratorEligible(moderator.metadata))
  if (eligibleModerators.length === 0) {
    logger.debug('shadow-queue-no-eligible-moderators')
    return
  }

  const values: Array<string> = []
  const placeholders: string[] = []
  let index = 1

  for (const moderator of eligibleModerators) {
    placeholders.push(`($${index++}, $${index++}, $${index++}, $${index++}, $${index++}, $${index++})`)
    values.push(
      crypto.randomUUID(),
      signalId,
      moderator.id,
      moderator.name,
      moderator.role,
      queueConfig.tier,
    )
  }

  try {
    await client.query(
      `INSERT INTO partner_signal_shadow_queue (
         id,
         signal_id,
         reviewer_id,
         reviewer_name,
         reviewer_role,
         tier
       ) VALUES ${placeholders.join(', ')}
       ON CONFLICT (signal_id, reviewer_id) DO NOTHING` ,
      values,
    )
  } catch (error) {
    logger.error({ err: error }, 'shadow-queue-enqueue-failed')
  }
}

export async function listShadowApprovalQueue(tier?: string): Promise<ShadowApprovalQueueItem[]> {
  const where: string[] = []
  const params: Array<string> = []

  if (tier) {
    where.push('q.tier = $1')
    params.push(tier)
  }

  const query = `SELECT q.id,
                        q.signal_id,
                        q.reviewer_id,
                        q.reviewer_name,
                        q.reviewer_role,
                        q.tier,
                        q.status,
                        q.created_at,
                        q.decision_at,
                        q.decision_by_id,
                        q.decision_by_name,
                        q.notes,
                        ps.partner_name,
                        ps.merchant_name,
                        ps.signal_type,
                        ps.status AS signal_status,
                        ps.submitted_at
                   FROM partner_signal_shadow_queue q
                   JOIN partner_signals ps ON ps.id = q.signal_id
                   ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
               ORDER BY q.created_at DESC`

  const result = await dbPool.query<ShadowQueueRow>(query, params)
  return result.rows.map(mapRow)
}

export async function recordShadowQueueDecision(
  queueId: string,
  reviewer: { id: string; name: string },
  input: QueueDecisionInput,
): Promise<ShadowApprovalQueueItem | null> {
  if (!queueConfig.enabled) {
    return null
  }

  const status: ShadowApprovalStatus = input.action === 'escalated' ? 'escalated' : 'acknowledged'
  const notes = input.notes ?? null

  const result = await dbPool.query<ShadowQueueRow>(
    `WITH updated AS (
       UPDATE partner_signal_shadow_queue
          SET status = $2,
              decision_at = NOW(),
              decision_by_id = $3,
              decision_by_name = $4,
              notes = $5
        WHERE id = $1
           AND status = 'pending'
        RETURNING *
     )
     SELECT updated.id,
            updated.signal_id,
            updated.reviewer_id,
            updated.reviewer_name,
            updated.reviewer_role,
            updated.tier,
            updated.status,
            updated.created_at,
            updated.decision_at,
            updated.decision_by_id,
            updated.decision_by_name,
            updated.notes,
            ps.partner_name,
            ps.merchant_name,
            ps.signal_type,
            ps.status AS signal_status,
            ps.submitted_at
       FROM updated
       JOIN partner_signals ps ON ps.id = updated.signal_id` ,
    [queueId, status, reviewer.id, reviewer.name, notes],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapRow(result.rows[0])
}

function isModeratorEligible(metadataValue: unknown): boolean {
  const metadata = decodeMetadata(metadataValue)
  const groups = extractGroups(metadata)
  const explicitFlag = normalizeBoolean(metadata?.shadowQueue ?? metadata?.shadow_queue ?? metadata?.pilotQueue)

  if (explicitFlag === true) {
    return true
  }

  if (groups.length === 0) {
    return false
  }

  for (const group of groups) {
    if (eligibleGroups.has(group.toLowerCase())) {
      return true
    }
  }

  return false
}

function decodeMetadata(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch (error) {
      logger.warn({ err: error }, 'shadow-queue-metadata-parse-error')
      return null
    }
  }

  if (typeof value === 'object') {
    return value as Record<string, unknown>
  }

  return null
}

function extractGroups(metadata: Record<string, unknown> | null): string[] {
  if (!metadata) {
    return []
  }

  const raw = metadata.groups ?? metadata.shadowGroups ?? metadata.queueGroups
  if (!raw) {
    return []
  }

  if (Array.isArray(raw)) {
    return raw.map((entry) => `${entry}`).filter(Boolean)
  }

  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  return [`${raw}`].filter(Boolean)
}

function normalizeBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false
    }
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  return null
}

function mapRow(row: ShadowQueueRow): ShadowApprovalQueueItem {
  return {
    id: row.id,
    signalId: row.signal_id,
    signalPartnerName: row.partner_name,
    signalMerchantName: row.merchant_name,
    signalType: row.signal_type,
    signalStatus: row.signal_status,
    submittedAt: toIso(row.submitted_at),
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    reviewerRole: row.reviewer_role,
    tier: row.tier,
    status: row.status,
    createdAt: toIso(row.created_at),
    decisionAt: toIsoNullable(row.decision_at),
    decisionById: row.decision_by_id,
    decisionByName: row.decision_by_name,
    notes: row.notes,
  }
}

function toIso(value: string | Date | null): string {
  const result = toIsoNullable(value)
  return result ?? new Date().toISOString()
}

function toIsoNullable(value: string | Date | null): string | null {
  if (value === null) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}
