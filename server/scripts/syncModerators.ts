#!/usr/bin/env node
import { databaseReady } from '../db/client.js'
import {
  deactivateMissingModerators,
  ensureModeratorTransaction,
  logModeratorSyncResult,
  upsertModerators,
  type UpsertModeratorInput,
} from '../services/moderators.js'
import { logger } from '../utils/logger.js'

interface ScimListResponse<T> {
  Resources?: T[]
  itemsPerPage?: number
  startIndex?: number
  totalResults?: number
}

interface ScimGroup {
  id: string
  displayName?: string
  members?: Array<{ value: string }>
}

interface ScimUser {
  id: string
  userName?: string
  displayName?: string
  name?: {
    formatted?: string
    givenName?: string
    familyName?: string
  }
  emails?: Array<{ value: string; primary?: boolean }>
  active?: boolean
  groups?: Array<{ value?: string; display?: string }>
}

const baseUrl = process.env.IDP_SCIM_BASE_URL
const token = process.env.IDP_SCIM_TOKEN
const groupIds = parseList(process.env.IDP_SCIM_GROUP_IDS)
const dryRun = process.argv.includes('--dry-run')

async function main(): Promise<void> {
  if (!baseUrl || !token || groupIds.length === 0) {
    logger.error('Missing SCIM configuration. Please set IDP_SCIM_BASE_URL, IDP_SCIM_TOKEN, and IDP_SCIM_GROUP_IDS')
    process.exitCode = 1
    return
  }

  await databaseReady

  const moderatorMap = new Map<string, UpsertModeratorInput>()

  for (const groupId of groupIds) {
    const memberIds = await fetchGroupMemberIds(groupId)
    for (const memberId of memberIds) {
      const user = await fetchUser(memberId)
      if (!user) {
        continue
      }

      const record = mapUserToModerator(user)
      const existing = moderatorMap.get(record.id)
      if (existing) {
        moderatorMap.set(record.id, mergeModerators(existing, record))
      } else {
        moderatorMap.set(record.id, record)
      }
    }
  }

  const moderators = Array.from(moderatorMap.values())

  if (dryRun) {
    logger.info({ moderators }, 'dry-run-complete')
    return
  }

  const activeModeratorIds = moderators.filter((moderator) => moderator.active !== false).map((moderator) => moderator.id)

  await ensureModeratorTransaction(async (client) => {
    await upsertModerators(moderators, client)
    await deactivateMissingModerators(activeModeratorIds, client)
  })

  logModeratorSyncResult(moderators.length)
}

async function fetchGroupMemberIds(groupId: string): Promise<string[]> {
  const response = await fetch(`${baseUrl}/Groups/${encodeURIComponent(groupId)}`, {
    headers: buildHeaders(),
  })

  if (!response.ok) {
    logger.warn({ status: response.status, groupId }, 'scim-group-fetch-failed')
    return []
  }

  const payload = (await response.json()) as ScimGroup
  return (payload.members ?? []).map((member) => member.value).filter(Boolean)
}

async function fetchUser(userId: string): Promise<ScimUser | null> {
  const response = await fetch(`${baseUrl}/Users/${encodeURIComponent(userId)}`, {
    headers: buildHeaders(),
  })

  if (!response.ok) {
    logger.warn({ status: response.status, userId }, 'scim-user-fetch-failed')
    return null
  }

  return (await response.json()) as ScimUser
}

function mapUserToModerator(user: ScimUser): UpsertModeratorInput {
  const structuredName = user.displayName ?? user.name?.formatted ?? [user.name?.givenName, user.name?.familyName].filter(Boolean).join(' ')
  const fallbackName = user.userName ?? user.id
  const name = structuredName && structuredName.length > 0 ? structuredName : fallbackName
  const primaryEmail = resolvePrimaryEmail(user.emails)

  const metadata: Record<string, unknown> = {}
  if (user.groups) {
    metadata.groups = user.groups.map((group) => group.display ?? group.value).filter(Boolean)
  }

  return {
    id: user.id,
    name,
    email: primaryEmail ?? null,
    role: 'colleague',
    metadata,
    active: user.active !== false,
    source: 'scim',
  }
}

function resolvePrimaryEmail(emails: ScimUser['emails']): string | null {
  if (!emails || emails.length === 0) {
    return null
  }

  const primary = emails.find((email) => email.primary)
  if (primary?.value) {
    return primary.value
  }

  return emails[0]?.value ?? null
}

function mergeModerators(left: UpsertModeratorInput, right: UpsertModeratorInput): UpsertModeratorInput {
  const mergedMetadata: Record<string, unknown> = {
    ...(left.metadata ?? {}),
    ...(right.metadata ?? {}),
  }

  const leftGroups = extractGroups(left.metadata)
  const rightGroups = extractGroups(right.metadata)
  const mergedGroups = Array.from(new Set([...leftGroups, ...rightGroups]))
  if (mergedGroups.length > 0) {
    mergedMetadata.groups = mergedGroups
  }

  return {
    ...left,
    ...right,
    email: right.email ?? left.email,
    metadata: mergedMetadata,
    active: right.active ?? left.active,
  }
}

function extractGroups(metadata?: Record<string, unknown>): string[] {
  if (!metadata) {
    return []
  }

  const raw = (metadata as { groups?: unknown }).groups
  if (!raw) {
    return []
  }

  if (Array.isArray(raw)) {
    return raw.map((entry) => `${entry}`).filter(Boolean)
  }

  return [`${raw}`].filter(Boolean)
}

function buildHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/scim+json',
    'Content-Type': 'application/scim+json',
  }
}

function parseList(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

void main().catch((error) => {
  logger.error({ err: error }, 'moderator-sync-failed')
  process.exitCode = 1
})
