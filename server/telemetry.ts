import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { BatchSpanProcessor, ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

let configured = false

export function initTelemetry(): void {
  if (configured || process.env.ENABLE_OTEL !== 'true') {
    return
  }

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR)

  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'ecosystem-intelligence-api',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? 'development',
    }),
  })

  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  if (otlpEndpoint) {
    const exporter = new OTLPTraceExporter({
      url: otlpEndpoint,
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? Object.fromEntries(
            process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',')
              .map((pair) => pair.split('='))
              .filter((entry) => entry.length === 2),
          )
        : undefined,
    })

    provider.addSpanProcessor(new BatchSpanProcessor(exporter))
  }

  if (!otlpEndpoint || process.env.OTEL_EXPORTER_CONSOLE === 'true') {
    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()))
  }
  provider.register()

  configured = true
}
