'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types/database'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => void
  hasPermission: (perm: string) => boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: () => {},
  hasPermission: () => false,
})

export function useAuth() {
  return useContext(AuthContext)
}

/** Hook de conveniencia: `const canEdit = useHasPermission('cobranzas.edit')` */
export function useHasPermission(perm: string): boolean {
  const { hasPermission } = useContext(AuthContext)
  return hasPermission(perm)
}

function forceLogout() {
  // Clear ALL Supabase cookies without any API calls
  document.cookie.split(';').forEach(c => {
    const name = c.trim().split('=')[0]
    if (name.startsWith('sb-')) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
    }
  })
  window.location.href = '/login'
}

export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser: User | null }) {
  const [user] = useState<User | null>(initialUser)
  const [loading] = useState(false)
  const supabase = createClient()
  const hiddenAtRef = useRef(0)

  // DO NOT use onAuthStateChange here.
  // Supabase's _recoverAndRefresh() fires SIGNED_IN on EVERY visibility
  // change (tab switch). That was triggering setUser(newObject) → new user
  // reference → components with `user` in useEffect deps re-fetched →
  // setLoading(true) → "Cargando..." forever on stale connections.
  //
  // The initialUser prop from the server component is all we need.
  // Login happens on /login page (outside this provider).
  // Session expiry is caught by middleware on next navigation.

  // When the tab goes to background and comes back, stale HTTP connections
  // cause fetch() calls to hang forever. The SAFEST strategy:
  // - Short absence: do NOTHING (existing data stays visible, no risk of hanging)
  // - Long absence: hard reload (creates fresh connections, guaranteed clean state)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
      } else if (document.visibilityState === 'visible' && hiddenAtRef.current > 0) {
        const elapsed = Date.now() - hiddenAtRef.current
        hiddenAtRef.current = 0

        // > 2 minutes away: hard reload for guaranteed clean state
        if (elapsed > 120_000) {
          window.location.reload()
        }
        // < 2 minutes: do nothing, existing data stays visible
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Logout: NEVER await API calls that might hang.
  // Use scope:'local' to skip the server revocation call, then clear cookies.
  const handleSignOut = () => {
    supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    forceLogout()
  }

  const hasPermission = (perm: string): boolean => {
    return !!user?.permissions?.includes(perm)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}
