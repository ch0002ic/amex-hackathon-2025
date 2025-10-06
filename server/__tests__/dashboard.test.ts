import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../app'

const app = createApp()

describe('Ecosystem Intelligence API', () => {
  it('exposes health status', async () => {
    const response = await request(app).get('/health')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
    expect(response.body.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'shared-data' })]),
    )
  })

  it('returns a dashboard snapshot', async () => {
    const response = await request(app).get('/api/dashboard/snapshot')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      kpis: expect.any(Array),
      trends: expect.any(Array),
      opportunities: expect.any(Array),
      alerts: expect.any(Array),
      playbooks: expect.any(Array),
      generatedAt: expect.any(String),
    })
    expect(response.body.kpis.length).toBeGreaterThan(0)
  })

  it('surfaces innovation ideas portfolio', async () => {
    const response = await request(app).get('/api/dashboard/ideas')

    expect(response.status).toBe(200)
    expect(response.body.items).toBeInstanceOf(Array)
    expect(response.body.items.length).toBeGreaterThan(0)
    expect(response.body.items[0]).toMatchObject({
      name: expect.any(String),
      category: expect.any(String),
      overallScore: expect.any(Number),
      innovationFactors: expect.any(Array),
    })
  })

  it('streams live analytics snapshots with anomaly status', async () => {
    const response = await request(app).get('/api/dashboard/live')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      generatedAt: expect.any(String),
      windowSeconds: expect.any(Number),
      narrative: expect.any(String),
      metrics: expect.any(Array),
    })

    const metric = response.body.metrics[0]
    expect(metric).toMatchObject({
      id: expect.any(String),
      label: expect.any(String),
      value: expect.any(Number),
      delta: expect.any(Number),
      direction: expect.stringMatching(/^(up|down|steady)$/),
      trend: expect.any(Array),
      anomaly: expect.objectContaining({
        status: expect.stringMatching(/^(ok|warning|critical)$/),
        message: expect.any(String),
      }),
    })
  })

  it('emits live analytics snapshots', async () => {
    const response = await request(app).get('/api/dashboard/live')

    expect(response.status).toBe(200)
    expect(response.body.generatedAt).toEqual(expect.any(String))
    expect(response.body.windowSeconds).toEqual(expect.any(Number))
    expect(response.body.metrics).toBeInstanceOf(Array)
    expect(response.body.metrics.length).toBeGreaterThan(0)
    expect(response.body.metrics[0]).toMatchObject({
      id: expect.any(String),
      label: expect.any(String),
      value: expect.any(Number),
      delta: expect.any(Number),
      direction: expect.any(String),
      trend: expect.any(Array),
    })
    expect(response.body.narrative).toEqual(expect.any(String))
  })
})
