'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Sparkles, Copy, Check } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<'email' | 'password' | null>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Credenciales demo desde env vars. Si no están seteadas, el banner no
  // aparece — así prod no muestra credenciales y DEV/demo sí.
  const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL || ''
  const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD || ''
  const showDemo = Boolean(demoEmail && demoPassword)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  const autocompletar = () => {
    setEmail(demoEmail)
    setPassword(demoPassword)
  }

  const copy = async (text: string, kind: 'email' | 'password') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-beige flex items-center justify-center px-4 py-8">
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
            Ingresar
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Gestión integral para tu clínica dental
          </p>
        </div>

        {/* Banner demo (solo si hay env vars) */}
        {showDemo && (
          <div className="mb-4 p-4 bg-blue-light border border-blue/20 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-blue" />
              <p className="text-xs font-semibold tracking-wider uppercase text-blue">
                Acceso demo
              </p>
            </div>
            <p className="text-xs text-text-secondary mb-3">
              Probá el sistema con datos de ejemplo:
            </p>
            <div className="space-y-1.5 mb-3">
              <button
                type="button"
                onClick={() => copy(demoEmail, 'email')}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 bg-white border border-border rounded-lg text-xs hover:border-blue transition-colors group"
              >
                <span className="font-mono text-text-primary truncate">{demoEmail}</span>
                {copied === 'email' ? (
                  <Check size={12} className="text-green-primary shrink-0" />
                ) : (
                  <Copy size={12} className="text-text-muted group-hover:text-blue shrink-0" />
                )}
              </button>
              <button
                type="button"
                onClick={() => copy(demoPassword, 'password')}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 bg-white border border-border rounded-lg text-xs hover:border-blue transition-colors group"
              >
                <span className="font-mono text-text-primary truncate">{demoPassword}</span>
                {copied === 'password' ? (
                  <Check size={12} className="text-green-primary shrink-0" />
                ) : (
                  <Copy size={12} className="text-text-muted group-hover:text-blue shrink-0" />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={autocompletar}
              className="w-full px-3 py-2 bg-blue text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              Autocompletar y probar
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-surface rounded-xl border border-border p-6 shadow-sm">
          <div className="space-y-4">
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

        <p className="text-center text-sm text-text-secondary mt-6">
          ¿No tenés cuenta?{' '}
          <Link href="/signup" className="text-green-primary hover:text-green-dark font-medium">
            Creá una clínica
          </Link>
        </p>

        <p className="text-center text-xs text-text-muted mt-4">
          Odonto Gestión · Sistema Integral
        </p>
      </div>
    </div>
  )
}
