'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types/database'
import { FEATURES_ALL_PRO, FEATURES_DEFAULT, shouldShowProBadges, type PlanFeatureKey, type PlanFeatures } from '@/lib/plan'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => void
  hasPermission: (perm: string) => boolean
  hasFeature: (feature: PlanFeatureKey) => boolean
  planFeatures: PlanFeatures
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: () => {},
  hasPermission: () => false,
  hasFeature: () => false,
  planFeatures: FEATURES_DEFAULT,
})

export function useAuth() {
  return useContext(AuthContext)
}

/** Hook de conveniencia: `const canEdit = useHasPermission('cobranzas.edit')` */
export function useHasPermission(perm: string): boolean {
  const { hasPermission } = useContext(AuthContext)
  return hasPermission(perm)
}

/** Hook para gating UI por plan: `const canLab = useHasFeature('laboratorio')` */
export function useHasFeature(feature: PlanFeatureKey): boolean {
  const { hasFeature } = useContext(AuthContext)
  return hasFeature(feature)
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
  // En el deploy demo (NEXT_PUBLIC_SHOW_PRO_BADGES=true) forzamos Pro completo
  // de entrada, sin esperar el RPC. Así el flow no pasa nunca por el upsell card
  // ni por sidebar grayed-out aunque la suscripción de la clínica demo esté
  // mal seteada en la DB. Los chips "Pro" siguen apareciendo gracias a
  // ProBadge que también lee la misma env var.
  const isDemo = shouldShowProBadges()
  const [planFeatures, setPlanFeatures] = useState<PlanFeatures>(isDemo ? FEATURES_ALL_PRO : FEATURES_DEFAULT)
  const supabase = createClient()
  const hiddenAtRef = useRef(0)

  // Fetch plan features once at mount. No auth listener needed — this is per-clinic
  // and only changes when a super-admin bumps the plan, which is rare.
  // En modo demo NO consultamos: el override de FEATURES_ALL_PRO ya está aplicado.
  useEffect(() => {
    if (isDemo) return
    if (!initialUser) return
    let cancelled = false
    supabase.rpc('get_plan_features').then((res: { data: unknown; error: unknown }) => {
      if (cancelled || res.error || !res.data) return
      setPlanFeatures({ ...FEATURES_DEFAULT, ...(res.data as PlanFeatures) })
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUser?.clinic_id, isDemo])

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

  const hasFeature = (feature: PlanFeatureKey): boolean => {
    return planFeatures[feature] === true
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut, hasPermission, hasFeature, planFeatures }}>
      {children}
    </AuthContext.Provider>
  )
}
