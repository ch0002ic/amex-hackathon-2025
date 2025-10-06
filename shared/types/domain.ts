export interface PlatformKPI {
  id: string
  label: string
  value: string
  delta: number
  target: string
  trend: 'up' | 'down' | 'steady'
}

export interface EcosystemTrend {
  id: string
  label: string
  values: number[]
  baseline: number
}

export interface GrowthOpportunity {
  id: string
  name: string
  description: string
  impact: 'High' | 'Medium' | 'Low'
  timeframe: '0-6 months' | '6-12 months' | '12-24 months'
}

export interface FraudAlert {
  id: string
  segment: string
  anomaly: string
  confidence: number
  recommendedAction: string
}

export interface WorkflowPlaybook {
  id: string
  team: string
  painPoint: string
  aiAssist: string
  benefit: string
}

export interface DashboardSnapshot {
  kpis: PlatformKPI[]
  trends: EcosystemTrend[]
  opportunities: GrowthOpportunity[]
  alerts: FraudAlert[]
  playbooks: WorkflowPlaybook[]
  generatedAt: string
}

export type LiveMetricTrendDirection = 'up' | 'down' | 'steady'

export interface LiveMetricTrendPoint {
  timestamp: string
  value: number
}

export interface LiveMetric {
  id: string
  label: string
  format: 'currency' | 'percentage' | 'duration' | 'count'
  unit: string
  value: number
  delta: number
  direction: LiveMetricTrendDirection
  trend: LiveMetricTrendPoint[]
  thresholds?: LiveMetricThresholds
  anomaly: LiveMetricAnomaly | null
}

export interface LiveAnalyticsSnapshot {
  generatedAt: string
  windowSeconds: number
  metrics: LiveMetric[]
  narrative: string
}

export interface LiveMetricThresholds {
  upperWarning?: number
  upperCritical?: number
  lowerWarning?: number
  lowerCritical?: number
}

export interface LiveMetricAnomaly {
  status: 'ok' | 'warning' | 'critical'
  breachedThreshold?: 'upper' | 'lower'
  thresholdValue?: number
  message: string
  magnitude: number
}

export interface ApiHealth {
  status: 'ok' | 'degraded'
  timestamp: string
  checks: Array<{ name: string; status: 'pass' | 'warn' }>
}

export interface InnovationIdea {
  id: string
  name: string
  category: string
  description: string
  noveltyScore: number
  feasibilityScore: number
  amexApplicability: number
  technicalDepth: number
  alignmentScore: number
  innovationFactors: string[]
  limitationsAddressed: string[]
  implementationComplexity: 'Low' | 'Medium' | 'Medium-High' | 'High' | 'Very High';
  timeToMarket: string
  overallScore: number
}

export interface PartnerSignalInput {
  partnerId: string
  partnerName: string
  merchantId: string
  merchantName: string
  signalType: 'growth' | 'risk' | 'retention' | 'innovation' | 'compliance'
  description: string
  confidence: number
  metadata?: Record<string, unknown>
  assignedReviewerId?: string | null
  assignedReviewerName?: string | null
  assignedReviewerRole?: ReviewerRole | null
}

export interface PartnerSignal extends PartnerSignalInput {
  id: string
  submittedAt: string
  status: 'pending' | 'approved' | 'archived'
  assignedReviewerId: string | null
  assignedReviewerName: string | null
  assignedReviewerRole: ReviewerRole | null
  assignedAt: string | null
}

export interface PartnerSignalStats {
  total: number
  status: Record<'pending' | 'approved' | 'archived', number>
  signalType: Record<'growth' | 'risk' | 'retention' | 'innovation' | 'compliance', number>
}

export interface PartnerSignalEvent {
  id: string
  signalId: string
  eventType: 'created' | 'status_change'
  fromStatus: PartnerSignal['status'] | null
  toStatus: PartnerSignal['status'] | null
  createdAt: string
}

export type ReviewerRole = 'merchant' | 'colleague'

export interface PartnerSignalAudit {
  id: string
  signalId: string
  reviewerId: string
  reviewerName: string
  reviewerRole: ReviewerRole
  action: 'created' | 'status_change' | 'assigned'
  fromStatus: PartnerSignal['status'] | null
  toStatus: PartnerSignal['status'] | null
  notes: string | null
  createdAt: string
}

export interface PartnerSignalAssignment {
  id: string
  signalId: string
  reviewerId: string
  reviewerName: string
  reviewerRole: ReviewerRole
  assignedAt: string
  active: boolean
}
