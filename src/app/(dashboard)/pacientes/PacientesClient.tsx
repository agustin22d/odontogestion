'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import {
  Search,
  Plus,
  X,
  Pencil,
  Trash2,
  Phone,
  Mail,
  IdCard,
  Cake,
  Shield,
  User,
  CalendarDays,
  DollarSign,
  FlaskConical,
  ChevronLeft,
} from 'lucide-react'
import type { Paciente, Sede } from '@/types/database'

export default function PacientesClient() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('pacientes.manage')
  const supabase = createClient()

  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [selected, setSelected] = useState<Paciente | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Paciente | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [pacRes, sedesRes] = await Promise.all([
      supabase.from('pacientes').select('*').order('apellido', { ascending: true }).order('nombre'),
      supabase.from('sedes').select('*').eq('activa', true).order('nombre'),
    ])
    if (pacRes.error) console.error('Error pacientes:', pacRes.error)
    if (sedesRes.error) console.error('Error sedes:', sedesRes.error)
    setPacientes((pacRes.data as unknown as Paciente[]) || [])
    setSedes((sedesRes.data as unknown as Sede[]) || [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return pacientes
    return pacientes.filter(p => {
      const full = `${p.nombre} ${p.apellido || ''}`.toLowerCase()
      return full.includes(q) || (p.dni && p.dni.includes(q)) || (p.telefono && p.telefono.includes(q))
    })
  }, [pacientes, busqueda])

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }
  const openEdit = (p: Paciente) => {
    setEditing(p)
    setShowForm(true)
  }

  const handleDelete = async (p: Paciente) => {
    if (!confirm(`¿Eliminar la ficha de ${p.nombre} ${p.apellido || ''}?`)) return
    const { error } = await supabase.from('pacientes').delete().eq('id', p.id)
    if (error) {
      alert('Error al eliminar: ' + error.message)
      return
    }
    if (selected?.id === p.id) setSelected(null)
    fetch()
  }

  return (
    <div>
      {selected ? (
        <PacienteDetail
          paciente={selected}
          sedes={sedes}
          onBack={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
          onDelete={() => handleDelete(selected)}
          canManage={canManage}
        />
      ) : (
        <>
          <div className="mb-6">
            <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Pacientes</h1>
            <p className="text-sm text-text-secondary hidden sm:block">Fichas clínicas + historial unificado</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            {canManage && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus size={16} />
                Nuevo paciente
              </button>
            )}
            <div className="relative ml-auto">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, DNI, teléfono..."
                className="text-sm border border-border rounded-lg pl-8 pr-3 py-1.5 bg-surface focus:outline-none focus:border-green-primary w-64"
              />
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-text-muted text-sm">Cargando...</div>
            ) : filtrados.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">
                {busqueda ? `No hay coincidencias para "${busqueda}"` : 'Todavía no cargaste pacientes.'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-beige/50">
                    <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide">Paciente</th>
                    <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">DNI</th>
                    <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden md:table-cell">Teléfono</th>
                    <th className="text-left px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide hidden lg:table-cell">Obra social</th>
                    {canManage && (
                      <th className="text-center px-4 py-3 font-medium text-text-secondary text-xs uppercase tracking-wide w-24">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(p => (
                    <tr key={p.id} className="border-b border-border-light hover:bg-beige/30 transition-colors cursor-pointer" onClick={() => setSelected(p)}>
                      <td className="px-4 py-3 text-text-primary font-medium">
                        {p.apellido ? `${p.apellido}, ${p.nombre}` : p.nombre}
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-sm hidden sm:table-cell">{p.dni || '—'}</td>
                      <td className="px-4 py-3 text-text-secondary text-sm hidden md:table-cell">{p.telefono || '—'}</td>
                      <td className="px-4 py-3 text-text-secondary text-sm hidden lg:table-cell">{p.obra_social || '—'}</td>
                      {canManage && (
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEdit(p)} className="p-1.5 text-text-muted hover:text-text-primary transition-colors" title="Editar">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDelete(p)} className="p-1.5 text-text-muted hover:text-red transition-colors" title="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!loading && filtrados.length > 0 && (
            <p className="text-xs text-text-muted mt-3">
              {filtrados.length} de {pacientes.length} paciente{pacientes.length !== 1 ? 's' : ''}
            </p>
          )}
        </>
      )}

      {showForm && (
        <PacienteForm
          paciente={editing}
          sedes={sedes}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            fetch()
          }}
        />
      )}
    </div>
  )
}

// ── Detail / historial ────────────────────────────────

interface HistorialItem {
  tipo: 'turno' | 'cobranza' | 'laboratorio'
  fecha: string
  titulo: string
  subtitulo?: string
  extra?: string
  estado?: string
}

function PacienteDetail({
  paciente, sedes, onBack, onEdit, onDelete, canManage,
}: {
  paciente: Paciente
  sedes: Sede[]
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  canManage: boolean
}) {
  const supabase = createClient()
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [loading, setLoading] = useState(true)
  const sedeById = Object.fromEntries(sedes.map(s => [s.id, s.nombre]))

  // Búsqueda por nombre (best-effort: hasta tener patient_id formal).
  // Match: ilike con el full name y con nombre/apellido por separado.
  const searchKey = paciente.apellido
    ? `${paciente.nombre} ${paciente.apellido}`
    : paciente.nombre

  useEffect(() => {
    (async () => {
      setLoading(true)
      const like = `%${searchKey}%`
      const [turnosRes, cobRes, labRes] = await Promise.all([
        supabase.from('turnos').select('fecha, hora, sede_id, profesional, estado').ilike('paciente', like).order('fecha', { ascending: false }).limit(50),
        supabase.from('cobranzas').select('fecha, tratamiento, tipo_pago, monto, sede_id').ilike('paciente', like).order('fecha', { ascending: false }).limit(50),
        supabase.from('laboratorio_casos').select('created_at, tipo, laboratorio, estado, sede_id').ilike('paciente', like).order('created_at', { ascending: false }).limit(50),
      ])

      const items: HistorialItem[] = []
      ;((turnosRes.data as unknown as Array<{ fecha: string; hora: string; sede_id: string | null; profesional: string | null; estado: string }>) || []).forEach(t => {
        items.push({
          tipo: 'turno',
          fecha: t.fecha,
          titulo: `Turno ${t.hora?.slice(0, 5) || ''}`,
          subtitulo: t.profesional || undefined,
          extra: t.sede_id ? sedeById[t.sede_id] : undefined,
          estado: t.estado,
        })
      })
      ;((cobRes.data as unknown as Array<{ fecha: string; tratamiento: string | null; tipo_pago: string; monto: number; sede_id: string | null }>) || []).forEach(c => {
        items.push({
          tipo: 'cobranza',
          fecha: c.fecha,
          titulo: `${Number(c.monto).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })} · ${c.tipo_pago}`,
          subtitulo: c.tratamiento || undefined,
          extra: c.sede_id ? sedeById[c.sede_id] : undefined,
        })
      })
      ;((labRes.data as unknown as Array<{ created_at: string; tipo: string; laboratorio: string | null; estado: string; sede_id: string | null }>) || []).forEach(l => {
        items.push({
          tipo: 'laboratorio',
          fecha: l.created_at.slice(0, 10),
          titulo: l.tipo,
          subtitulo: l.laboratorio || undefined,
          extra: l.sede_id ? sedeById[l.sede_id] : undefined,
          estado: l.estado,
        })
      })

      items.sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
      setHistorial(items)
      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente.id, searchKey])

  const edad = paciente.fecha_nacimiento
    ? Math.floor((Date.now() - new Date(paciente.fecha_nacimiento).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-4"
      >
        <ChevronLeft size={16} />
        Volver al listado
      </button>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">
            {paciente.apellido ? `${paciente.nombre} ${paciente.apellido}` : paciente.nombre}
          </h1>
          <p className="text-sm text-text-secondary">Ficha clínica e historial</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="inline-flex items-center gap-2 px-3 py-1.5 border border-border text-text-secondary text-sm font-medium rounded-lg hover:bg-beige transition-colors">
              <Pencil size={14} /> Editar
            </button>
            <button onClick={onDelete} className="inline-flex items-center gap-2 px-3 py-1.5 border border-red/20 text-red text-sm font-medium rounded-lg hover:bg-red-light transition-colors">
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Datos */}
      <div className="bg-surface rounded-xl border border-border p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Datos personales</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {paciente.dni && <Field icon={<IdCard size={14} />} label="DNI" value={paciente.dni} />}
          {paciente.fecha_nacimiento && <Field icon={<Cake size={14} />} label="Nacimiento" value={`${formatDateShort(paciente.fecha_nacimiento)}${edad !== null ? ` (${edad} años)` : ''}`} />}
          {paciente.telefono && <Field icon={<Phone size={14} />} label="Teléfono" value={paciente.telefono} />}
          {paciente.email && <Field icon={<Mail size={14} />} label="Email" value={paciente.email} />}
          {paciente.obra_social && <Field icon={<Shield size={14} />} label="Obra social" value={paciente.obra_social} />}
          {paciente.sede_id && <Field icon={<User size={14} />} label="Sede habitual" value={sedeById[paciente.sede_id] || '—'} />}
        </dl>
        {paciente.notas && (
          <div className="mt-4 pt-4 border-t border-border-light">
            <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Notas</p>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{paciente.notas}</p>
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Historial unificado</h2>
          <p className="text-xs text-text-muted mt-0.5">Turnos, cobranzas y laboratorio asociados a este nombre</p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-text-muted text-sm">Cargando historial...</div>
        ) : historial.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">Sin registros para este paciente.</div>
        ) : (
          <ul className="divide-y divide-border-light">
            {historial.map((it, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  it.tipo === 'turno' ? 'bg-blue-light text-blue'
                    : it.tipo === 'cobranza' ? 'bg-green-light text-green-primary'
                    : 'bg-purple-light text-purple'
                }`}>
                  {it.tipo === 'turno' ? <CalendarDays size={14} /> : it.tipo === 'cobranza' ? <DollarSign size={14} /> : <FlaskConical size={14} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{it.titulo}</p>
                  <p className="text-xs text-text-muted truncate">
                    {formatDateShort(it.fecha)}
                    {it.subtitulo && ` · ${it.subtitulo}`}
                    {it.extra && ` · ${it.extra}`}
                  </p>
                </div>
                {it.estado && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-beige text-text-secondary capitalize whitespace-nowrap">
                    {it.estado.replace('_', ' ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-text-muted mt-0.5">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-text-muted">{label}</dt>
        <dd className="text-sm text-text-primary truncate">{value}</dd>
      </div>
    </div>
  )
}

function formatDateShort(d: string): string {
  if (!d) return '—'
  const date = new Date(d + (d.length === 10 ? 'T12:00:00' : ''))
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Form (create / edit) ──────────────────────────────

function PacienteForm({
  paciente, sedes, onClose, onSaved,
}: {
  paciente: Paciente | null
  sedes: Sede[]
  onClose: () => void
  onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre: paciente?.nombre || '',
    apellido: paciente?.apellido || '',
    dni: paciente?.dni || '',
    fecha_nacimiento: paciente?.fecha_nacimiento || '',
    telefono: paciente?.telefono || '',
    email: paciente?.email || '',
    obra_social: paciente?.obra_social || '',
    sede_id: paciente?.sede_id || '',
    notas: paciente?.notas || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim() || null,
      dni: form.dni.trim() || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      obra_social: form.obra_social.trim() || null,
      sede_id: form.sede_id || null,
      notas: form.notas.trim() || null,
    }
    const { error } = paciente
      ? await supabase.from('pacientes').update(payload).eq('id', paciente.id)
      : await supabase.from('pacientes').insert(payload)
    setSaving(false)
    if (error) {
      alert('Error al guardar: ' + error.message)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">
            {paciente ? 'Editar paciente' : 'Nuevo paciente'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-beige rounded-lg text-text-muted">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Nombre *</label>
              <input
                type="text" required
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Apellido</label>
              <input
                type="text"
                value={form.apellido}
                onChange={e => setForm({ ...form, apellido: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">DNI</label>
              <input
                type="text"
                value={form.dni}
                onChange={e => setForm({ ...form, dni: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Fecha de nacimiento</label>
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={e => setForm({ ...form, fecha_nacimiento: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Teléfono</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={e => setForm({ ...form, telefono: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Obra social</label>
              <input
                type="text"
                value={form.obra_social}
                onChange={e => setForm({ ...form, obra_social: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Sede habitual</label>
              <select
                value={form.sede_id}
                onChange={e => setForm({ ...form, sede_id: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              >
                <option value="">Ninguna</option>
                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Notas clínicas</label>
            <textarea
              value={form.notas}
              onChange={e => setForm({ ...form, notas: e.target.value })}
              rows={3}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary resize-none"
              placeholder="Alergias, tratamientos en curso, observaciones..."
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={saving || !form.nombre.trim()}
              className="px-4 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border text-text-secondary text-sm font-medium rounded-lg hover:bg-beige transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
