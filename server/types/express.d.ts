import type { ReviewerRole } from '../../shared/types/domain.js'

declare global {
  namespace Express {
    interface UserProfile {
      id: string
      name: string
      role: ReviewerRole
    }

    interface Request {
      user: UserProfile
    }
  }
}

export {}
