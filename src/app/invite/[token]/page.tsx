'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle } from 'lucide-react'

interface InvitationInfo {
  email: string
  clinic_nombre: string
  role_nombre: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expires_at: string
}

export default function InvitePage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = params?.token
  const supabase = useMemo(() => createClient(), [])

  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [nombre, setNombre] = useState('')
  const [password, setPassword] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    ;(async () => {
      const { data, error } = await supabase.rpc('get_invitation_by_token', { p_token: token })
      if (error) {
        setLoadError('No pudimos cargar la invitación. Probá el link de nuevo.')
      } else if (!data || (Array.isArray(data) && data.length === 0)) {
        setLoadError('Invitación no encontrada.')
      } else {
        const inv = Array.isArray(data) ? data[0] : data
        setInfo(inv as InvitationInfo)
      }
      setLoading(false)
    })()
  }, [token, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!info || !token) return
    setSubmitting(true)
    setSubmitError('')

    // Signup con el email invitado
    const { error: signupError } = await supabase.auth.signUp({
      email: info.email,
      password,
    })
    if (signupError && !signupError.message.toLowerCase().includes('already')) {
      setSubmitError(signupError.message)
      setSubmitting(false)
      return
    }

    // Si el email ya existía, intentamos login (el usuario ya se había creado
    // en un intento previo o tenía cuenta).
    if (signupError) {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: info.email,
        password,
      })
      if (loginError) {
        setSubmitError('Ya existe una cuenta con ese email pero la contraseña no coincide.')
        setSubmitting(false)
        return
      }
    }

    // Aceptar la invitación (crea la membership + marca accepted)
    const { error: acceptError } = await supabase.rpc('accept_invitation', {
      p_token: token,
      p_nombre: nombre.trim(),
    })
    if (acceptError) {
      setSubmitError(mapAcceptError(acceptError.message))
      setSubmitting(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-beige flex items-center justify-center px-4">
        <p className="text-sm text-text-muted">Cargando invitación...</p>
      </div>
    )
  }

  if (loadError || !info) {
    return (
      <div className="min-h-screen bg-beige flex items-center justify-center px-4">
        <div className="bg-surface rounded-xl border border-border p-6 max-w-sm w-full text-center">
          <AlertCircle size={28} className="mx-auto text-red mb-2" />
          <p className="text-sm text-text-primary mb-3">{loadError || 'Invitación inválida.'}</p>
          <Link href="/login" className="text-sm text-green-primary hover:text-green-dark font-medium">
            Ir al login
          </Link>
        </div>
      </div>
    )
  }

  if (info.status !== 'pending') {
    return (
      <div className="min-h-screen bg-beige flex items-center justify-center px-4">
        <div className="bg-surface rounded-xl border border-border p-6 max-w-sm w-full text-center">
          <AlertCircle size={28} className="mx-auto text-amber mb-2" />
          <p className="text-sm text-text-primary mb-3">
            Esta invitación ya fue {statusLabel(info.status)}.
          </p>
          <Link href="/login" className="text-sm text-green-primary hover:text-green-dark font-medium">
            Ir al login
          </Link>
        </div>
      </div>
    )
  }

  const expired = new Date(info.expires_at) < new Date()
  if (expired) {
    return (
      <div className="min-h-screen bg-beige flex items-center justify-center px-4">
        <div className="bg-surface rounded-xl border border-border p-6 max-w-sm w-full text-center">
          <AlertCircle size={28} className="mx-auto text-red mb-2" />
          <p className="text-sm text-text-primary mb-3">Esta invitación venció. Pedí otra al admin de la clínica.</p>
          <Link href="/login" className="text-sm text-green-primary hover:text-green-dark font-medium">
            Ir al login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-beige flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-green-primary" />
            <span className="text-xs font-medium tracking-[0.18em] uppercase text-text-primary">
              Odonto Gestión
            </span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-text-primary">
            Uníte a {info.clinic_nombre}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Como <span className="font-medium text-text-primary">{info.role_nombre}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium tracking-wide uppercase text-text-secondary mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={info.email}
                disabled
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-beige text-text-secondary"
              />
            </div>
            <div>
              <label htmlFor="nombre" className="block text-xs font-medium tracking-wide uppercase text-text-secondary mb-1.5">
                Tu nombre
              </label>
              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Nombre y apellido"
                required
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10"
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
                onChange={e => setPassword(e.target.value)}
                placeholder="mínimo 8 caracteres"
                minLength={8}
                required
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10"
              />
            </div>
          </div>

          {submitError && (
            <div className="mt-4 p-3 bg-red-light border border-red/20 rounded-lg text-sm text-red">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full bg-green-primary hover:bg-green-dark text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? 'Uniéndote...' : 'Aceptar invitación'}
          </button>
        </form>

        <p className="text-center text-xs text-text-muted mt-6">
          Odonto Gestión · Sistema Integral
        </p>
      </div>
    </div>
  )
}

function statusLabel(status: string): string {
  switch (status) {
    case 'accepted': return 'aceptada'
    case 'expired': return 'expirada'
    case 'revoked': return 'revocada'
    default: return status
  }
}

function mapAcceptError(msg: string): string {
  if (msg.includes('invitation_expired')) return 'La invitación venció.'
  if (msg.includes('invitation_not_pending')) return 'La invitación ya no está activa.'
  if (msg.includes('invitation_email_mismatch')) return 'El email registrado no coincide con la invitación.'
  if (msg.includes('not_authenticated')) return 'No pudimos autenticarte. Probá de nuevo.'
  return msg
}
