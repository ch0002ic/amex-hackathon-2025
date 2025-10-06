import type { ReviewerRole } from '../types'

const PROFILE_STORAGE_KEY = 'amex.auth.profile'
const ID_TOKEN_STORAGE_KEY = 'amex.auth.idToken'

type StoredProfile = {
  id: string
  name: string
  role: ReviewerRole
}

const defaultProfile: StoredProfile = {
  id: 'merchant.guest',
  name: 'Merchant Partner',
  role: 'merchant',
}

export function loadAuthProfile(): StoredProfile {
  if (typeof window === 'undefined') {
    return defaultProfile
  }

  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) {
      return defaultProfile
    }

    const parsed = JSON.parse(raw) as Partial<StoredProfile>
    if (!parsed || typeof parsed !== 'object') {
      return defaultProfile
    }

    const role = parsed.role === 'colleague' ? 'colleague' : 'merchant'
    const id = typeof parsed.id === 'string' && parsed.id.trim().length > 0 ? parsed.id.trim() : defaultProfile.id
    const name = typeof parsed.name === 'string' && parsed.name.trim().length > 0 ? parsed.name.trim() : defaultProfile.name

    return { id, name, role }
  } catch (error) {
    console.warn('Unable to parse stored auth profile', error)
    return defaultProfile
  }
}

export function persistAuthProfile(profile: StoredProfile): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
}

export function clearAuthProfile(): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(PROFILE_STORAGE_KEY)
}

export function loadIdToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const value = window.localStorage.getItem(ID_TOKEN_STORAGE_KEY)
  return value && value.trim().length > 0 ? value.trim() : null
}

export function persistIdToken(token: string | null): void {
  if (typeof window === 'undefined') {
    return
  }

  if (!token) {
    window.localStorage.removeItem(ID_TOKEN_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(ID_TOKEN_STORAGE_KEY, token)
}

export type AuthProfile = StoredProfile
