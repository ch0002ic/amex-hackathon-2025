import type { NextFunction, Request, Response } from 'express'
import type { ReviewerRole } from '../../shared/types/domain.js'

import { verifyIdentityToken } from '../services/idpVerifier.js'

const IDP_REQUIRED = process.env.IDP_REQUIRE_TOKEN === 'true'
const IDP_ENABLED = process.env.ENABLE_IDP_INTEGRATION === 'true'

type HeaderValue = string | string[] | undefined

function normalizeHeader(value: HeaderValue): string | undefined {
  if (!value) {
    return undefined
  }

  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function parseRole(role: string | undefined): ReviewerRole {
  if (role === 'merchant' || role === 'colleague') {
    return role
  }

  return 'merchant'
}

function buildDisplayName(name: string | undefined, role: ReviewerRole): string {
  if (name && name.trim().length > 0) {
    return name.trim()
  }

  return role === 'colleague' ? 'AMEX Colleague' : 'Merchant Partner'
}

export async function attachRequestUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const headerRole = normalizeHeader(req.headers['x-user-role'])
    const headerId = normalizeHeader(req.headers['x-user-id'])
    const headerName = normalizeHeader(req.headers['x-user-name'])

    const fallbackRole = parseRole(headerRole)
    const fallbackId = headerId && headerId.trim().length > 0 ? headerId.trim() : `anon-${fallbackRole}`
    const fallbackName = buildDisplayName(headerName, fallbackRole)

    let resolvedId = fallbackId
    let resolvedName = fallbackName
    let resolvedRole = fallbackRole

    if (IDP_ENABLED) {
      const token = extractBearerToken(req) ?? normalizeHeader(req.headers['x-id-token'])
      if (token) {
        const identity = await verifyIdentityToken(token)
        if (identity) {
          resolvedId = identity.id
          resolvedName = identity.name
          resolvedRole = identity.role
        } else if (IDP_REQUIRED) {
          res.status(401).json({ message: 'Unable to verify identity token' })
          return
        }
      } else if (IDP_REQUIRED) {
        res.status(401).json({ message: 'Identity token required' })
        return
      }
    }

    req.user = {
      id: resolvedId,
      name: resolvedName,
      role: resolvedRole,
    }

    next()
  } catch (error) {
    next(error)
  }
}

function extractBearerToken(req: Request): string | null {
  const authorization = normalizeHeader(req.headers.authorization)
  if (!authorization) {
    return null
  }

  const [scheme, value] = authorization.split(' ')
  if (!value || scheme.toLowerCase() !== 'bearer') {
    return null
  }

  return value.trim()
}
