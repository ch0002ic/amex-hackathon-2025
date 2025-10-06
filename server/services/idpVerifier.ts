import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import type { ReviewerRole } from '../../shared/types/domain.js'
import { logger } from '../utils/logger.js'

interface VerifiedIdentity {
  id: string
  name: string
  role: ReviewerRole
}

const ENABLED = process.env.ENABLE_IDP_INTEGRATION === 'true'
const JWKS_URL = process.env.IDP_JWKS_URL
const ISSUER = process.env.IDP_ISSUER
const AUDIENCE = process.env.IDP_AUDIENCE
const ROLE_CLAIM = process.env.IDP_ROLE_CLAIM ?? 'role'
const USER_ID_CLAIM = process.env.IDP_USER_ID_CLAIM ?? 'sub'
const USER_NAME_CLAIM = process.env.IDP_USER_NAME_CLAIM ?? 'name'
const GROUPS_CLAIM = process.env.IDP_GROUPS_CLAIM ?? 'groups'
const MODERATOR_GROUPS = parseCsv(process.env.IDP_MODERATOR_GROUPS)

let remoteJwks: ReturnType<typeof createRemoteJWKSet> | null = null

export async function verifyIdentityToken(token: string): Promise<VerifiedIdentity | null> {
  if (!ENABLED || !JWKS_URL || !ISSUER || !AUDIENCE) {
    return null
  }

  try {
    if (!remoteJwks) {
      remoteJwks = createRemoteJWKSet(new URL(JWKS_URL))
    }

    const { payload } = await jwtVerify(token, remoteJwks, {
      issuer: ISSUER,
      audience: AUDIENCE,
    })

    return mapPayloadToIdentity(payload)
  } catch (error) {
    logger.warn({ err: error }, 'idp-token-verification-failed')
    return null
  }
}

function mapPayloadToIdentity(payload: JWTPayload): VerifiedIdentity | null {
  const id = readStringClaim(payload, USER_ID_CLAIM)
  if (!id) {
    return null
  }

  const explicitRole = parseRole(readClaim(payload, ROLE_CLAIM))
  const groups = normalizeToArray(readClaim(payload, GROUPS_CLAIM))
  const isModerator = groups.some((group) => MODERATOR_GROUPS.includes(group))
  const role: ReviewerRole = explicitRole ?? (isModerator ? 'colleague' : 'merchant')

  const name = readStringClaim(payload, USER_NAME_CLAIM) ?? buildDisplayName(role)

  return {
    id,
    name,
    role,
  }
}

function readClaim(payload: JWTPayload, key: string): unknown {
  return payload[key]
}

function readStringClaim(payload: JWTPayload, key: string): string | null {
  const value = readClaim(payload, key)
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  return null
}

function normalizeToArray(value: unknown): string[] {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value.map((entry) => `${entry}`.trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  return []
}

function parseRole(value: unknown): ReviewerRole | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.toLowerCase()
  if (normalized.includes('colleague') || normalized.includes('moderator')) {
    return 'colleague'
  }
  if (normalized.includes('merchant')) {
    return 'merchant'
  }

  return null
}

function parseCsv(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function buildDisplayName(role: ReviewerRole): string {
  return role === 'colleague' ? 'AMEX Colleague' : 'Merchant Partner'
}
