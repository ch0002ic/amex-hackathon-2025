import cors, { type CorsOptions } from 'cors'
import express from 'express'
import type { Application, NextFunction, Request, Response } from 'express'
import { createApiRouter } from './routes/apiRouter.js'
import type { ApiHealth } from '../shared/types/domain.js'
import { logger } from './utils/logger.js'
import crypto from 'node:crypto'
import { ZodError } from 'zod'
import { attachRequestUser } from './middleware/auth.js'
import { context, propagation, SpanStatusCode, trace } from '@opentelemetry/api'

export function createApp(): Application {
  const app = express()

  const corsOptions: CorsOptions = {
    origin: true,
    credentials: false,
    allowedHeaders: [
      'content-type',
      'traceparent',
      'tracestate',
      'x-request-id',
      'x-user-role',
      'x-user-id',
      'x-user-name',
    ],
    exposedHeaders: ['traceparent', 'tracestate', 'x-request-id', 'x-trace-id'],
  }

  app.disable('x-powered-by')
  app.set('etag', false)
  app.use(cors(corsOptions))
  app.use(express.json())
  app.use(attachRequestUser)

  app.use((_req, res, next) => {
    res.setHeader('cache-control', 'no-store')
    next()
  })

  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id']?.toString() ?? crypto.randomUUID()
    res.setHeader('x-request-id', requestId)

    const start = Date.now()
    const tracer = trace.getTracer('ecosystem-api-http')
    const carrier = req.headers
    const parentContext = propagation.extract(context.active(), carrier)

    tracer.startActiveSpan(
      'http.request',
      {
        attributes: {
          'http.method': req.method,
          'http.route': req.path,
          'http.url': `${req.protocol}://${req.get('host')}${req.originalUrl}`,
          'enduser.id': req.user?.id ?? 'anonymous',
          'enduser.role': req.user?.role ?? 'unknown',
        },
      },
      parentContext,
      (span) => {
        res.locals.telemetrySpan = span

        const spanContext = span.spanContext()
        res.setHeader('x-trace-id', spanContext.traceId)

        const responseCarrier: Record<string, string> = {}
        propagation.inject(context.active(), responseCarrier)
        for (const [key, value] of Object.entries(responseCarrier)) {
          if (value) {
            res.setHeader(key, value)
          }
        }

        const exposedHeaders = new Set(
          `${res.getHeader('access-control-expose-headers') ?? ''}`
            .split(',')
            .map((header) => header.trim())
            .filter(Boolean),
        )

        for (const header of ['traceparent', 'tracestate', 'x-request-id', 'x-trace-id']) {
          exposedHeaders.add(header)
        }

        res.setHeader('access-control-expose-headers', Array.from(exposedHeaders).join(', '))

        logger.info({ requestId, method: req.method, url: req.originalUrl }, 'request-start')

        let spanEnded = false
        const finalizeSpan = () => {
          if (spanEnded) {
            return
          }
          spanEnded = true

          const durationMs = Date.now() - start
          logger.info(
            {
              requestId,
              method: req.method,
              url: req.originalUrl,
              statusCode: res.statusCode,
              durationMs,
            },
            'request-complete',
          )

          span.setAttribute('http.status_code', res.statusCode)
          const contentLength = res.getHeader('content-length')
          if (contentLength) {
            const numericLength = Array.isArray(contentLength) ? contentLength[0] : contentLength
            const parsed = Number.parseInt(numericLength.toString(), 10)
            if (!Number.isNaN(parsed)) {
              span.setAttribute('http.response_content_length', parsed)
            }
          }

          if (res.statusCode >= 500) {
            span.setStatus({ code: SpanStatusCode.ERROR })
          }

          span.end()
        }

        res.on('finish', finalizeSpan)
        res.on('close', finalizeSpan)

        try {
          next()
        } catch (error) {
          span.recordException(error as Error)
          span.setStatus({ code: SpanStatusCode.ERROR })
          span.end()
          throw error
        }
      },
    )
  })

  app.get('/health', (_req, res) => {
    const payload: ApiHealth = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: [{ name: 'shared-data', status: 'pass' }],
    }

    res.json(payload)
  })

  app.use('/api', createApiRouter())

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err)
    }

    if (err instanceof ZodError) {
      logger.warn(
        {
          method: req.method,
          url: req.originalUrl,
          issues: err.issues,
        },
        'request-validation-error',
      )

      return res.status(400).json({
        message: 'Validation failed',
        issues: err.issues,
      })
    }

    const message = err instanceof Error ? err.message : 'Unexpected error'
    logger.error(
      {
        err,
        method: req.method,
        url: req.originalUrl,
        statusCode: 500,
      },
      'request-error',
    )

    res.status(500).json({ message })
  })

  return app
}
