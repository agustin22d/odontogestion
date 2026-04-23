'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth, useHasPermission } from '@/components/AuthProvider'
import {
  Building2,
  MapPin,
  Users,
  Shield,
  Stethoscope,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertCircle,
  Palette,
  Link as LinkIcon,
  Copy,
  Lock,
  Upload,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react'
import type { Sede, ClinicSettings, Invitation } from '@/types/database'
import { PERMISSION_GROUPS } from '@/lib/permissions'
import ProfesionalesTab from './ProfesionalesTab'

type Tab = 'clinica' | 'sedes' | 'profesionales' | 'equipo' | 'roles'

const TABS: { id: Tab; label: string; icon: React.ReactNode; perm: string }[] = [
  { id: 'clinica', label: 'Clínica', icon: <Building2 size={16} />, perm: 'settings.clinic' },
  { id: 'sedes', label: 'Sedes', icon: <MapPin size={16} />, perm: 'settings.sedes' },
  { id: 'profesionales', label: 'Profesionales', icon: <Stethoscope size={16} />, perm: 'profesionales.view' },
  { id: 'equipo', label: 'Equipo', icon: <Users size={16} />, perm: 'settings.users' },
  { id: 'roles', label: 'Roles', icon: <Shield size={16} />, perm: 'settings.roles' },
]

export default function ConfiguracionClient() {
  const { hasPermission } = useAuth()
  const visibleTabs = TABS.filter(t => hasPermission(t.perm))
  const [activeTab, setActiveTab] = useState<Tab>(visibleTabs[0]?.id || 'clinica')

  if (visibleTabs.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-border p-8 text-center text-sm text-text-muted">
        No tenés acceso a Configuración.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Configuración</h1>
        <p className="text-sm text-text-secondary hidden sm:block">Clínica, sedes, equipo y roles</p>
      </div>

      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 mb-6 max-w-full overflow-x-auto">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap shrink-0
              ${activeTab === tab.id
                ? 'bg-green-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-beige'
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {hasPermission('settings.clinic') && (
        <div style={{ display: activeTab === 'clinica' ? 'block' : 'none' }}>
          <ClinicaTab />
        </div>
      )}
      {hasPermission('settings.sedes') && (
        <div style={{ display: activeTab === 'sedes' ? 'block' : 'none' }}>
          <SedesTab />
        </div>
      )}
      {hasPermission('profesionales.view') && (
        <div style={{ display: activeTab === 'profesionales' ? 'block' : 'none' }}>
          <ProfesionalesTab />
        </div>
      )}
      {hasPermission('settings.users') && (
        <div style={{ display: activeTab === 'equipo' ? 'block' : 'none' }}>
          <EquipoTab />
        </div>
      )}
      {hasPermission('settings.roles') && (
        <div style={{ display: activeTab === 'roles' ? 'block' : 'none' }}>
          <RolesTab />
        </div>
      )}
    </div>
  )
}

// ============================================
// Clínica tab — datos + white-label
// ============================================
function ClinicaTab() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [clinicNombre, setClinicNombre] = useState('')
  const [settings, setSettings] = useState<ClinicSettings | null>(null)

  const fetchData = useCallback(async () => {
    if (!user?.clinic_id) return
    setLoading(true)
    const [clinicRes, settingsRes] = await Promise.all([
      supabase.from('clinics').select('nombre').eq('id', user.clinic_id).maybeSingle(),
      supabase.from('clinic_settings').select('*').eq('clinic_id', user.clinic_id).maybeSingle(),
    ])
    if (clinicRes.data) setClinicNombre((clinicRes.data as { nombre: string }).nombre)
    if (settingsRes.data) setSettings(settingsRes.data as unknown as ClinicSettings)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.clinic_id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.clinic_id || !settings) return
    setSaving(true)
    setFeedback(null)

    const { error: clinicError } = await supabase
      .from('clinics')
      .update({ nombre: clinicNombre })
      .eq('id', user.clinic_id)

    const { error: settingsError } = await supabase
      .from('clinic_settings')
      .update({
        color_primario: settings.color_primario,
        color_acento: settings.color_acento,
        logo_url: settings.logo_url,
        timezone: settings.timezone,
        moneda: settings.moneda,
      })
      .eq('clinic_id', user.clinic_id)

    if (clinicError || settingsError) {
      setFeedback({ type: 'error', msg: (clinicError || settingsError)?.message || 'Error al guardar' })
    } else {
      setFeedback({ type: 'success', msg: 'Cambios guardados' })
    }
    setSaving(false)
  }

  if (loading) return <div className="text-sm text-text-muted py-8 text-center">Cargando...</div>
  if (!settings) return <div className="text-sm text-text-muted py-8 text-center">No encontramos configuración para esta clínica.</div>

  return (
    <form onSubmit={handleSave} className="max-w-2xl space-y-6">
      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${feedback.type === 'success' ? 'bg-green-light text-green-primary' : 'bg-red-light text-red'}`}>
          {feedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          {feedback.msg}
        </div>
      )}

      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Building2 size={16} className="text-text-muted" />
          Datos de la clínica
        </h2>
        <label className="block text-xs font-medium text-text-secondary mb-1">Nombre</label>
        <input
          type="text"
          value={clinicNombre}
          onChange={e => setClinicNombre(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
          required
        />
      </section>

      <section className="bg-surface rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Palette size={16} className="text-text-muted" />
          Marca (aplica en tiempo real)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Color primario</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.color_primario}
                onChange={e => setSettings({ ...settings, color_primario: e.target.value })}
                className="w-12 h-10 border border-border rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={settings.color_primario}
                onChange={e => setSettings({ ...settings, color_primario: e.target.value })}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-white font-mono focus:outline-none focus:border-green-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Color de acento</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.color_acento}
                onChange={e => setSettings({ ...settings, color_acento: e.target.value })}
                className="w-12 h-10 border border-border rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={settings.color_acento}
                onChange={e => setSettings({ ...settings, color_acento: e.target.value })}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-white font-mono focus:outline-none focus:border-green-primary"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <LogoUploader
              clinicId={user?.clinic_id || ''}
              currentUrl={settings.logo_url}
              onChanged={url => setSettings({ ...settings, logo_url: url })}
            />
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="px-5 py-2.5 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  )
}

// ── Logo uploader ───────────────────────────────────

function LogoUploader({
  clinicId, currentUrl, onChanged,
}: {
  clinicId: string
  currentUrl: string | null
  onChanged: (url: string | null) => void
}) {
  const supabase = createClient()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !clinicId) return
    setError(null)
    setUploading(true)

    // Path convención: <clinic_id>/logo.<ext> — sobrescribe el anterior.
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${clinicId}/logo.${ext}`

    const { error: upErr } = await supabase.storage
      .from('clinic-logos')
      .upload(path, file, { upsert: true, cacheControl: '0' })

    if (upErr) {
      setError(upErr.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('clinic-logos').getPublicUrl(path)
    // Cache-busting: append timestamp para que el browser tome la versión nueva.
    const bustedUrl = `${data.publicUrl}?v=${Date.now()}`
    onChanged(bustedUrl)
    setUploading(false)

    // Guardar inmediatamente en clinic_settings (sin esperar al "Guardar cambios")
    await supabase.from('clinic_settings').update({ logo_url: bustedUrl }).eq('clinic_id', clinicId)
  }

  const handleRemove = async () => {
    if (!clinicId) return
    if (!confirm('¿Eliminar el logo?')) return
    setError(null)
    setUploading(true)

    // Intentar borrar todas las variantes comunes del archivo.
    const paths = ['png', 'jpg', 'jpeg', 'svg', 'webp'].map(e => `${clinicId}/logo.${e}`)
    await supabase.storage.from('clinic-logos').remove(paths)
    await supabase.from('clinic_settings').update({ logo_url: null }).eq('clinic_id', clinicId)
    onChanged(null)
    setUploading(false)
  }

  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-2">Logo de la clínica</label>
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border bg-white flex items-center justify-center overflow-hidden shrink-0">
          {currentUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={currentUrl} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <ImageIcon size={24} className="text-text-muted" />
          )}
        </div>
        {/* Actions */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <label className={`inline-flex items-center gap-2 px-3 py-1.5 border border-border text-sm text-text-secondary rounded-lg cursor-pointer hover:bg-beige transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Subiendo...' : currentUrl ? 'Cambiar logo' : 'Subir logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleFile}
                className="hidden"
                disabled={uploading}
              />
            </label>
            {currentUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-red/20 text-red text-sm rounded-lg hover:bg-red-light transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
                Quitar
              </button>
            )}
          </div>
          <p className="text-xs text-text-muted mt-1.5">PNG / JPG / SVG / WebP · máx 2 MB</p>
          {error && (
            <p className="text-xs text-red mt-1">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Sedes tab — CRUD
// ============================================
function SedesTab() {
  const supabase = createClient()
  const [sedes, setSedes] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Sede | null>(null)
  const [form, setForm] = useState({ nombre: '', direccion: '', activa: true })
  const [saving, setSaving] = useState(false)

  const fetchSedes = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('sedes').select('*').order('nombre')
    setSedes((data as unknown as Sede[]) || [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchSedes() }, [fetchSedes])

  const openCreate = () => {
    setEditing(null)
    setForm({ nombre: '', direccion: '', activa: true })
    setShowForm(true)
  }

  const openEdit = (s: Sede) => {
    setEditing(s)
    setForm({ nombre: s.nombre, direccion: s.direccion || '', activa: s.activa })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('sedes').update({
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim() || null,
        activa: form.activa,
      }).eq('id', editing.id)
      if (error) alert('Error al guardar: ' + error.message)
    } else {
      const { error } = await supabase.from('sedes').insert({
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim() || null,
        activa: form.activa,
      })
      if (error) alert('Error al crear: ' + error.message)
    }
    setSaving(false)
    setShowForm(false)
    fetchSedes()
  }

  const handleDelete = async (s: Sede) => {
    if (!confirm(`¿Eliminar la sede "${s.nombre}"? Esto también afectará datos históricos que la referencien.`)) return
    const { error } = await supabase.from('sedes').delete().eq('id', s.id)
    if (error) alert('Error al eliminar: ' + error.message)
    fetchSedes()
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Nueva sede
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-5 mb-6 max-w-lg">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            {editing ? 'Editar sede' : 'Nueva sede'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Nombre *</label>
              <input
                type="text"
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                required
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Dirección</label>
              <input
                type="text"
                value={form.direccion}
                onChange={e => setForm({ ...form, direccion: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={form.activa}
                onChange={e => setForm({ ...form, activa: e.target.checked })}
                className="rounded border-border"
              />
              Activa
            </label>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-border text-text-secondary text-sm font-medium rounded-lg hover:bg-beige transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted text-sm">Cargando...</div>
        ) : sedes.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">Todavía no cargaste sedes.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-beige/50">
                <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Dirección</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Estado</th>
                <th className="text-center px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sedes.map(s => (
                <tr key={s.id} className="border-b border-border-light hover:bg-beige/30 transition-colors">
                  <td className="px-4 py-3 text-text-primary font-medium">{s.nombre}</td>
                  <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">{s.direccion || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.activa ? 'bg-green-light text-green-primary' : 'bg-gray-100 text-text-muted'}`}>
                      {s.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 text-text-muted hover:text-text-primary transition-colors" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(s)} className="p-1.5 text-text-muted hover:text-red transition-colors" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ============================================
// Equipo tab — invitaciones (sin email, link manual)
// ============================================
interface InvitationWithRole extends Invitation {
  roles?: { nombre: string } | null
}

function EquipoTab() {
  const supabase = createClient()
  const { user } = useAuth()
  const [miembros, setMiembros] = useState<{ id: string; nombre: string; email: string; rol: string; activo: boolean }[]>([])
  const [invitaciones, setInvitaciones] = useState<InvitationWithRole[]>([])
  const [roles, setRoles] = useState<{ id: string; nombre: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', role_id: '' })
  const [saving, setSaving] = useState(false)
  const [newLink, setNewLink] = useState<string | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [miembrosRes, invRes, rolesRes] = await Promise.all([
      supabase.from('clinic_users').select('id, nombre, email, activo, role_id').order('nombre'),
      supabase.from('invitations').select('*, roles(nombre)').in('status', ['pending']).order('created_at', { ascending: false }),
      supabase.from('roles').select('id, nombre').order('nombre'),
    ])
    const rolesList = (rolesRes.data as unknown as { id: string; nombre: string }[]) || []
    setRoles(rolesList)
    const roleById = Object.fromEntries(rolesList.map(r => [r.id, r.nombre]))
    setMiembros(((miembrosRes.data as unknown as { id: string; nombre: string; email: string; activo: boolean; role_id: string }[]) || []).map(m => ({
      id: m.id, nombre: m.nombre, email: m.email, activo: m.activo, rol: roleById[m.role_id] || '—',
    })))
    setInvitaciones((invRes.data as unknown as InvitationWithRole[]) || [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const defaultRoleId = useMemo(() => {
    const empleado = roles.find(r => r.nombre.toLowerCase() === 'empleado')
    return empleado?.id || roles[0]?.id || ''
  }, [roles])

  useEffect(() => {
    if (!form.role_id && defaultRoleId) setForm(f => ({ ...f, role_id: defaultRoleId }))
  }, [defaultRoleId, form.role_id])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.role_id || !user?.clinic_id) return
    setSaving(true)
    setNewLink(null)
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        email: form.email.trim().toLowerCase(),
        role_id: form.role_id,
        invited_by: user.id,
      })
      .select('token')
      .single()
    setSaving(false)
    if (error) {
      alert('Error al crear la invitación: ' + error.message)
      return
    }
    const token = (data as unknown as { token: string }).token
    setNewLink(`${origin}/invite/${token}`)
    setForm({ email: '', role_id: defaultRoleId })
    setShowForm(false)
    fetchAll()
  }

  const revokeInvite = async (inv: Invitation) => {
    if (!confirm(`¿Revocar la invitación a ${inv.email}?`)) return
    await supabase.from('invitations').update({ status: 'revoked' }).eq('id', inv.id)
    fetchAll()
  }

  const copyLink = (token: string) => {
    const link = `${origin}/invite/${token}`
    navigator.clipboard?.writeText(link).then(() => {
      setNewLink(link)
      setTimeout(() => setNewLink(null), 2500)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancelar' : 'Invitar miembro'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleInvite} className="bg-surface rounded-xl border border-border p-5 max-w-lg">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Nueva invitación</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Rol *</label>
              <select
                value={form.role_id}
                onChange={e => setForm({ ...form, role_id: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
                required
              >
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-4 px-4 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Creando...' : 'Crear link de invitación'}
          </button>
          <p className="text-xs text-text-muted mt-2">
            Se genera un link único. Copialo y envialo a la persona por email o WhatsApp.
            TODO: envío automático por email en Fase 2.
          </p>
        </form>
      )}

      {newLink && (
        <div className="bg-blue-light border border-blue/20 rounded-lg p-4 flex items-start gap-3">
          <LinkIcon size={16} className="text-blue shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary mb-1">Link de invitación listo</p>
            <p className="text-xs font-mono text-text-secondary break-all">{newLink}</p>
          </div>
          <button
            onClick={() => navigator.clipboard?.writeText(newLink)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-white border border-border rounded hover:bg-beige transition-colors"
          >
            <Copy size={12} />
            Copiar
          </button>
        </div>
      )}

      {/* Miembros */}
      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Miembros</h2>
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-text-muted text-sm">Cargando...</div>
          ) : miembros.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">Solo vos.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-beige/50">
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Rol</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody>
                {miembros.map(m => (
                  <tr key={m.id} className="border-b border-border-light hover:bg-beige/30 transition-colors">
                    <td className="px-4 py-3 text-text-primary font-medium">{m.nombre}</td>
                    <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">{m.email}</td>
                    <td className="px-4 py-3 text-text-secondary">{m.rol}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${m.activo ? 'bg-green-light text-green-primary' : 'bg-gray-100 text-text-muted'}`}>
                        {m.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Invitaciones pendientes */}
      <section>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Invitaciones pendientes</h2>
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          {invitaciones.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">No hay invitaciones pendientes.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-beige/50">
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Rol</th>
                  <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Vence</th>
                  <th className="text-center px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide w-32">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invitaciones.map(inv => (
                  <tr key={inv.id} className="border-b border-border-light hover:bg-beige/30 transition-colors">
                    <td className="px-4 py-3 text-text-primary font-medium">{inv.email}</td>
                    <td className="px-4 py-3 text-text-secondary hidden sm:table-cell">{inv.roles?.nombre || '—'}</td>
                    <td className="px-4 py-3 text-text-secondary hidden sm:table-cell text-xs">
                      {new Date(inv.expires_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => copyLink(inv.token)} className="p-1.5 text-text-muted hover:text-text-primary transition-colors" title="Copiar link">
                          <Copy size={14} />
                        </button>
                        <button onClick={() => revokeInvite(inv)} className="p-1.5 text-text-muted hover:text-red transition-colors" title="Revocar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}

// ============================================
// Roles tab — CRUD de roles custom con switches
// ============================================
interface RoleRow {
  id: string
  nombre: string
  is_system: boolean
  permissions: string[]
  created_at: string
}

function RolesTab() {
  const supabase = createClient()
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<RoleRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<{ nombre: string; permissions: string[] }>({ nombre: '', permissions: [] })
  const [saving, setSaving] = useState(false)

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('roles').select('*').order('is_system', { ascending: false }).order('nombre')
    setRoles((data as unknown as RoleRow[]) || [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  const openCreate = () => {
    setEditing(null)
    setForm({ nombre: '', permissions: [] })
    setCreating(true)
  }

  const openEdit = (r: RoleRow) => {
    if (r.is_system) return // no se pueden editar roles is_system
    setEditing(r)
    setForm({ nombre: r.nombre, permissions: [...r.permissions] })
    setCreating(true)
  }

  const togglePerm = (key: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter(p => p !== key)
        : [...f.permissions, key],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    if (editing) {
      const { error } = await supabase
        .from('roles')
        .update({ nombre: form.nombre.trim(), permissions: form.permissions })
        .eq('id', editing.id)
      if (error) alert('Error al guardar: ' + error.message)
    } else {
      const { error } = await supabase
        .from('roles')
        .insert({ nombre: form.nombre.trim(), is_system: false, permissions: form.permissions })
      if (error) alert('Error al crear: ' + error.message)
    }
    setSaving(false)
    setCreating(false)
    fetchRoles()
  }

  const handleDelete = async (r: RoleRow) => {
    if (r.is_system) return
    if (!confirm(`¿Eliminar el rol "${r.nombre}"? Los miembros con este rol quedan sin permisos hasta reasignarlos.`)) return
    const { error } = await supabase.from('roles').delete().eq('id', r.id)
    if (error) {
      alert('Error al eliminar: ' + error.message + '\n\nProbablemente hay miembros o invitaciones usando este rol.')
      return
    }
    fetchRoles()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Nuevo rol
        </button>
      </div>

      {creating && (
        <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-5 max-w-3xl">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            {editing ? `Editar rol: ${editing.nombre}` : 'Nuevo rol'}
          </h3>
          <div className="mb-4">
            <label className="block text-xs font-medium text-text-secondary mb-1">Nombre del rol *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              required
              placeholder="ej. Recepcionista, Asistente"
              className="w-full max-w-sm border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
            />
          </div>

          <div className="space-y-4">
            {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => (
              <fieldset key={groupKey} className="border border-border rounded-lg p-3">
                <legend className="px-2 text-xs font-semibold text-text-primary uppercase tracking-wide">{group.label}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {group.perms.map(p => (
                    <label key={p.key} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer hover:text-text-primary">
                      <input
                        type="checkbox"
                        checked={form.permissions.includes(p.key)}
                        onChange={() => togglePerm(p.key)}
                        className="rounded border-border"
                      />
                      <span>{p.label}</span>
                      <span className="text-[10px] font-mono text-text-muted ml-auto">{p.key}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-5">
            <button
              type="submit"
              disabled={saving || !form.nombre.trim()}
              className="px-4 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-4 py-2 border border-border text-text-secondary text-sm font-medium rounded-lg hover:bg-beige transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted text-sm">Cargando...</div>
        ) : roles.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">No hay roles definidos.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-beige/50">
                <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Permisos</th>
                <th className="text-center px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide w-32">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id} className="border-b border-border-light hover:bg-beige/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary font-medium">{r.nombre}</span>
                      {r.is_system && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-light text-purple">
                          <Lock size={10} /> sistema
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    {r.is_system
                      ? 'Todos los permisos'
                      : r.permissions.length === 0
                        ? 'Sin permisos asignados'
                        : `${r.permissions.length} permiso${r.permissions.length !== 1 ? 's' : ''}`}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openEdit(r)}
                        disabled={r.is_system}
                        className="p-1.5 text-text-muted hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={r.is_system ? 'Los roles de sistema no se pueden editar' : 'Editar'}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        disabled={r.is_system}
                        className="p-1.5 text-text-muted hover:text-red transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={r.is_system ? 'Los roles de sistema no se pueden eliminar' : 'Eliminar'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
