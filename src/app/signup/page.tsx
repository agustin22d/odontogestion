'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [clinicName, setClinicName] = useState('')
  const [adminNombre, setAdminNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const cleanEmail = email.trim()
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    })

    // Si "Confirm email" está ON en Supabase, signUp devuelve el user pero
    // sin session — auth.uid() quedaría NULL y el RPC tiraría not_authenticated.
    // Intentamos un login directo para forzar la sesión; si falla, pedimos al
    // usuario que confirme el mail primero.
    if (!signUpData?.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })
      if (signInError) {
        if (signUpError) {
          setError(signUpError.message)
        } else {
          setError('Revisá tu email para confirmar la cuenta antes de crear la clínica.')
        }
        setLoading(false)
        return
      }
    } else if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    const { error: rpcError } = await supabase.rpc('create_clinic_with_admin', {
      p_clinic_name: clinicName.trim(),
      p_admin_nombre: adminNombre.trim(),
    })
    if (rpcError) {
      setError(rpcError.message || 'No pudimos crear la clínica. Intentá nuevamente.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-beige flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-green-primary" />
            <span className="text-xs font-medium tracking-[0.18em] uppercase text-text-primary">
              Odonto Gestión
            </span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-text-primary">
            Creá tu clínica
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Probá el sistema 14 días gratis · plan Free
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} className="bg-surface rounded-xl border border-border p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="clinicName" className="block text-xs font-medium tracking-wide uppercase text-text-secondary mb-1.5">
                Nombre de la clínica
              </label>
              <input
                id="clinicName"
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="Mi Clínica Dental"
                required
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="adminNombre" className="block text-xs font-medium tracking-wide uppercase text-text-secondary mb-1.5">
                Tu nombre
              </label>
              <input
                id="adminNombre"
                type="text"
                value={adminNombre}
                onChange={(e) => setAdminNombre(e.target.value)}
                placeholder="Nombre y apellido"
                required
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-medium tracking-wide uppercase text-text-secondary mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
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
                placeholder="mínimo 8 caracteres"
                minLength={8}
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
            {loading ? 'Creando clínica...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-green-primary hover:text-green-dark font-medium">
            Ingresar
          </Link>
        </p>

        <p className="text-center text-xs text-text-muted mt-4">
          Odonto Gestión · Sistema Integral
        </p>
      </div>
    </div>
  )
}
