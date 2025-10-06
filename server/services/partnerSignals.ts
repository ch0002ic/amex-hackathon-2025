import crypto from 'node:crypto'
import { SpanStatusCode, trace, type Span } from '@opentelemetry/api'
import type {
  PartnerSignal,
  PartnerSignalInput,
  PartnerSignalStats,
  PartnerSignalAudit,
  PartnerSignalAssignment,
  ReviewerRole,
} from '../../shared/types/domain.js'
import { dbPool, reseedPartnerSignals } from '../db/client.js'

const tracer = trace.getTracer('partner-signals-service')

const signalStatusValues: PartnerSignal['status'][] = ['pending', 'approved', 'archived']

const SIGNAL_COLUMNS = `id,
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
  assigned_at`

type PartnerSignalRow = {
  id: string
  partner_id: string
  partner_name: string
  merchant_id: string
  merchant_name: string
  signal_type: PartnerSignal['signalType']
  description: string
  confidence: number
  metadata: Record<string, unknown> | null
  submitted_at: string | Date
  status: PartnerSignal['status']
  assigned_reviewer_id: string | null
  assigned_reviewer_name: string | null
  assigned_reviewer_role: ReviewerRole | null
  assigned_at: string | Date | null
}

type PartnerSignalAuditRow = {
  id: string
  signal_id: string
  reviewer_id: string
  reviewer_name: string
  reviewer_role: ReviewerRole
  action: PartnerSignalAudit['action']
  from_status: PartnerSignal['status'] | null
  to_status: PartnerSignal['status'] | null
  notes: string | null
  created_at: string | Date
}

type PartnerSignalAssignmentRow = {
  id: string
  signal_id: string
  reviewer_id: string
  reviewer_name: string
  reviewer_role: ReviewerRole
  assigned_at: string | Date
  active: boolean
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value
}

function toNullableIsoString(value: string | Date | null): string | null {
  if (value === null) {
    return null
  }
  return toIsoString(value)
}

async function withSpan<T>(name: string, handler: () => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, async (span: Span) => {
    try {
      const result = await handler()
      return result
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
      }
      throw error
    } finally {
      span.end()
    }
  })
}

function mapSignal(row: PartnerSignalRow): PartnerSignal {
  return {
    id: row.id,
    partnerId: row.partner_id,
    partnerName: row.partner_name,
    merchantId: row.merchant_id,
    merchantName: row.merchant_name,
    signalType: row.signal_type,
    description: row.description,
    confidence: row.confidence,
    metadata: row.metadata ?? {},
    submittedAt: toIsoString(row.submitted_at),
    status: row.status,
    assignedReviewerId: row.assigned_reviewer_id,
    assignedReviewerName: row.assigned_reviewer_name,
    assignedReviewerRole: row.assigned_reviewer_role,
    assignedAt: toNullableIsoString(row.assigned_at),
  }
}

function mapAudit(row: PartnerSignalAuditRow): PartnerSignalAudit {
  return {
    id: row.id,
    signalId: row.signal_id,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    reviewerRole: row.reviewer_role,
    action: row.action,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    notes: row.notes,
    createdAt: toIsoString(row.created_at),
  }
}

function mapAssignment(row: PartnerSignalAssignmentRow): PartnerSignalAssignment {
  return {
    id: row.id,
    signalId: row.signal_id,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    reviewerRole: row.reviewer_role,
    assignedAt: toIsoString(row.assigned_at),
    active: row.active,
  }
}

export async function listPartnerSignals(
  signalType?: PartnerSignal['signalType'],
  status?: PartnerSignal['status'],
): Promise<PartnerSignal[]> {
  return withSpan('partnerSignals.list', async () => {
    const where: string[] = []
    const values: Array<string> = []

    if (signalType) {
      values.push(signalType)
      where.push(`signal_type = $${values.length}`)
    }

    if (status) {
      values.push(status)
      where.push(`status = $${values.length}`)
    }

    const query = `SELECT ${SIGNAL_COLUMNS}
      FROM partner_signals
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY submitted_at DESC`

    const result = await dbPool.query<PartnerSignalRow>(query, values)
    return result.rows.map(mapSignal)
  })
}

export async function recordPartnerSignal(input: PartnerSignalInput & {
  assignedReviewerId?: string | null
  assignedReviewerName?: string | null
  assignedReviewerRole?: ReviewerRole | null
}): Promise<PartnerSignal> {
  return withSpan('partnerSignals.record', async () => {
    const client = await dbPool.connect()
    const signalId = crypto.randomUUID()
    const submittedAt = new Date().toISOString()
    const reviewerId = input.assignedReviewerId ?? null
    const reviewerName = input.assignedReviewerName ?? null
    const reviewerRole = input.assignedReviewerRole ?? null

    try {
      await client.query('BEGIN')

      const insertResult = await client.query<PartnerSignalRow>(
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
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING ${SIGNAL_COLUMNS}`,
        [
          signalId,
          input.partnerId,
          input.partnerName,
          input.merchantId,
          input.merchantName,
          input.signalType,
          input.description,
          input.confidence,
          input.metadata ?? {},
          submittedAt,
          'pending',
          reviewerId,
          reviewerName,
          reviewerRole,
          reviewerId ? submittedAt : null,
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
          signalId,
          reviewerId ?? 'anonymous@merchant',
          reviewerName ?? 'Merchant Submitter',
          reviewerRole ?? 'merchant',
          'created',
          null,
          'pending',
          null,
          submittedAt,
        ],
      )

      if (reviewerId && reviewerName && reviewerRole) {
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
            crypto.randomUUID(),
            signalId,
            reviewerId,
            reviewerName,
            reviewerRole,
            submittedAt,
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
            signalId,
            reviewerId,
            reviewerName,
            reviewerRole,
            'assigned',
            'pending',
            'pending',
            'Auto-assigned at submission',
            submittedAt,
          ],
        )
      }

      await client.query('COMMIT')
      return mapSignal(insertResult.rows[0])
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })
}

export async function resetPartnerSignals(): Promise<void> {
  await reseedPartnerSignals()
}

export async function getPartnerSignal(id: string): Promise<PartnerSignal | null> {
  return withSpan('partnerSignals.get', async () => {
    const result = await dbPool.query<PartnerSignalRow>(
      `SELECT ${SIGNAL_COLUMNS} FROM partner_signals WHERE id = $1`,
      [id],
    )
    return result.rows.length > 0 ? mapSignal(result.rows[0]) : null
  })
}

export async function updatePartnerSignalStatus(
  id: string,
  status: PartnerSignal['status'],
  options: { reviewerId: string; reviewerName: string; reviewerRole: ReviewerRole; notes?: string } | null,
): Promise<PartnerSignal | null> {
  return withSpan('partnerSignals.updateStatus', async () => {
    if (!signalStatusValues.includes(status)) {
      throw new Error(`Invalid partner signal status: ${status}`)
    }

    const client = await dbPool.connect()
    try {
      await client.query('BEGIN')
      const existing = await client.query<PartnerSignalRow>(
        `SELECT ${SIGNAL_COLUMNS} FROM partner_signals WHERE id = $1 FOR UPDATE`,
        [id],
      )

      if (existing.rows.length === 0) {
        await client.query('ROLLBACK')
        return null
      }

      const current = existing.rows[0]
      if (current.status === status) {
        await client.query('COMMIT')
        return mapSignal(current)
      }

      const updateResult = await client.query<PartnerSignalRow>(
        `UPDATE partner_signals
            SET status = $2
          WHERE id = $1
          RETURNING ${SIGNAL_COLUMNS}`,
        [id, status],
      )

      const reviewerId = options?.reviewerId ?? current.assigned_reviewer_id ?? 'system@audit'
      const reviewerName = options?.reviewerName ?? current.assigned_reviewer_name ?? 'System'
      const reviewerRole = options?.reviewerRole ?? current.assigned_reviewer_role ?? 'colleague'

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
          id,
          reviewerId,
          reviewerName,
          reviewerRole,
          'status_change',
          current.status,
          status,
          options?.notes ?? null,
          new Date().toISOString(),
        ],
      )

      await client.query('COMMIT')
      return mapSignal(updateResult.rows[0])
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })
}

export async function assignPartnerSignalReviewer(
  id: string,
  details: { reviewerId: string; reviewerName: string; reviewerRole: ReviewerRole; notes?: string },
): Promise<PartnerSignal | null> {
  return withSpan('partnerSignals.assignReviewer', async () => {
    const client = await dbPool.connect()
    try {
      await client.query('BEGIN')
      const existing = await client.query<PartnerSignalRow>(
        `SELECT ${SIGNAL_COLUMNS} FROM partner_signals WHERE id = $1 FOR UPDATE`,
        [id],
      )

      if (existing.rows.length === 0) {
        await client.query('ROLLBACK')
        return null
      }

      const now = new Date().toISOString()

      await client.query(
        `UPDATE partner_signal_assignments SET active = FALSE WHERE signal_id = $1 AND active = TRUE`,
        [id],
      )

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
          crypto.randomUUID(),
          id,
          details.reviewerId,
          details.reviewerName,
          details.reviewerRole,
          now,
          true,
        ],
      )

      const updateResult = await client.query<PartnerSignalRow>(
        `UPDATE partner_signals
            SET assigned_reviewer_id = $2,
                assigned_reviewer_name = $3,
                assigned_reviewer_role = $4,
                assigned_at = $5
          WHERE id = $1
          RETURNING ${SIGNAL_COLUMNS}`,
        [id, details.reviewerId, details.reviewerName, details.reviewerRole, now],
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
          id,
          details.reviewerId,
          details.reviewerName,
          details.reviewerRole,
          'assigned',
          existing.rows[0].status,
          existing.rows[0].status,
          details.notes ?? 'Reviewer assignment updated',
          now,
        ],
      )

      await client.query('COMMIT')
      return mapSignal(updateResult.rows[0])
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })
}

export async function listPartnerSignalAudits(signalId: string): Promise<PartnerSignalAudit[]> {
  return withSpan('partnerSignals.listAudits', async () => {
    const result = await dbPool.query<PartnerSignalAuditRow>(
      `SELECT id,
              signal_id,
              reviewer_id,
              reviewer_name,
              reviewer_role,
              action,
              from_status,
              to_status,
              notes,
              created_at
         FROM partner_signal_audits
        WHERE signal_id = $1
        ORDER BY created_at DESC`,
      [signalId],
    )
    return result.rows.map(mapAudit)
  })
}

export async function listPartnerSignalAssignments(signalId: string): Promise<PartnerSignalAssignment[]> {
  return withSpan('partnerSignals.listAssignments', async () => {
    const result = await dbPool.query<PartnerSignalAssignmentRow>(
      `SELECT id,
              signal_id,
              reviewer_id,
              reviewer_name,
              reviewer_role,
              assigned_at,
              active
         FROM partner_signal_assignments
        WHERE signal_id = $1
        ORDER BY assigned_at DESC`,
      [signalId],
    )
    return result.rows.map(mapAssignment)
  })
}

export async function listPartnerSignalStats(): Promise<PartnerSignalStats> {
  return withSpan('partnerSignals.stats', async () => {
    const [statusResult, typeResult] = await Promise.all([
      dbPool.query<{ status: PartnerSignal['status']; total: number }>(
        `SELECT status, COUNT(*)::int AS total FROM partner_signals GROUP BY status`,
      ),
      dbPool.query<{ signal_type: PartnerSignal['signalType']; total: number }>(
        `SELECT signal_type, COUNT(*)::int AS total FROM partner_signals GROUP BY signal_type`,
      ),
    ])

    const statusAccumulator: Record<PartnerSignal['status'], number> = {
      pending: 0,
      approved: 0,
      archived: 0,
    }

    for (const row of statusResult.rows) {
      statusAccumulator[row.status as PartnerSignal['status']] = row.total
    }

    const typeAccumulator: Record<PartnerSignal['signalType'], number> = {
      growth: 0,
      risk: 0,
      retention: 0,
      innovation: 0,
      compliance: 0,
    }

    for (const row of typeResult.rows) {
      typeAccumulator[row.signal_type as PartnerSignal['signalType']] = row.total
    }

    const total = Object.values(statusAccumulator).reduce((sum, count) => sum + count, 0)

    return {
      status: statusAccumulator,
      signalType: typeAccumulator,
      total,
    }
  })
}
