import request, { type Test } from 'supertest'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { databaseReady } from '../db/client.js'
import { resetPartnerSignals } from '../services/partnerSignals.js'

const app = createApp()

beforeAll(async () => {
  await databaseReady
})

afterEach(async () => {
  await resetPartnerSignals()
})

function asColleague(test: Test): Test {
  return test.set('x-user-role', 'colleague').set('x-user-id', 'qa.colleague').set('x-user-name', 'QA Analyst')
}

describe('Partner Signals API', () => {
  it('returns the curated partner signal backlog', async () => {
    const response = await request(app).get('/api/partners/signals')

    expect(response.status).toBe(200)
    expect(response.body.items).toBeInstanceOf(Array)
    expect(response.body.items.length).toBeGreaterThan(0)
    expect(response.body.items[0]).toMatchObject({
      partnerId: expect.any(String),
      merchantName: expect.any(String),
      signalType: expect.any(String),
    })
  })

  it('filters partner signals by signalType when requested', async () => {
    const response = await request(app)
      .get('/api/partners/signals')
      .query({ signalType: 'growth' })

    expect(response.status).toBe(200)
    expect(response.body.items).toBeInstanceOf(Array)
    expect(response.body.items.length).toBeGreaterThan(0)
    for (const item of response.body.items) {
      expect(item.signalType).toBe('growth')
    }
  })

  it('filters partner signals by status when requested', async () => {
    const listResponse = await request(app).get('/api/partners/signals')
    const pendingSignal = listResponse.body.items.find(
      (item: { status: string }) => item.status === 'pending',
    )

    expect(pendingSignal).toBeDefined()

    await asColleague(
      request(app)
        .patch(`/api/partners/signals/${pendingSignal.id}/status`)
        .send({ status: 'archived', notes: 'archiving for test' }),
    )

    const response = await request(app)
      .get('/api/partners/signals')
      .query({ status: 'archived' })

    expect(response.status).toBe(200)
    expect(response.body.items).toBeInstanceOf(Array)
    expect(response.body.items.length).toBeGreaterThan(0)
    for (const item of response.body.items) {
      expect(item.status).toBe('archived')
    }
  })

  it('returns aggregate stats for partner signals', async () => {
    const response = await request(app).get('/api/partners/signals/stats')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      total: expect.any(Number),
      status: {
        pending: expect.any(Number),
        approved: expect.any(Number),
        archived: expect.any(Number),
      },
      signalType: expect.objectContaining({
        growth: expect.any(Number),
      }),
    })
  })

  it('accepts a new partner insight when payload passes validation', async () => {
    const payload = {
      partnerId: 'ecosystem-labs',
      partnerName: 'Ecosystem Labs',
      merchantId: 'dig-8821',
      merchantName: 'Digital Bazaar',
      signalType: 'innovation',
      description:
        'Experiential checkout with AR overlays increased conversion by 18% in the Gen Z segment across metro stores.',
      confidence: 0.74,
      metadata: {
        pilotStores: 6,
        loyaltyProgram: 'Centurion Next',
      },
    }

  const response = await request(app).post('/api/partners/signals').send(payload)

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      id: expect.any(String),
      partnerId: payload.partnerId,
      merchantName: payload.merchantName,
      signalType: payload.signalType,
      confidence: payload.confidence,
    })
  })

  it('rejects malformed partner submissions with actionable issues', async () => {
    const response = await request(app).post('/api/partners/signals').send({
      partnerId: '',
      partnerName: '',
      merchantId: '',
      merchantName: '',
      signalType: 'unknown',
      description: 'too short',
      confidence: 2,
    })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Validation failed')
    expect(response.body.issues).toBeInstanceOf(Array)
    expect(response.body.issues.length).toBeGreaterThan(0)
  })

  it('updates partner signal status', async () => {
    const listResponse = await request(app).get('/api/partners/signals')
    const targetId = listResponse.body.items.find((item: { status: string }) => item.status === 'pending')?.id

    expect(targetId).toBeDefined()

    const updateResponse = await asColleague(
      request(app)
        .patch(`/api/partners/signals/${targetId}/status`)
        .send({ status: 'approved', notes: 'QA promoting signal' }),
    )

    expect(updateResponse.status).toBe(200)
    expect(updateResponse.body).toMatchObject({
      id: targetId,
      status: 'approved',
    })

    const detailResponse = await request(app).get(`/api/partners/signals/${targetId}`)
    expect(detailResponse.status).toBe(200)
    expect(detailResponse.body.status).toBe('approved')
  })

  it('returns audit history for a signal', async () => {
    const listResponse = await request(app).get('/api/partners/signals')
    const targetId = listResponse.body.items[0].id

    const response = await request(app).get(`/api/partners/signals/${targetId}/audits`)

    expect(response.status).toBe(200)
    expect(response.body.items).toBeInstanceOf(Array)
    expect(response.body.items[0]).toMatchObject({
      signalId: targetId,
      action: expect.any(String),
    })
  })

  it('allows colleagues to assign reviewers', async () => {
    const listResponse = await request(app).get('/api/partners/signals')
    const targetId = listResponse.body.items.find((item: { assignedReviewerId: string | null }) => !item.assignedReviewerId)?.id

    expect(targetId).toBeDefined()

    const assignResponse = await asColleague(
      request(app)
        .post(`/api/partners/signals/${targetId}/assignments`)
        .send({
          reviewerId: 'qa.supervisor',
          reviewerName: 'QA Supervisor',
          reviewerRole: 'colleague',
          notes: 'Assigning for follow-up',
        }),
    )

    expect(assignResponse.status).toBe(200)
    expect(assignResponse.body).toMatchObject({
      id: targetId,
      assignedReviewerId: 'qa.supervisor',
      assignedReviewerName: 'QA Supervisor',
    })

    const assignmentsResponse = await asColleague(request(app).get(`/api/partners/signals/${targetId}/assignments`))

    expect(assignmentsResponse.status).toBe(200)
    expect(assignmentsResponse.body.items[0]).toMatchObject({ reviewerId: 'qa.supervisor', active: true })
  })

  it('blocks merchants from moderation endpoints', async () => {
    const listResponse = await request(app).get('/api/partners/signals')
    const targetId = listResponse.body.items[0].id

    const response = await request(app)
      .patch(`/api/partners/signals/${targetId}/status`)
      .send({ status: 'archived' })

    expect(response.status).toBe(403)
  })
})
