import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getDashboardSnapshot,
  getEcosystemTrends,
  getFraudAlerts,
  getGrowthOpportunities,
  getPlatformKPIs,
  getWorkflowPlaybooks,
  getInnovationIdeas,
} from '../../shared/api/index.js'
import {
  dashboardSnapshotSchema,
  ecosystemTrendListSchema,
  fraudAlertListSchema,
  growthOpportunityListSchema,
  innovationIdeasListSchema,
  platformKpiListSchema,
  workflowPlaybookListSchema,
  DashboardSnapshotPayload,
  EcosystemTrendListPayload,
  FraudAlertListPayload,
  GrowthOpportunityListPayload,
  InnovationIdeasListPayload,
  LiveAnalyticsSnapshotPayload,
  liveAnalyticsSnapshotSchema,
  PlatformKpiListPayload,
  WorkflowPlaybookListPayload,
} from '../schemas/dashboard.js'
import { DistributedCache } from '../utils/distributedCache.js'
import { getLiveAnalyticsSnapshot } from '../services/liveAnalytics.js'

const FIVE_MINUTES = 1000 * 60 * 5

const snapshotCache = new DistributedCache<DashboardSnapshotPayload>('dashboard', FIVE_MINUTES)
const kpiCache = new DistributedCache<PlatformKpiListPayload>('dashboard', FIVE_MINUTES)
const trendCache = new DistributedCache<EcosystemTrendListPayload>('dashboard', FIVE_MINUTES)
const opportunityCache = new DistributedCache<GrowthOpportunityListPayload>('dashboard', FIVE_MINUTES)
const alertCache = new DistributedCache<FraudAlertListPayload>('dashboard', FIVE_MINUTES)
const playbookCache = new DistributedCache<WorkflowPlaybookListPayload>('dashboard', FIVE_MINUTES)
const ideaCache = new DistributedCache<InnovationIdeasListPayload>('dashboard', FIVE_MINUTES)
const liveCache = new DistributedCache<LiveAnalyticsSnapshotPayload>('live-analytics', 5000)

export function createDashboardRouter(): Router {
  const router = Router()

  router.get(
    '/snapshot',
    asyncHandler(async (_req, res) => {
      const cached = await snapshotCache.get('snapshot')
      if (cached) {
        return res.json(cached)
      }

      const payload = dashboardSnapshotSchema.parse(await getDashboardSnapshot())
      await snapshotCache.set('snapshot', payload)
      res.json(payload)
    }),
  )

  router.get(
    '/kpis',
    asyncHandler(async (_req, res) => {
      const cached = await kpiCache.get('kpis')
      if (cached) {
        return res.json(cached)
      }

      const payload = platformKpiListSchema.parse({
        items: await getPlatformKPIs(),
      })
      await kpiCache.set('kpis', payload)
      res.json(payload)
    }),
  )

  router.get(
    '/trends',
    asyncHandler(async (_req, res) => {
      const cached = await trendCache.get('trends')
      if (cached) {
        return res.json(cached)
      }

      const payload = ecosystemTrendListSchema.parse({
        items: await getEcosystemTrends(),
      })
      await trendCache.set('trends', payload)
      res.json(payload)
    }),
  )

  router.get(
    '/opportunities',
    asyncHandler(async (_req, res) => {
      const cached = await opportunityCache.get('opportunities')
      if (cached) {
        return res.json(cached)
      }

      const payload = growthOpportunityListSchema.parse({
        items: await getGrowthOpportunities(),
      })
      await opportunityCache.set('opportunities', payload)
      res.json(payload)
    }),
  )

  router.get(
    '/alerts',
    asyncHandler(async (_req, res) => {
      const cached = await alertCache.get('alerts')
      if (cached) {
        return res.json(cached)
      }

      const payload = fraudAlertListSchema.parse({
        items: await getFraudAlerts(),
      })
      await alertCache.set('alerts', payload)
      res.json(payload)
    }),
  )

  router.get(
    '/playbooks',
    asyncHandler(async (_req, res) => {
      const cached = await playbookCache.get('playbooks')
      if (cached) {
        return res.json(cached)
      }

      const payload = workflowPlaybookListSchema.parse({
        items: await getWorkflowPlaybooks(),
      })
      await playbookCache.set('playbooks', payload)
      res.json(payload)
    }),
  )

  router.get(
    '/ideas',
    asyncHandler(async (_req, res) => {
      const cached = await ideaCache.get('ideas')
      if (cached) {
        return res.json(cached)
      }

      const payload = innovationIdeasListSchema.parse({
        items: await getInnovationIdeas(),
      })
      await ideaCache.set('ideas', payload)
      res.json(payload)
    }),
  )

  router.get(
    '/live',
    asyncHandler(async (_req, res) => {
      const cached = await liveCache.get('snapshot')
      if (cached) {
        return res.json(cached)
      }

      const snapshot = liveAnalyticsSnapshotSchema.parse(await getLiveAnalyticsSnapshot())
      await liveCache.set('snapshot', snapshot)
      res.json(snapshot)
    }),
  )

  return router
}
