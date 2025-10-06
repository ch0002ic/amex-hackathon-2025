import type { PartnerSignal } from '../types/domain.js'

export const partnerSignals: PartnerSignal[] = [
  {
    id: 'ps-amex-001',
    partnerId: 'amex-ventures',
    partnerName: 'Amex Ventures',
    merchantId: 'mkt-4721',
    merchantName: 'LuxeStay Collection',
    signalType: 'growth',
    description:
      'Digital concierge pilot demonstrating a 26% uplift in premium card cross-sell conversions across the boutique hospitality cluster.',
    confidence: 0.86,
    metadata: {
      region: 'APAC',
      pilotMarkets: ['Singapore', 'Hong Kong'],
      sampleSize: 820,
    },
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    status: 'approved',
    assignedReviewerId: 'analyst.megan',
    assignedReviewerName: 'Megan Rivera',
    assignedReviewerRole: 'colleague',
    assignedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
  {
    id: 'ps-amex-002',
    partnerId: 'merchant-partner-labs',
    partnerName: 'Merchant Partner Labs',
    merchantId: 'ret-9410',
    merchantName: 'Everyday Essentials Co.',
    signalType: 'retention',
    description:
      'Invisible-auth kiosk checkout is reducing queue abandonment by 41%, with opt-in consent rates above regulatory thresholds.',
    confidence: 0.79,
    metadata: {
      channel: 'In-store',
      pilotStores: 14,
    },
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    status: 'pending',
    assignedReviewerId: null,
    assignedReviewerName: null,
    assignedReviewerRole: null,
    assignedAt: null,
  },
  {
    id: 'ps-amex-003',
    partnerId: 'risk-partners',
    partnerName: 'Risk Partners Consortium',
    merchantId: 'fin-2210',
    merchantName: 'NexTrade Markets',
    signalType: 'risk',
    description:
      'Synthetic data generator exposed coordinated account tumbling across three cross-border corridors, enabling 4-hour interdiction SLAs.',
    confidence: 0.91,
    metadata: {
      corridors: ['US-CA', 'US-MX', 'US-EU'],
      impactedAccounts: 57,
    },
    submittedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    status: 'approved',
    assignedReviewerId: 'ops.darius',
    assignedReviewerName: 'Darius Singh',
    assignedReviewerRole: 'colleague',
    assignedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
]
