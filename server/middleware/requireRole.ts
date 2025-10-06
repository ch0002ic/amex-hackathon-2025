import type { NextFunction, Request, Response } from 'express'
import type { ReviewerRole } from '../../shared/types/domain.js'

export function requireRole(...allowedRoles: ReviewerRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role ?? 'merchant'

    if (!allowedRoles.includes(role)) {
      res.status(403).json({ message: 'Insufficient permissions' })
      return
    }

    next()
  }
}
