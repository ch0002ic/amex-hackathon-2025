# Observability Playbooks

This folder captures ready-to-import assets for the observability stack that stitches browser + API spans and promotes the partner-signal latency SLO to first-class status. Each subdirectory aligns with a target platform.

- `grafana/` — dashboards, alert rules, and contact point templates wired up to Prometheus/Tempo to visualise partner-signal health, live analytics freshness, and trigger on-call notifications (Slack/MS Teams) for SLO breaches.
- `honeycomb/` — board JSON for Honeycomb environments with derived columns and query templates.
- `tempo/` — TraceQL recipes that align the browser (`ui.*`) and API (`partnerSignals.*`) spans to speed up incident response.

Import the artifacts directly into your chosen stack and update the data source identifiers if they differ from the defaults provided.
