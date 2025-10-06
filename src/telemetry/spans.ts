import { SpanStatusCode, type Attributes } from '@opentelemetry/api'
import { getWebTracer } from './client'

interface SpanOptions {
  attributes?: Attributes
}

export async function withWebSpan<T>(name: string, fn: () => Promise<T>, options?: SpanOptions): Promise<T> {
  if (import.meta.env.VITE_ENABLE_WEB_OTEL !== 'true') {
    return fn()
  }

  const tracer = getWebTracer()

  return tracer.startActiveSpan(name, { attributes: options?.attributes }, async (span) => {
    try {
      const result = await fn()
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'unknown-error',
      })
      if (error instanceof Error) {
        span.recordException(error)
      }
      throw error
    } finally {
      span.end()
    }
  })
}

export function startWebSpan(name: string, attributes?: Attributes) {
  if (import.meta.env.VITE_ENABLE_WEB_OTEL !== 'true') {
    return { end: () => {} }
  }

  const tracer = getWebTracer()
  const span = tracer.startSpan(name, { attributes })
  return {
    end: (error?: unknown) => {
      if (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'unknown-error',
        })
        if (error instanceof Error) {
          span.recordException(error)
        }
      } else {
        span.setStatus({ code: SpanStatusCode.OK })
      }
      span.end()
    },
  }
}
