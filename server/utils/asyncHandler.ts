import type { Request, Response, NextFunction, RequestHandler } from 'express'

export function asyncHandler<T extends RequestHandler>(handler: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next)
    } catch (error) {
      next(error)
    }
  }
}
