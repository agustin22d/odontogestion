'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const email = username.includes('@') ? username : `${username.toLowerCase().trim()}@badentalstudio.com`

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Usuario o contraseña incorrectos')
      setLoading(false)
      return
    }

    // Check if must change password
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const { data: profile } = await supabase
        .from('users')
        .select('must_change_password')
        .eq('id', authUser.id)
        .single()
      if (profile?.must_change_password) {
        router.push('/cambiar-clave')
        router.refresh()
        return
      }
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-beige flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-green-primary" />
            <span className="text-xs font-medium tracking-[0.18em] uppercase text-text-primary">
              BA Dental Studio
            </span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-text-primary">
            Sistema de Gestión
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Ingresá con tu cuenta para continuar
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-surface rounded-xl border border-border p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-medium tracking-wide uppercase text-text-secondary mb-1.5">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tu usuario"
                required
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium tracking-wide uppercase text-text-secondary mb-1.5">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-light border border-red/20 rounded-lg text-sm text-red">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full bg-green-primary hover:bg-green-dark text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-xs text-text-muted mt-6">
          BA Dental Studio &middot; Gestión Integral
        </p>
      </div>
    </div>
  )
}
