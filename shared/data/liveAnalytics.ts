import type { LiveMetricThresholds } from '../types/domain.js'

export interface LiveMetricDefinition {
  id: string
  label: string
  unit: string
  format: 'currency' | 'percentage' | 'duration' | 'count'
  baseline: number
  amplitude: number
  volatility: number
  wavePeriod: number
  narrativeFocus: string
  phase?: number
  floor?: number
  directionBias?: 'up' | 'down'
  thresholds?: LiveMetricThresholds
}

export type LiveMetricMetadata = Pick<
  LiveMetricDefinition,
  'id' | 'label' | 'unit' | 'format' | 'narrativeFocus'
> & { thresholds?: LiveMetricThresholds }

export const liveMetricDefinitions: LiveMetricDefinition[] = [
  {
    id: 'network_spend_velocity',
    label: 'Network Spend Velocity',
    unit: 'USD/min',
    format: 'currency',
    baseline: 42_000_000,
    amplitude: 3_200_000,
    volatility: 1_800_000,
    wavePeriod: 18,
    phase: 2.1,
    narrativeFocus: 'portfolio spend acceleration',
    thresholds: {
      upperWarning: 45_000_000,
      upperCritical: 52_000_000,
    },
  },
  {
    id: 'fraud_block_rate',
    label: 'Fraud Block Rate',
    unit: 'bps',
    format: 'percentage',
    baseline: 82,
    amplitude: 6,
    volatility: 3,
    wavePeriod: 12,
    phase: 5.6,
    directionBias: 'up',
    narrativeFocus: 'fraud interception efficiency',
    thresholds: {
      lowerWarning: 70,
      lowerCritical: 60,
    },
  },
  {
    id: 'authorization_latency',
    label: 'Authorization Latency',
    unit: 'ms',
    format: 'duration',
    baseline: 280,
    amplitude: 68,
    volatility: 36,
    wavePeriod: 16,
    phase: 3.14,
    floor: 120,
    directionBias: 'down',
    narrativeFocus: 'payment flow responsiveness',
    thresholds: {
      upperWarning: 320,
      upperCritical: 420,
    },
  },
  {
    id: 'signal_activation',
    label: 'Signal Activation Velocity',
    unit: 'signals/hr',
    format: 'count',
    baseline: 148,
    amplitude: 22,
    volatility: 18,
    wavePeriod: 10,
    narrativeFocus: 'ecosystem insight activation',
    thresholds: {
      lowerWarning: 120,
      lowerCritical: 90,
    },
  },
]

export const liveMetricCatalog: LiveMetricMetadata[] = liveMetricDefinitions.map(
  ({ id, label, unit, format, narrativeFocus, thresholds }) => ({
    id,
    label,
    unit,
    format,
    narrativeFocus,
    thresholds,
  }),
)

export const liveMetricMetadataById = new Map(liveMetricCatalog.map((entry) => [entry.id, entry]))
export const liveMetricDefinitionById = new Map(liveMetricDefinitions.map((definition) => [definition.id, definition]))
