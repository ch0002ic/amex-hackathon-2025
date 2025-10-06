import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AuthProfile } from './profile'
import { loadAuthProfile, persistAuthProfile, loadIdToken, persistIdToken } from './profile'
import type { ReviewerRole } from '../types'

interface AuthContextValue {
  profile: AuthProfile
  setProfile: (profile: AuthProfile) => void
  switchRole: (role: ReviewerRole) => void
  idToken: string | null
  setIdToken: (token: string | null) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<AuthProfile>(() => loadAuthProfile())
  const [idToken, setIdTokenState] = useState<string | null>(() => loadIdToken())

  const setProfile = useCallback((next: AuthProfile) => {
    setProfileState(next)
    persistAuthProfile(next)
  }, [])

  const setIdToken = useCallback((token: string | null) => {
    setIdTokenState(token)
    persistIdToken(token)
  }, [])

  const switchRole = useCallback((role: ReviewerRole) => {
    setProfileState((prev) => {
      const next: AuthProfile = {
        id:
          role === 'colleague'
            ? prev.id.replace(/^merchant\./, 'colleague.')
            : prev.id.replace(/^colleague\./, 'merchant.'),
        name: role === 'colleague' ? 'AMEX Colleague' : 'Merchant Partner',
        role,
      }

      persistAuthProfile(next)
      return next
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      setProfile,
      switchRole,
      idToken,
      setIdToken,
    }),
    [profile, setProfile, switchRole, idToken, setIdToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
