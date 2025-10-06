import type {
  EcosystemTrend,
  FraudAlert,
  GrowthOpportunity,
  PlatformKPI,
  WorkflowPlaybook,
} from '../types/domain.js'

export const platformKPIs: PlatformKPI[] = [
  {
    id: 'merchant-insights',
    label: 'Merchant Coverage',
    value: '612 strategic partners',
    delta: 18.4,
    target: 'Scale to 800 by Q3',
    trend: 'up',
  },
  {
    id: 'fraud-detection',
    label: 'Behavioral Fraud Catch Rate',
    value: '97.2%',
    delta: 9.1,
    target: 'Maintain >95% with <0.5% false positives',
    trend: 'up',
  },
  {
    id: 'productivity',
    label: 'Analyst Hours Unlocked',
    value: '5,600 hrs / month',
    delta: 46.0,
    target: '8,000 hrs with GPT copilots',
    trend: 'up',
  },
  {
    id: 'ecosystem-revenue',
    label: 'Merchant Services ARR',
    value: '$82M run-rate',
    delta: 12.0,
    target: '$100M by FY25',
    trend: 'steady',
  },
]

export const ecosystemTrends: EcosystemTrend[] = [
  {
    id: 'travel',
    label: 'Travel & Lifestyle',
    values: [72, 76, 88, 102, 118, 141],
    baseline: 90,
  },
  {
    id: 'dining',
    label: 'Premium Dining',
    values: [54, 63, 70, 82, 96, 108],
    baseline: 80,
  },
  {
    id: 'luxury',
    label: 'Luxury Retail',
    values: [38, 44, 49, 60, 70, 86],
    baseline: 65,
  },
]

export const growthOpportunities: GrowthOpportunity[] = [
  {
    id: 'travel-dynamic-offers',
    name: 'Dynamic Travel Offer Mesh',
    description:
      'Blend real-time card spend, partner inventory, and member intents to co-create bundles with airline and hotel alliances.',
    impact: 'High',
    timeframe: '6-12 months',
  },
  {
    id: 'merchant-signal-exchange',
    name: 'Merchant Signal Exchange',
    description:
      'Privacy-preserving benchmark service that lets merchants compare conversion funnels and customer cohorts against ecosystem peers.',
    impact: 'High',
    timeframe: '0-6 months',
  },
  {
    id: 'smr-copilot',
    name: 'Sales Motion Copilot',
    description:
      'Conversational assistant that assembles partner-ready opportunity briefs, legal guardrails, and ROI narratives in minutes.',
    impact: 'Medium',
    timeframe: '0-6 months',
  },
]

export const fraudAlerts: FraudAlert[] = [
  {
    id: 'alert-1',
    segment: 'Singapore Travel Aggregators',
    anomaly: 'Velocity spike: 4.2× increase in cross-border charges within 12 hours',
    confidence: 0.93,
    recommendedAction:
      'Auto-escalate to behavioral biometric check and notify merchant risk lead for joint outreach.',
  },
  {
    id: 'alert-2',
    segment: 'Luxury Retail (Tokyo)',
    anomaly: 'Device fingerprint drift detected on tokenized wallet transactions',
    confidence: 0.87,
    recommendedAction:
      'Activate invisible MFA with typographic cadence check; share anonymized signature with consortium.',
  },
  {
    id: 'alert-3',
    segment: 'Digital Subscriptions (US)',
    anomaly: 'Subscription bust-out probability exceeds 0.78 for new cohort',
    confidence: 0.81,
    recommendedAction:
      'Throttle limit increases and surface retention-safe verifications in partner portal.',
  },
]

export const workflowPlaybooks: WorkflowPlaybook[] = [
  {
    id: 'playbook-risk',
    team: 'Fraud Strategy',
    painPoint: 'Manual synthesis of anomaly clusters across regions consumes analyst hours.',
    aiAssist:
      'Copilot drafts regional threat digests with explainable vector summaries and recommended levers.',
    benefit: 'Saves 22 hours / week and accelerates containment by 36%.',
  },
  {
    id: 'playbook-partnerships',
    team: 'Merchant Partnerships',
    painPoint: 'Identifying cross-merchant collab opportunities requires stitching multiple BI tools.',
    aiAssist:
      'Agent canvasses ecosystem graph, scores partnership uplift, and exports contract-ready memo.',
    benefit: 'Cuts discovery cycle from 3 weeks to 4 days.',
  },
  {
    id: 'playbook-ops',
    team: 'Operations Excellence',
    painPoint: 'Escalations bottleneck due to fragmented documentation and knowledge silos.',
    aiAssist:
      'Contextual knowledge base with generative Q&A and action-tracking automation.',
    benefit: 'Reduces mean resolution time by 48% and raises satisfaction to 4.8/5.',
  },
]
