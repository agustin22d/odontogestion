'use client'

import { useEffect, useState } from 'react'
import { X, KeyRound, Copy, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ClinicUserRow {
  user_id: string
  auth_user_id: string
  email: string
  nombre: string
  role_nombre: string | null
  is_admin: boolean | null
}

interface Props {
  clinic: { clinic_id: string; clinic_nombre: string }
  onClose: () => void
}

function generateTempPassword(): string {
  // 12 caracteres, sin chars confusos. Suficiente entropy (~67 bits) para una
  // password temporal que el user va a cambiar al primer login.
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export default function ResetPasswordModal({ clinic, onClose }: Props) {
  const supabase = createClient()
  const [users, setUsers] = useState<ClinicUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ClinicUserRow | null>(null)
  const [newPwd, setNewPwd] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.rpc('sysadmin_clinic_users', { p_clinic_id: clinic.clinic_id }).then((res: { data: unknown; error: unknown }) => {
      if (!res.error && res.data) setUsers(res.data as ClinicUserRow[])
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerate = () => setNewPwd(generateTempPassword())

  const handleCopy = async () => {
    await navigator.clipboard.writeText(newPwd)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleReset = async () => {
    if (!selected) { setError('Elegí un usuario'); return }
    if (newPwd.length < 8) { setError('La password debe tener al menos 8 caracteres'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/sysadmin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_user_id: selected.auth_user_id, new_password: newPwd }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error desconocido')
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl border border-border w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display text-lg font-semibold text-text-primary flex items-center gap-2">
            <KeyRound size={18} /> Resetear password
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Clínica</p>
            <p className="text-sm font-medium text-text-primary">{clinic.clinic_nombre}</p>
          </div>

          {done ? (
            <div className="bg-green-light border border-green-primary/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-green-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">Password actualizada</p>
                  <p className="text-xs text-text-secondary mt-1">Pasale al usuario el siguiente acceso:</p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p><span className="text-text-muted">Email:</span> <span className="font-mono text-text-primary">{selected?.email}</span></p>
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted">Pwd:</span>
                      <span className="font-mono text-text-primary bg-surface px-2 py-0.5 rounded">{newPwd}</span>
                      <button onClick={handleCopy} className="text-text-muted hover:text-text-primary">
                        {copied ? <CheckCircle2 size={14} className="text-green-primary" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted mt-3">Recordá que el user puede cambiarla luego desde su perfil.</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Usuario</label>
                {loading ? (
                  <p className="text-sm text-text-muted py-2">Cargando...</p>
                ) : users.length === 0 ? (
                  <p className="text-sm text-text-muted py-2">Esta clínica no tiene usuarios.</p>
                ) : (
                  <select
                    value={selected?.user_id ?? ''}
                    onChange={(e) => {
                      const u = users.find(x => x.user_id === e.target.value)
                      setSelected(u ?? null)
                    }}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-green-primary"
                  >
                    <option value="">— Elegir usuario —</option>
                    {users.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.nombre} ({u.email}){u.is_admin ? ' · admin' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Nueva password</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="Min 8 caracteres"
                    className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-bg font-mono focus:outline-none focus:border-green-primary"
                  />
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="px-3 py-2 border border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-beige whitespace-nowrap"
                  >
                    Generar
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red bg-red-light p-2 rounded">{error}</p>}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          {done ? (
            <button onClick={onClose} className="px-4 py-2 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-primary/90">Listo</button>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-beige">Cancelar</button>
              <button onClick={handleReset} disabled={submitting || !selected || newPwd.length < 8} className="px-4 py-2 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-primary/90 disabled:opacity-50">
                {submitting ? 'Reseteando...' : 'Resetear password'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
