import { z } from 'zod'

export const reviewerRoleSchema = z.enum(['merchant', 'colleague'])

export const partnerSignalInputSchema = z.object({
  partnerId: z.string().min(1, 'partnerId is required'),
  partnerName: z.string().min(1, 'partnerName is required'),
  merchantId: z.string().min(1, 'merchantId is required'),
  merchantName: z.string().min(1, 'merchantName is required'),
  signalType: z.enum(['growth', 'risk', 'retention', 'innovation', 'compliance']),
  description: z.string().min(20, 'description must highlight the partner insight'),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  assignedReviewerId: z.string().optional(),
  assignedReviewerName: z.string().optional(),
  assignedReviewerRole: reviewerRoleSchema.optional(),
})

export const partnerSignalSchema = partnerSignalInputSchema.extend({
  id: z.string(),
  submittedAt: z.string().datetime({ message: 'submittedAt must be an ISO timestamp' }),
  status: z.enum(['pending', 'approved', 'archived']),
  assignedReviewerId: z.string().nullable(),
  assignedReviewerName: z.string().nullable(),
  assignedReviewerRole: reviewerRoleSchema.nullable(),
  assignedAt: z.string().datetime({ message: 'assignedAt must be an ISO timestamp' }).nullable(),
})

export const partnerSignalListSchema = z.object({
  items: z.array(partnerSignalSchema),
})

export const partnerSignalFilterSchema = z.object({
  signalType: z.enum(['growth', 'risk', 'retention', 'innovation', 'compliance']).optional(),
  status: z.enum(['pending', 'approved', 'archived']).optional(),
})

export const partnerSignalStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'archived']),
  notes: z.string().max(500).optional(),
})

export const partnerSignalStatsSchema = z.object({
  total: z.number(),
  status: z.object({
    pending: z.number(),
    approved: z.number(),
    archived: z.number(),
  }),
  signalType: z.object({
    growth: z.number(),
    risk: z.number(),
    retention: z.number(),
    innovation: z.number(),
    compliance: z.number(),
  }),
})

export const partnerSignalAssignmentRequestSchema = z.object({
  reviewerId: z.string().min(1, 'reviewerId is required'),
  reviewerName: z.string().min(1, 'reviewerName is required'),
  reviewerRole: reviewerRoleSchema,
  notes: z.string().max(500).optional(),
})

export const partnerSignalAssignmentSchema = z.object({
  id: z.string(),
  signalId: z.string(),
  reviewerId: z.string(),
  reviewerName: z.string(),
  reviewerRole: reviewerRoleSchema,
  assignedAt: z.string().datetime(),
  active: z.boolean(),
})

export const partnerSignalAuditSchema = z.object({
  id: z.string(),
  signalId: z.string(),
  reviewerId: z.string(),
  reviewerName: z.string(),
  reviewerRole: reviewerRoleSchema,
  action: z.enum(['created', 'status_change', 'assigned']),
  fromStatus: z.enum(['pending', 'approved', 'archived']).nullable(),
  toStatus: z.enum(['pending', 'approved', 'archived']).nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
})

export const partnerSignalAuditListSchema = z.object({
  items: z.array(partnerSignalAuditSchema),
})

export const partnerSignalAssignmentListSchema = z.object({
  items: z.array(partnerSignalAssignmentSchema),
})

export type PartnerSignalInputPayload = z.infer<typeof partnerSignalInputSchema>
export type PartnerSignalPayload = z.infer<typeof partnerSignalSchema>
export type PartnerSignalListPayload = z.infer<typeof partnerSignalListSchema>
export type PartnerSignalFilterPayload = z.infer<typeof partnerSignalFilterSchema>
export type PartnerSignalStatusPayload = z.infer<typeof partnerSignalStatusSchema>
export type PartnerSignalStatsPayload = z.infer<typeof partnerSignalStatsSchema>
export type PartnerSignalAssignmentRequestPayload = z.infer<typeof partnerSignalAssignmentRequestSchema>
export type PartnerSignalAssignmentPayload = z.infer<typeof partnerSignalAssignmentSchema>
export type PartnerSignalAssignmentListPayload = z.infer<typeof partnerSignalAssignmentListSchema>
export type PartnerSignalAuditPayload = z.infer<typeof partnerSignalAuditSchema>
export type PartnerSignalAuditListPayload = z.infer<typeof partnerSignalAuditListSchema>
