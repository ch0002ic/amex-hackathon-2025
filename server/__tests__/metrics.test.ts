import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { databaseReady, dbPool } from '../db/client.js'
import { getPartnerSignalMetricsSnapshot, refreshPartnerSignalBacklogMetrics } from '../metrics/partnerSignals.js'
import { resetPartnerSignals } from '../services/partnerSignals.js'

beforeAll(async () => {
  await databaseReady
})

beforeEach(async () => {
  await resetPartnerSignals()
})

describe('Partner signal metrics', () => {
  it('computes backlog gauges and SLO breaches', async () => {
    const now = new Date()

    await dbPool.query(
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
        status
      ) VALUES
        ('sig-old', 'p1', 'Partner One', 'm1', 'Merchant One', 'growth', 'Old pending signal', 0.9, '{}'::jsonb, $1, 'pending'),
        ('sig-recent', 'p2', 'Partner Two', 'm2', 'Merchant Two', 'risk', 'Recent pending signal', 0.6, '{}'::jsonb, $2, 'pending'),
        ('sig-approved', 'p3', 'Partner Three', 'm3', 'Merchant Three', 'innovation', 'Approved signal', 0.8, '{}'::jsonb, $3, 'approved')`,
      [
        new Date(now.getTime() - 1000 * 60 * 120),
        new Date(now.getTime() - 1000 * 60 * 10),
        new Date(now.getTime() - 1000 * 60 * 5),
      ],
    )

    await refreshPartnerSignalBacklogMetrics()

    const snapshot = getPartnerSignalMetricsSnapshot()

    expect(snapshot.pendingTotal).toBe(2)
    expect(snapshot.sloBreachTotal).toBe(1)
    expect(snapshot.pendingP95Minutes).toBeGreaterThanOrEqual(100)
  })
})
