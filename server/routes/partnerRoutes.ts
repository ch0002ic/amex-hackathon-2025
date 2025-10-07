import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  assignPartnerSignalReviewer,
  getPartnerSignal,
  listPartnerSignalAssignments,
  listPartnerSignalAudits,
  listPartnerSignalStats,
  listPartnerSignals,
  recordPartnerSignal,
  updatePartnerSignalStatus,
} from '../services/partnerSignals.js'
import {
  partnerSignalAssignmentListSchema,
  partnerSignalAssignmentRequestSchema,
  partnerSignalInputSchema,
  partnerSignalListSchema,
  partnerSignalSchema,
  partnerSignalFilterSchema,
  partnerSignalStatusSchema,
  partnerSignalStatsSchema,
  partnerSignalAuditListSchema,
  shadowQueueDecisionSchema,
  shadowQueueItemSchema,
  shadowQueueListSchema,
} from '../schemas/partners.js'
import { requireRole } from '../middleware/requireRole.js'
import {
  isShadowQueueEnabled,
  listShadowApprovalQueue,
  recordShadowQueueDecision,
} from '../services/shadowApprovalQueue.js'

export function createPartnerRouter(): Router {
  const router = Router()

  router.get(
    '/signals',
    asyncHandler(async (req, res) => {
      const { signalType, status } = partnerSignalFilterSchema.parse(req.query)
      const payload = partnerSignalListSchema.parse({
        items: await listPartnerSignals(signalType, status),
      })

      res.json(payload)
    }),
  )

  router.post(
    '/signals',
    asyncHandler(async (req, res) => {
      const input = partnerSignalInputSchema.parse(req.body)
      const created = partnerSignalSchema.parse(
        await recordPartnerSignal({
          ...input,
          assignedReviewerId: input.assignedReviewerId ?? (req.user.role === 'colleague' ? req.user.id : undefined),
          assignedReviewerName: input.assignedReviewerName ?? (req.user.role === 'colleague' ? req.user.name : undefined),
          assignedReviewerRole: input.assignedReviewerRole ?? (req.user.role === 'colleague' ? req.user.role : undefined),
        }),
      )

      res.status(201).json(created)
    }),
  )

  router.get(
    '/signals/stats',
    asyncHandler(async (_req, res) => {
      const stats = partnerSignalStatsSchema.parse(await listPartnerSignalStats())
      res.json(stats)
    }),
  )

  router.get(
    '/signals/:id',
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const signal = await getPartnerSignal(id)
      if (!signal) {
        res.status(404).json({ message: 'Signal not found' })
        return
      }

      res.json(partnerSignalSchema.parse(signal))
    }),
  )

  router.patch(
    '/signals/:id/status',
    requireRole('colleague'),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const { status, notes } = partnerSignalStatusSchema.parse(req.body)
      const updated = await updatePartnerSignalStatus(id, status, {
        reviewerId: req.user.id,
        reviewerName: req.user.name,
        reviewerRole: req.user.role,
        notes,
      })
      if (!updated) {
        res.status(404).json({ message: 'Signal not found' })
        return
      }

      res.json(partnerSignalSchema.parse(updated))
    }),
  )

  router.get(
    '/signals/:id/audits',
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const audits = await listPartnerSignalAudits(id)
      res.json(partnerSignalAuditListSchema.parse({ items: audits }))
    }),
  )

  router.get(
    '/signals/:id/assignments',
    requireRole('colleague'),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const assignments = await listPartnerSignalAssignments(id)
      res.json(partnerSignalAssignmentListSchema.parse({ items: assignments }))
    }),
  )

  router.post(
    '/signals/:id/assignments',
    requireRole('colleague'),
    asyncHandler(async (req, res) => {
      const { id } = req.params
      const payload = partnerSignalAssignmentRequestSchema.parse(req.body)
      const updated = await assignPartnerSignalReviewer(id, payload)

      if (!updated) {
        res.status(404).json({ message: 'Signal not found' })
        return
      }

      res.json(partnerSignalSchema.parse(updated))
    }),
  )

  router.get(
    '/shadow-queue',
    requireRole('colleague'),
    asyncHandler(async (req, res) => {
      if (!isShadowQueueEnabled()) {
        res.json(shadowQueueListSchema.parse({ items: [] }))
        return
      }

      const tier = typeof req.query.tier === 'string' && req.query.tier.length > 0 ? req.query.tier : undefined
      const queue = await listShadowApprovalQueue(tier)
      res.json(shadowQueueListSchema.parse({ items: queue }))
    }),
  )

  router.post(
    '/shadow-queue/:id/decision',
    requireRole('colleague'),
    asyncHandler(async (req, res) => {
      if (!isShadowQueueEnabled()) {
        res.status(404).json({ message: 'Shadow approval queue is disabled' })
        return
      }

      const decision = shadowQueueDecisionSchema.parse(req.body)
      const updated = await recordShadowQueueDecision(req.params.id, { id: req.user.id, name: req.user.name }, decision)

      if (!updated) {
        res.status(404).json({ message: 'Queue item not found or already processed' })
        return
      }

      res.json(shadowQueueItemSchema.parse(updated))
    }),
  )

  return router
}
