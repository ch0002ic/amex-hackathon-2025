# AI-Powered Ecosystem Intelligence Platform

 Hackathon showcase web app for the AMEX GenAI Hackathon 2025. The experience turns American Express’s closed-loop network advantage into a narrative demo that highlights the three hackathon pillars—Productivity, Protection, and Growth.

## Experience Walkthrough

- **Vision Hero** — frames the value proposition with headline stats (ARR, fraud catch rate, productivity gains).
- **Cross-Loop Signal Pulse** — KPI cards derived from synthetic platform metrics.
- **Ecosystem Runway Explorer** — animated trend visualization illustrating merchant category momentum vs baseline.
- **Merchant Growth Plays** — curated opportunity cards with impact/timeframe metadata.
- **Partner Signal Operations** — persistent backlog with signal-type & status filters, reviewer workflows, optimistic updates, draft auto-save with manual reset and save-time indicator, and a rich detail drawer with persisted filter preferences.
- **Behavioral Threat Radar** — fraud anomaly alerts with invisible-auth recommendations.
- **Colleague Copilot Playbooks** — workflow automation stories for internal teams.
- **Innovation Portfolio Radar** — prioritized AMEX initiatives scored across novelty, feasibility, and strategic fit.
- **Implementation Blueprint** — phased roadmap ready for Round 1 submission.

All data is synthetic but mirrors realistic KPIs and innovation themes.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, vanilla CSS modules.
- **Shared Contracts**: `shared/` workspace with domain types, mock datasets, and service helpers.
- **Backend API**: Express 5 with CORS, powered by the shared contract layer and consumed over REST.
- **Database**: PostgreSQL (pg/pg-mem) for partner signals with auto-migrations and seeded auditors/assignments.
- **Caching**: Hybrid TTL cache backed by Redis (optional) so multiple API instances stay in sync.
- **Testing**: Vitest with Supertest for API smoke coverage.
- **Deployment Target**: Vercel (auto-build on `main` when pushed to GitHub).

## Latest Iterations

- Migrated partner signal storage from SQLite to PostgreSQL with audit trails, reviewer assignments, and pg-mem parity for tests.
- Introduced persona-aware authentication headers so the UI gates moderation tools to colleague roles only.
- Added OpenTelemetry scaffolding (gated by env) to trace partner signal operations for future compliance evidence.
- Hardened tracing middleware to propagate upstream context, expose trace headers to the UI, and stream spans to OTLP or console exporters on demand.
- Preserved all prior backlog UX enhancements: optimistic moderation, draft autosave/discard, metadata presets, and accessibility tweaks.
- Added a dedicated Postgres migration CLI (`npm run db:migrate`) with optional seeding for managed environments.
- Introduced a live analytics stream and dashboard widget that refreshes every ~15 seconds with synthetic telemetry derived from partner trends.
- Instrumented Prometheus gauges & histograms for the partner-signal latency SLO, exposed at `/metrics`, and shipped ready-to-import Grafana/Honeycomb assets.
- Wired the live analytics service to ingest NDJSON, JSON, or Kafka streams with schema validation, test-only injectors, and caching to smooth bursts.
- Automated IdP moderator provisioning via SCIM/Okta workflows with a sync CLI (`npm run idp:sync`) that keeps reviewer records, roles, and SLO dashboards aligned.
- Provisioned Grafana alerting assets that fan out the partner-signal SLO breach to Slack and MS Teams with on-call friendly messaging.
- Expanded the Kafka ingestion path to decode Confluent Schema Registry payloads (Avro, Protobuf, JSON) with runtime validation and graceful JSON fallback.
- Launched a shadow approval queue that enrolls SCIM-provisioned moderators for tiered pilots alongside the primary backlog workflow.

## Getting Started

```bash
# install dependencies
npm install

# run the express API (defaults to http://localhost:5050)
npm run dev:server

# optional: launch a local postgres (matches DATABASE_URL default)
docker run --rm -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16

# override connection if needed (auto-creates database when possible)
DATABASE_URL=postgres://user:pass@localhost:5432/amex_ecosystem npm run dev:server

# run migrations manually (use -- --seed for initial data)
npm run db:migrate
npm run db:migrate -- --seed

# (optional) boot a local redis instance for distributed caching
docker run --rm -p 6379:6379 redis:7-alpine

# or point at an existing cluster via REDIS_URL
REDIS_URL=redis://localhost:6379 npm run dev:server
# run frontend locally with HMR at http://localhost:5173
# (uses the proxy in vite.config.ts -> http://localhost:5050)
npm run dev

# execute the shared Vitest suite
npm test

# type-check and build for production (includes server output)
npm run build

# optional: preview production build locally
npm run preview

# run lint, tests, and production builds in sequence (matches CI)
npm run ci
```

## Project Structure Highlights

- `src/api/mockApi.ts` — async helpers that imitate backend latency while reusing shared services.
- `src/data/mockData.ts` — curated synthetic dataset aligned with hackathon storyline.
- `src/components/` — presentational components for hero, KPIs, charts, alerts, and playbooks.
- `src/components/InnovationIdeas.tsx` — innovation radar showcasing AMEX growth bets sourced from strategy analysis.
- `server/routes/partnerRoutes.ts` — partner signal submission, status updates, and filtered listing endpoints with schema validation.
- `server/services/partnerSignals.ts` — Postgres-backed backlog seeded from collaborative scouting data with status + stats aggregation.
- `server/utils/distributedCache.ts` — Redis-backed cache façade that falls back to local TTL storage.
- `src/sections/Roadmap.tsx` — implementation plan module mapped to hackathon phases.
- `shared/` — canonical domain types, service functions, and mock data reused by both frontend and API.
- `server/` — Express application exposing dashboard and health endpoints.
- `Dockerfile` — container build for deploying the API tier anywhere that can run Node containers.
- `src/components/PartnerSignalDetail.tsx` — modal drawer for inspecting signals, adjusting status, and reviewing metadata.

## Managed Postgres Deployment

- `PARTNER_DB_POOL_SIZE` tunes maximum server connections (defaults to `10`).
- Set `PARTNER_DB_AUTO_SEED=false` in production to skip automatic seed data during boot; rely on `npm run db:migrate -- --seed` for controlled seeding.
- `npm run db:migrate` ensures the target database exists (when permitted), applies migrations, and can optionally seed.
- When targeting managed providers that restrict `CREATE DATABASE`, pre-create the schema or point `DATABASE_URL` at the provisioned database.
- Combine connection pooling (e.g., PgBouncer) with the migration CLI for zero-downtime deploys: run migrations, switch traffic, then re-enable auto seeding if desired.

## Observability & Telemetry

- Set `ENABLE_OTEL=true` to bootstrap tracing inside the Node runtime. The server now extracts upstream `traceparent` headers, starts an active span for each request, and emits enriched attributes (user role/id, response size, latency, status code). Upstream headers (`traceparent`, `tracestate`, `x-request-id`, `x-trace-id`) are exposed automatically for frontend correlation.
- Provide `OTEL_EXPORTER_OTLP_ENDPOINT` (and optional `OTEL_EXPORTER_OTLP_HEADERS=key=value,key=value`) to stream spans to Tempo, Honeycomb, Datadog, or any OTLP-compatible collector using the built-in batch span processor.
- Add `OTEL_EXPORTER_CONSOLE=true` in lower environments to mirror spans to stdout for quick debugging without a collector.
- Tracing is gated behind `ENABLE_OTEL` so local contributors can opt-in without additional dependencies. When disabled, the middleware still attaches request IDs and logs structured durations via `pino`.
- Frontend spans now ship with semantic events: set `VITE_ENABLE_WEB_OTEL=true` and point `VITE_OTEL_EXPORTER_OTLP_URL` at your collector to emit browser spans (DocumentLoad, Fetch, and custom UI spans for partner signal workflows and live analytics refreshes). Keep `VITE_OTEL_EXPORTER_CONSOLE=true` in development to mirror spans to the browser console.
- `src/telemetry/spans.ts` exports helpers (`withWebSpan`, `startWebSpan`) so new UI features can add spans with consistent attributes.
- The API now exposes Prometheus metrics under `/metrics`, including `partner_signal_pending_total`, latency histograms, and SLO breach counters. Ready-to-import Grafana, Honeycomb, and Tempo playbooks live in `observability/` to accelerate dashboard brings-ups. Configure `METRICS_REFRESH_INTERVAL_MS` and `PARTNER_SIGNAL_SLO_TARGET_MINUTES` to tune refresh cadence and alert sensitivity.

## Live Analytics Stream

- `GET /api/dashboard/live` emits a `LiveAnalyticsSnapshot` every ~15 seconds. Each payload includes:
	- `generatedAt`: ISO timestamp of the refresh.
	- `windowSeconds`: the size of the rolling window (defaults to 105 seconds).
	- `metrics[]`: synthetic spend, fraud, latency, and activation signals with directional deltas and mini trend lines.
	- `narrative`: a short headline summarizing the largest swings.
- Responses are cached for 5 seconds via the distributed cache façade to smooth bursts while remaining “live”.
- Point `LIVE_ANALYTICS_STREAM_URL` at a managed NDJSON or JSON feed (Kafka REST proxy, Flink job, or Feature Store API) to hydrate the dashboard; the server automatically normalizes the feed, applies anomaly thresholds, and falls back to the on-disk replay (`LIVE_ANALYTICS_STREAM_PATH`) if the upstream is unreachable.
- Configure `LIVE_ANALYTICS_KAFKA_BROKERS` and related envs to stream directly from Kafka without code changes. The service buffers the latest events per metric, respects backpressure via TTLs, and continues to fall back gracefully when the topic is unreachable.
- Set `LIVE_ANALYTICS_SCHEMA_REGISTRY_URL` (with optional basic auth or bearer token) to auto-decode Confluent Schema Registry payloads; Avro/Protobuf/JSON Schemas are validated on ingest with a JSON fallback when decoding fails.
- The React dashboard polls this endpoint to power the **Live Network Telemetry** panel; metrics render with in-card sparklines and color-coded deltas. Custom spans (`ui.live_analytics.refresh`) capture each refresh cadence for observability.

## Production RBAC Blueprint

- Personas: the app ships with `merchant` (read-only) and `colleague` (moderation) roles. The Express middleware reads `X-User-Id`, `X-User-Name`, and `X-User-Role` headers and attaches the profile to `req.user` for downstream checks.
- For production, front these headers with your identity provider:
	1. Terminate SSO (Okta, Azure AD, Auth0) at the edge and map directory groups to the two roles. For example, `amex:ecosystem:moderators` → `colleague`, default → `merchant`.
	2. Configure the gateway or Functions-as-a-Service runtime to forward canonical headers (`X-User-*`). Signed JWT claims can be transformed at the edge if header-based auth is not permitted.
	3. Enable auditing by persisting `req.user` metadata with each moderation event (already scaffolded in partner signal services).
- Consider hardening with:
	- `X-Forwarded-For` allow lists combined with CDN auth.
	- A deny list for merchants attempting moderation actions (returning 403).
	- Rate limits per `user.id` when attaching to public portals.
- Update the `attachRequestUser` middleware to accept provider-specific claim names if your SSO gateway uses different headers.
- When `ENABLE_IDP_INTEGRATION=true`, the API verifies inbound bearer tokens (or `X-Id-Token`) against your IdP’s JWKS. Configure `IDP_ISSUER`, `IDP_AUDIENCE`, and the claim mappings (`IDP_ROLE_CLAIM`, `IDP_USER_ID_CLAIM`, `IDP_USER_NAME_CLAIM`, `IDP_GROUPS_CLAIM`). Add `IDP_REQUIRE_TOKEN=true` to enforce token presence, and list moderator-eligible groups via `IDP_MODERATOR_GROUPS`.
- SCIM & Okta Workflows can keep the reviewer roster fresh via `npm run idp:sync`: it calls the IdP’s SCIM API, upserts moderators, deactivates stale accounts, and feeds the auto-assignment pool used by the partner signal service.
- The React shell surfaces an IdP session banner that lets operators paste a signed JWT for local testing. Tokens are forwarded automatically via `Authorization: Bearer …` and the `X-Id-Token` header, enabling end-to-end verification without bespoke curl scripts.
- To automate moderator provisioning, sync an Okta/Azure AD group to the `IDP_MODERATOR_GROUPS` list and pre-populate the JWT with that group claim; the middleware will upgrade the requester to the `colleague` role on verification.

## Next Steps

1. Elevate the shadow queue into the UI so colleagues can acknowledge, escalate, and filter pilot reviews directly from the dashboard.
2. Add schema compatibility smoke tests & automatic subject registration to guard against live Kafka payload drifts.
3. Layer incident hygiene on the Grafana bridge (quiet hours, auto-resolve pings, PagerDuty hand-off) before expanding to production scale.


## Shadow Approval Queue

- Toggle `SHADOW_APPROVAL_QUEUE_ENABLED=true` (default) and sync moderators via `npm run idp:sync` to auto-populate the pilot queue. Members of any `SHADOW_APPROVAL_QUEUE_GROUPS` (defaults to `ecosystem-shadow-approvers`) are automatically enrolled.
- Every partner submission adds a pending record to `partner_signal_shadow_queue`, preserving the existing optimistic workflow while giving senior reviewers a “shadow” backlog to validate before full rollout.
- Colleague endpoints:
	- `GET /api/partners/shadow-queue` — returns pending and decided items with partner/merchant metadata and supports `?tier=pilot` filtering.
	- `POST /api/partners/shadow-queue/:queueId/decision` — acknowledge or escalate items with optional notes; decisions stamp reviewer identity and timestamps.
- Entries feed the Grafana SLO dashboards and Slack/MS Teams alerts so pilot moderators can triage within their existing incident channels.


## Partner Signals API

New collaborative partners can share growth, risk, or retention insights directly into the platform.

```
GET    /api/partners/signals             # curated backlog of recent partner discoveries
	?signalType=growth|risk|...      # optional filter by signal theme
	?status=pending|approved|archived# optional filter by review status
GET    /api/partners/signals/:id         # full detail for a specific signal
POST   /api/partners/signals             # submit a new insight (validated with Zod)
PATCH  /api/partners/signals/:id/status  # move a signal through pending → approved/archived
```

Request payload contract:

- `partnerId`, `partnerName`, `merchantId`, `merchantName`: non-empty strings.
- `signalType`: one of `growth | risk | retention | innovation | compliance`.
- `description`: >= 20 characters to ensure actionable storytelling.
- `confidence`: floating point between 0 and 1.
- `metadata`: optional JSON object for extra qualifiers (pilots, segments, etc.).

Set `REDIS_URL` to sync cache entries across instances; otherwise the API falls back to the in-process TTL cache for local development.

## Deployment

### Containerized API

```bash
# build the production API image
docker build -t amex-ecosystem-api .

# run the container (exposes port 5050)
docker run --rm -p 5050:5050 amex-ecosystem-api

# or use the npm helpers
npm run docker:build
npm run docker:run
```

Once running, point the frontend to the deployed API by setting `VITE_API_URL` (see `.env.example`) before running `npm run build`.

### Automated CI/CD

- **GitHub Actions CI** (`.github/workflows/ci.yml`): runs `npm run ci` (lint → test → build) on every push/PR targeting `main`.
- **API Image Publisher** (`.github/workflows/docker-release.yml`): builds and pushes the Docker image to GitHub Container Registry using `ghcr.io/<owner>/<repo>-api`. It triggers on `main` changes that touch backend assets or manually via “Run workflow”.

To customize the published image name, override the `IMAGE_NAME` environment variable in the workflow or set repository secrets if you prefer another registry.
