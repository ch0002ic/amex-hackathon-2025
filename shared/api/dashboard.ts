import type {
  DashboardSnapshot,
  EcosystemTrend,
  FraudAlert,
  GrowthOpportunity,
  PlatformKPI,
  WorkflowPlaybook,
} from '../types/domain.js'
import {
  ecosystemTrends,
  fraudAlerts,
  growthOpportunities,
  platformKPIs,
  workflowPlaybooks,
} from '../data/mockData.js'

function timestamp(): string {
  return new Date().toISOString()
}

export async function getPlatformKPIs(): Promise<PlatformKPI[]> {
  return platformKPIs
}

export async function getEcosystemTrends(): Promise<EcosystemTrend[]> {
  return ecosystemTrends
}

export async function getGrowthOpportunities(): Promise<GrowthOpportunity[]> {
  return growthOpportunities
}

export async function getFraudAlerts(): Promise<FraudAlert[]> {
  return fraudAlerts
}

export async function getWorkflowPlaybooks(): Promise<WorkflowPlaybook[]> {
  return workflowPlaybooks
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [kpis, trends, opportunities, alerts, playbooks] = await Promise.all([
    getPlatformKPIs(),
    getEcosystemTrends(),
    getGrowthOpportunities(),
    getFraudAlerts(),
    getWorkflowPlaybooks(),
  ])

  return {
    kpis,
    trends,
    opportunities,
    alerts,
    playbooks,
    generatedAt: timestamp(),
  }
}
