import { createApp } from './app.js'
import { databaseReady } from './db/client.js'
import { initTelemetry } from './telemetry.js'
import { logger } from './utils/logger.js'

async function bootstrap() {
  initTelemetry()
  await databaseReady

  const port = Number.parseInt(process.env.PORT ?? '5050', 10)
  const app = createApp()

  app.listen(port, () => {
    logger.info({ port }, '⚡️ Ecosystem Intelligence API listening')
  })
}

void bootstrap()
