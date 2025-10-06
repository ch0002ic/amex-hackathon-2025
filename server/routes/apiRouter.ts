import { Router } from 'express'
import { createDashboardRouter } from './dashboardRoutes.js'
import { createPartnerRouter } from './partnerRoutes.js'

export function createApiRouter(): Router {
  const router = Router()

  router.use('/dashboard', createDashboardRouter())
  router.use('/partners', createPartnerRouter())

  return router
}
