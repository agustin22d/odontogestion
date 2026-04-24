'use client'

import { useState } from 'react'
import { ShieldCheck, AlertCircle, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function SysadminLogin({ denied, userEmail }: { denied?: boolean; userEmail?: string | null }) {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: e1 } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (e1) {
      setError(e1.message)
      setSubmitting(false)
      return
    }
    // El page server vuelve a renderizar con sesión activa y chequea is_super_admin.
    window.location.href = '/sysadmin'
  }

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    document.cookie.split(';').forEach(c => {
      const name = c.trim().split('=')[0]
      if (name.startsWith('sb-')) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
      }
    })
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-700 mb-3">
            <ShieldCheck size={22} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Super-admin</h1>
          <p className="text-sm text-text-secondary">Panel interno de administración</p>
        </div>

        <div className="bg-surface rounded-xl border border-border p-6 shadow-sm">
          {denied ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-red-light text-red rounded-lg">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Acceso denegado</p>
                  <p className="text-xs mt-0.5">La cuenta {userEmail ?? ''} no tiene privilegios de super-admin.</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-text-primary hover:bg-text-primary/90 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <LogOut size={14} /> Cerrar sesión y entrar con otra cuenta
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-bg focus:outline-none focus:border-green-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-bg focus:outline-none focus:border-green-primary"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-2.5 bg-red-light text-red rounded-lg text-sm">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2.5 bg-green-primary hover:bg-green-primary/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {submitting ? 'Entrando...' : 'Entrar al panel'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-text-muted mt-4">
          <a href="/" className="hover:text-text-primary">← Volver al inicio</a>
        </p>
      </div>
    </div>
  )
}
