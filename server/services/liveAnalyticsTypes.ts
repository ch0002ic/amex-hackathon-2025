export interface StreamEvent {
  metricId: string
  timestamp: number
  value: number
}

export interface RawStreamEvent {
  metricId?: unknown
  metric_id?: unknown
  metricID?: unknown
  timestamp?: unknown
  timestampMs?: unknown
  timestamp_ms?: unknown
  eventTime?: unknown
  value?: unknown
  metricValue?: unknown
  valueNumeric?: unknown
}
