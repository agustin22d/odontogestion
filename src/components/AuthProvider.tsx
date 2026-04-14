'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types/database'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  dataVersion: number // increments on session recovery — triggers data refetch in pages
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  dataVersion: 0,
})

export function useAuth() {
  return useContext(AuthContext)
}

const SYNC_COOLDOWN_MS = 30 * 60 * 1000 // 30 minutes

function shouldAutoSync(): boolean {
  if (typeof window === 'undefined') return false
  const last = localStorage.getItem('last_auto_sync')
  if (!last) return true
  return Date.now() - parseInt(last, 10) > SYNC_COOLDOWN_MS
}

function markSynced() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('last_auto_sync', Date.now().toString())
  }
}

function triggerSync() {
  markSynced()
  fetch('/api/sync-dentalink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dias: 7 }),
  }).catch(() => {})
  fetch('/api/sync-pagos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dias: 7 }),
  }).catch(() => {})
  // Sync pacientes nuevos del día (trae fecha_afiliacion de Dentalink en vivo)
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  fetch(`/api/dentalink-agendados?fecha=${hoy}`).catch(() => {})
  // Sync por cobrar (tratamientos con deuda desde Dentalink)
  fetch('/api/sync-por-cobrar', { method: 'POST' }).catch(() => {})
}

export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [loading, setLoading] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)
  const supabase = createClient()

  // Auto-sync on page load for admin (with 30min cooldown)
  useEffect(() => {
    if (initialUser?.rol === 'admin' && shouldAutoSync()) {
      triggerSync()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single()
          setUser(profile)

          // Redirect to password change if needed
          if (profile?.must_change_password && typeof window !== 'undefined' && !window.location.pathname.includes('cambiar-clave')) {
            window.location.href = '/cambiar-clave'
            return
          }

          // Auto-sync on login (admin only)
          if (event === 'SIGNED_IN' && profile?.rol === 'admin' && shouldAutoSync()) {
            triggerSync()
          }
        }

        // Session was refreshed after expiry — tell pages to refetch data
        if (event === 'TOKEN_REFRESHED') {
          setDataVersion(v => v + 1)
        }
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recover session when user returns to the tab after being away
  // Browsers throttle timers in background tabs, so Supabase's auto-refresh
  // may not fire. This forces a refresh as soon as the tab is visible again.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.auth.getUser().then(({ error }: { error: any }) => {
          if (error) {
            // Session truly expired (refresh token invalid) — force re-login
            console.error('Session expired, redirecting to login:', error.message)
            document.cookie.split(';').forEach(c => {
              const name = c.trim().split('=')[0]
              if (name.startsWith('sb-')) {
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
              }
            })
            window.location.href = '/login'
          }
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Error signing out:', err)
    }
    // Force-clear all Supabase auth cookies so middleware doesn't redirect back
    document.cookie.split(';').forEach(c => {
      const name = c.trim().split('=')[0]
      if (name.startsWith('sb-')) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
      }
    })
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut, dataVersion }}>
      {children}
    </AuthContext.Provider>
  )
}
