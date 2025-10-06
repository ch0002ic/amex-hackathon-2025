import { diag, DiagConsoleLogger, DiagLogLevel, trace, type Tracer } from '@opentelemetry/api'
import { WebTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor, BatchSpanProcessor, type SpanProcessor } from '@opentelemetry/sdk-trace-web'
import { ZoneContextManager } from '@opentelemetry/context-zone'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

let configured = false
let cachedTracer: Tracer | null = null

export function initClientTelemetry(): void {
  if (configured) {
    return
  }

  if (typeof window === 'undefined') {
    return
  }

  if (import.meta.env.VITE_ENABLE_WEB_OTEL !== 'true') {
    return
  }

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR)

  const processors: SpanProcessor[] = []

  const otlpUrl = import.meta.env.VITE_OTEL_EXPORTER_OTLP_URL?.trim()
  if (otlpUrl) {
    processors.push(
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: otlpUrl,
          headers: parseHeaders(import.meta.env.VITE_OTEL_EXPORTER_OTLP_HEADERS),
        }) as unknown as ConstructorParameters<typeof BatchSpanProcessor>[0],
      ),
    )
  }

  if (import.meta.env.VITE_OTEL_EXPORTER_CONSOLE !== 'false') {
    processors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()))
  }

  processors.push(
    new AttributeSpanProcessor({
      'service.name': import.meta.env.VITE_OTEL_SERVICE_NAME ?? 'ecosystem-intelligence-web',
      'deployment.environment': import.meta.env.MODE ?? 'development',
    }),
  )

  const provider = new WebTracerProvider({ spanProcessors: processors })

  provider.register({
    contextManager: new ZoneContextManager(),
    propagator: new W3CTraceContextPropagator(),
  })

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: buildTraceableOrigins(),
      }),
    ],
  })

  cachedTracer = trace.getTracer(import.meta.env.VITE_OTEL_SERVICE_NAME ?? 'ecosystem-intelligence-web')

  configured = true
}

export function getWebTracer(): Tracer {
  if (!configured) {
    initClientTelemetry()
  }
  if (!cachedTracer) {
    const name = import.meta.env.VITE_OTEL_SERVICE_NAME ?? 'ecosystem-intelligence-web'
    cachedTracer = trace.getTracer(name)
  }
  return cachedTracer
}

function buildTraceableOrigins(): Array<string | RegExp> {
  const origins: Array<string | RegExp> = [/^\/api\//]
  const configuredBase = import.meta.env.VITE_API_URL
  if (configuredBase) {
    origins.push(configuredBase)
  }
  return origins
}

function parseHeaders(raw?: string): Record<string, string> | undefined {
  if (!raw) {
    return undefined
  }

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, pair) => {
      const [key, value] = pair.split('=')
      if (key && value) {
        acc[key.trim()] = value.trim()
      }
      return acc
    }, {})
}

class AttributeSpanProcessor implements SpanProcessor {
  private readonly attributes: Record<string, unknown>

  constructor(attributes: Record<string, unknown>) {
    this.attributes = attributes
  }

  onStart(span: import('@opentelemetry/api').Span): void {
    for (const [key, value] of Object.entries(this.attributes)) {
      if (value !== undefined) {
        span.setAttribute(key, value as never)
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onEnd(): void {}

  async shutdown(): Promise<void> {
    return Promise.resolve()
  }

  async forceFlush(): Promise<void> {
    return Promise.resolve()
  }
}
