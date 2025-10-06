import { z } from 'zod'

export const platformKpiSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  delta: z.number(),
  target: z.string(),
  trend: z.enum(['up', 'down', 'steady']),
})

export const ecosystemTrendSchema = z.object({
  id: z.string(),
  label: z.string(),
  values: z.array(z.number()),
  baseline: z.number(),
})

export const growthOpportunitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  impact: z.enum(['High', 'Medium', 'Low']),
  timeframe: z.enum(['0-6 months', '6-12 months', '12-24 months']),
})

export const fraudAlertSchema = z.object({
  id: z.string(),
  segment: z.string(),
  anomaly: z.string(),
  confidence: z.number().min(0).max(1),
  recommendedAction: z.string(),
})

export const workflowPlaybookSchema = z.object({
  id: z.string(),
  team: z.string(),
  painPoint: z.string(),
  aiAssist: z.string(),
  benefit: z.string(),
})

export const innovationIdeaSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  noveltyScore: z.number(),
  feasibilityScore: z.number(),
  amexApplicability: z.number(),
  technicalDepth: z.number(),
  alignmentScore: z.number(),
  innovationFactors: z.array(z.string()),
  limitationsAddressed: z.array(z.string()),
  implementationComplexity: z.enum(['Low', 'Medium', 'Medium-High', 'High', 'Very High']),
  timeToMarket: z.string(),
  overallScore: z.number(),
})

export const liveMetricTrendPointSchema = z.object({
  timestamp: z.string(),
  value: z.number(),
})

export const liveMetricSchema = z.object({
  id: z.string(),
  label: z.string(),
  format: z.enum(['currency', 'percentage', 'duration', 'count']),
  unit: z.string(),
  value: z.number(),
  delta: z.number(),
  direction: z.enum(['up', 'down', 'steady']),
  trend: z.array(liveMetricTrendPointSchema),
  thresholds: z
    .object({
      upperWarning: z.number().optional(),
      upperCritical: z.number().optional(),
      lowerWarning: z.number().optional(),
      lowerCritical: z.number().optional(),
    })
    .optional(),
  anomaly: z
    .object({
      status: z.enum(['ok', 'warning', 'critical']),
      breachedThreshold: z.enum(['upper', 'lower']).optional(),
      thresholdValue: z.number().optional(),
      message: z.string(),
      magnitude: z.number(),
    })
    .nullable(),
})

export const liveAnalyticsSnapshotSchema = z.object({
  generatedAt: z.string(),
  windowSeconds: z.number(),
  metrics: z.array(liveMetricSchema),
  narrative: z.string(),
})

export const dashboardSnapshotSchema = z.object({
  kpis: z.array(platformKpiSchema),
  trends: z.array(ecosystemTrendSchema),
  opportunities: z.array(growthOpportunitySchema),
  alerts: z.array(fraudAlertSchema),
  playbooks: z.array(workflowPlaybookSchema),
  generatedAt: z.string(),
})

export const apiListResponse = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    items: z.array(schema),
  })

export const platformKpiListSchema = apiListResponse(platformKpiSchema)
export const ecosystemTrendListSchema = apiListResponse(ecosystemTrendSchema)
export const growthOpportunityListSchema = apiListResponse(growthOpportunitySchema)
export const fraudAlertListSchema = apiListResponse(fraudAlertSchema)
export const workflowPlaybookListSchema = apiListResponse(workflowPlaybookSchema)
export const innovationIdeasListSchema = apiListResponse(innovationIdeaSchema)

export type LiveAnalyticsSnapshotPayload = z.infer<typeof liveAnalyticsSnapshotSchema>

export type DashboardSnapshotPayload = z.infer<typeof dashboardSnapshotSchema>
export type PlatformKpiListPayload = z.infer<typeof platformKpiListSchema>
export type EcosystemTrendListPayload = z.infer<typeof ecosystemTrendListSchema>
export type GrowthOpportunityListPayload = z.infer<typeof growthOpportunityListSchema>
export type FraudAlertListPayload = z.infer<typeof fraudAlertListSchema>
export type WorkflowPlaybookListPayload = z.infer<typeof workflowPlaybookListSchema>
export type InnovationIdeasListPayload = z.infer<typeof innovationIdeasListSchema>