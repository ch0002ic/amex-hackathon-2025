# Tempo TraceQL Snippets

Use the snippets below inside Tempo / Grafana Explore to stitch partner moderation workflows end-to-end.

## Correlate UI refresh to API moderation

```traceql
{ service.name = "ecosystem-intelligence-web", span.name = "ui.live_analytics.refresh" }
  | join({ service.name = "ecosystem-intelligence-api", span.name = "partnerSignals.updateStatus" })
  on trace_id
```

## Investigate slow approvals (> 10 minutes)

```traceql
{ service.name = "ecosystem-intelligence-api", span.name = "partnerSignals.updateStatus" }
  | where duration > 10m
  | unwrap(attributes["partner.signal.id"], attributes["http.target"], duration)
```

## Find dropped live analytics fetches

```traceql
{ service.name = "ecosystem-intelligence-api", span.name = "liveAnalytics.loadStream", status.code = "STATUS_CODE_ERROR" }
  | limit 50
```
