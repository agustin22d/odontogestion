'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Clock,
  CalendarOff,
  Stethoscope,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  Profesional,
  ProfesionalSede,
  Sede,
  HorarioAtencion,
  AgendaBloqueo,
  DiaSemana,
} from '@/types/database'

const DIAS_SEMANA: { value: DiaSemana; label: string; short: string }[] = [
  { value: 1, label: 'Lunes', short: 'Lun' },
  { value: 2, label: 'Martes', short: 'Mar' },
  { value: 3, label: 'Miércoles', short: 'Mié' },
  { value: 4, label: 'Jueves', short: 'Jue' },
  { value: 5, label: 'Viernes', short: 'Vie' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
  { value: 0, label: 'Domingo', short: 'Dom' },
]

const COLORS_PRESET = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#06b6d4',
]

interface ProfesionalConSedes extends Profesional {
  sede_ids: string[]
}

interface FormState {
  nombre: string
  apellido: string
  color: string
  duracion_default_min: number
  matricula: string
  email: string
  telefono: string
  notas: string
  activo: boolean
  sede_ids: string[]
}

const EMPTY_FORM: FormState = {
  nombre: '',
  apellido: '',
  color: COLORS_PRESET[0],
  duracion_default_min: 30,
  matricula: '',
  email: '',
  telefono: '',
  notas: '',
  activo: true,
  sede_ids: [],
}

export default function ProfesionalesTab() {
  const supabase = createClient()
  const [profesionales, setProfesionales] = useState<ProfesionalConSedes[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ProfesionalConSedes | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [profsRes, sedesRes, joinRes] = await Promise.all([
      supabase.from('profesionales').select('*').order('nombre'),
      supabase.from('sedes').select('*').eq('activa', true).order('nombre'),
      supabase.from('profesional_sedes').select('*'),
    ])
    const profs = (profsRes.data as unknown as Profesional[]) || []
    const joins = (joinRes.data as unknown as ProfesionalSede[]) || []
    const byProf: Record<string, string[]> = {}
    for (const j of joins) {
      if (!byProf[j.profesional_id]) byProf[j.profesional_id] = []
      byProf[j.profesional_id].push(j.sede_id)
    }
    setProfesionales(profs.map(p => ({ ...p, sede_ids: byProf[p.id] || [] })))
    setSedes((sedesRes.data as unknown as Sede[]) || [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
    setFeedback(null)
  }

  const openEdit = (p: ProfesionalConSedes) => {
    setEditing(p)
    setForm({
      nombre: p.nombre,
      apellido: p.apellido || '',
      color: p.color,
      duracion_default_min: p.duracion_default_min,
      matricula: p.matricula || '',
      email: p.email || '',
      telefono: p.telefono || '',
      notas: p.notas || '',
      activo: p.activo,
      sede_ids: [...p.sede_ids],
    })
    setShowForm(true)
    setFeedback(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFeedback(null)

    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim() || null,
      color: form.color,
      duracion_default_min: Number(form.duracion_default_min) || 30,
      matricula: form.matricula.trim() || null,
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      notas: form.notas.trim() || null,
      activo: form.activo,
    }

    let profId = editing?.id || null
    if (editing) {
      const { error } = await supabase.from('profesionales').update(payload).eq('id', editing.id)
      if (error) {
        setFeedback({ type: 'error', msg: 'Error al guardar: ' + error.message })
        setSaving(false)
        return
      }
    } else {
      const { data, error } = await supabase
        .from('profesionales')
        .insert(payload)
        .select('id')
        .single()
      if (error) {
        setFeedback({ type: 'error', msg: 'Error al crear: ' + error.message })
        setSaving(false)
        return
      }
      profId = (data as unknown as { id: string }).id
    }

    if (profId) {
      // sync de sedes: borramos las que no estén y agregamos las nuevas
      const { data: existentes } = await supabase
        .from('profesional_sedes')
        .select('sede_id')
        .eq('profesional_id', profId)
      const existIds = ((existentes as unknown as { sede_id: string }[]) || []).map(r => r.sede_id)
      const toRemove = existIds.filter(id => !form.sede_ids.includes(id))
      const toAdd = form.sede_ids.filter(id => !existIds.includes(id))
      if (toRemove.length) {
        await supabase
          .from('profesional_sedes')
          .delete()
          .eq('profesional_id', profId)
          .in('sede_id', toRemove)
      }
      if (toAdd.length) {
        await supabase
          .from('profesional_sedes')
          .insert(toAdd.map(sede_id => ({ profesional_id: profId, sede_id })))
      }
    }

    setSaving(false)
    setShowForm(false)
    setFeedback({ type: 'success', msg: editing ? 'Profesional actualizado' : 'Profesional creado' })
    fetchAll()
  }

  const handleDelete = async (p: ProfesionalConSedes) => {
    if (!confirm(`¿Eliminar a ${p.nombre} ${p.apellido || ''}? Sus turnos quedan pero pierden el link.`)) return
    const { error } = await supabase.from('profesionales').delete().eq('id', p.id)
    if (error) {
      alert('Error al eliminar: ' + error.message)
      return
    }
    fetchAll()
  }

  const sedesById = useMemo(() => Object.fromEntries(sedes.map(s => [s.id, s])), [sedes])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Nuevo profesional
        </button>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${feedback.type === 'success' ? 'bg-green-light text-green-primary' : 'bg-red-light text-red'}`}>
          {feedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          {feedback.msg}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-5 max-w-3xl">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            {editing ? `Editar profesional` : 'Nuevo profesional'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <label className="block text-xs font-medium text-text-secondary mb-1">Apellido</label>
              <input
                type="text"
                value={form.apellido}
                onChange={e => setForm({ ...form, apellido: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Matrícula</label>
              <input
                type="text"
                value={form.matricula}
                onChange={e => setForm({ ...form, matricula: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Duración default (min) *</label>
              <input
                type="number"
                min={5}
                step={5}
                value={form.duracion_default_min}
                onChange={e => setForm({ ...form, duracion_default_min: Number(e.target.value) })}
                required
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
              <label className="block text-xs font-medium text-text-secondary mb-1">Teléfono</label>
              <input
                type="text"
                value={form.telefono}
                onChange={e => setForm({ ...form, telefono: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium text-text-secondary mb-1">Color en la agenda</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS_PRESET.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? 'border-text-primary scale-110' : 'border-border'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={e => setForm({ ...form, color: e.target.value })}
                className="w-8 h-8 border border-border rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium text-text-secondary mb-1">Sedes donde atiende</label>
            {sedes.length === 0 ? (
              <p className="text-xs text-text-muted">No hay sedes activas. Creá una sede primero.</p>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                {sedes.map(s => (
                  <label key={s.id} className="inline-flex items-center gap-1.5 text-sm text-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.sede_ids.includes(s.id)}
                      onChange={e => {
                        setForm({
                          ...form,
                          sede_ids: e.target.checked
                            ? [...form.sede_ids, s.id]
                            : form.sede_ids.filter(id => id !== s.id),
                        })
                      }}
                      className="rounded border-border"
                    />
                    {s.nombre}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium text-text-secondary mb-1">Notas</label>
            <textarea
              value={form.notas}
              onChange={e => setForm({ ...form, notas: e.target.value })}
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
            />
          </div>

          <div className="mt-3">
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={e => setForm({ ...form, activo: e.target.checked })}
                className="rounded border-border"
              />
              Activo (aparece como opción al crear turnos)
            </label>
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
        ) : profesionales.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">
            <Stethoscope size={28} className="mx-auto mb-2 opacity-40" />
            Todavía no cargaste profesionales.
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {profesionales.map(p => (
              <div key={p.id}>
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-beige/30 transition-colors">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.nombre.charAt(0).toUpperCase()}{(p.apellido || '').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-text-primary font-medium">
                        {p.nombre} {p.apellido || ''}
                      </span>
                      {!p.activo && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-text-muted">
                          inactivo
                        </span>
                      )}
                      {p.matricula && (
                        <span className="text-xs text-text-muted">Mat. {p.matricula}</span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5 truncate">
                      {p.duracion_default_min} min ·{' '}
                      {p.sede_ids.length === 0
                        ? 'sin sede'
                        : p.sede_ids.map(id => sedesById[id]?.nombre).filter(Boolean).join(', ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                      className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary border border-border rounded transition-colors"
                    >
                      {expanded === p.id ? 'Ocultar' : 'Horarios y bloqueos'}
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="p-1.5 text-text-muted hover:text-red transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {expanded === p.id && (
                  <div className="bg-beige/40 border-t border-border-light px-4 py-4">
                    <HorariosEditor profesionalId={p.id} sedes={sedes.filter(s => p.sede_ids.includes(s.id))} />
                    <BloqueosEditor profesionalId={p.id} sedes={sedes} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BloqueosGenerales sedes={sedes} />
    </div>
  )
}

// ============================================
// Horarios de atención del profesional
// ============================================
function HorariosEditor({ profesionalId, sedes }: { profesionalId: string; sedes: Sede[] }) {
  const supabase = createClient()
  const [horarios, setHorarios] = useState<HorarioAtencion[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<{ dia_semana: DiaSemana; hora_desde: string; hora_hasta: string; sede_id: string }>(
    { dia_semana: 1, hora_desde: '09:00', hora_hasta: '13:00', sede_id: '' },
  )

  const fetchHorarios = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('horarios_atencion')
      .select('*')
      .eq('profesional_id', profesionalId)
      .order('dia_semana')
      .order('hora_desde')
    setHorarios((data as unknown as HorarioAtencion[]) || [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profesionalId])

  useEffect(() => { fetchHorarios() }, [fetchHorarios])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.hora_hasta <= form.hora_desde) {
      alert('La hora de fin debe ser mayor que la de inicio')
      return
    }
    const { error } = await supabase.from('horarios_atencion').insert({
      profesional_id: profesionalId,
      dia_semana: form.dia_semana,
      hora_desde: form.hora_desde,
      hora_hasta: form.hora_hasta,
      sede_id: form.sede_id || null,
    })
    if (error) {
      alert('Error: ' + error.message)
      return
    }
    setAdding(false)
    fetchHorarios()
  }

  const handleDelete = async (h: HorarioAtencion) => {
    await supabase.from('horarios_atencion').delete().eq('id', h.id)
    fetchHorarios()
  }

  const sedeNombre = (id: string | null) => {
    if (!id) return 'Cualquier sede'
    return sedes.find(s => s.id === id)?.nombre || '—'
  }
  const diaLabel = (d: DiaSemana) => DIAS_SEMANA.find(x => x.value === d)?.label || ''

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide flex items-center gap-1.5">
          <Clock size={12} /> Horarios de atención
        </h4>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-green-primary hover:bg-green-light rounded transition-colors"
          >
            <Plus size={12} /> Agregar franja
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="bg-white border border-border rounded-lg p-3 mb-3 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[10px] font-medium text-text-secondary mb-1">Día</label>
            <select
              value={form.dia_semana}
              onChange={e => setForm({ ...form, dia_semana: Number(e.target.value) as DiaSemana })}
              className="w-full border border-border rounded px-2 py-1.5 text-xs bg-white"
            >
              {DIAS_SEMANA.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-text-secondary mb-1">Desde</label>
            <input
              type="time"
              value={form.hora_desde}
              onChange={e => setForm({ ...form, hora_desde: e.target.value })}
              required
              className="w-full border border-border rounded px-2 py-1.5 text-xs bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-text-secondary mb-1">Hasta</label>
            <input
              type="time"
              value={form.hora_hasta}
              onChange={e => setForm({ ...form, hora_hasta: e.target.value })}
              required
              className="w-full border border-border rounded px-2 py-1.5 text-xs bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-text-secondary mb-1">Sede</label>
            <select
              value={form.sede_id}
              onChange={e => setForm({ ...form, sede_id: e.target.value })}
              className="w-full border border-border rounded px-2 py-1.5 text-xs bg-white"
            >
              <option value="">Cualquiera</option>
              {sedes.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1 flex items-center gap-1">
            <button
              type="submit"
              className="flex-1 px-2 py-1.5 text-xs bg-green-primary text-white rounded font-medium"
            >
              <Check size={12} className="inline" />
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-2 py-1.5 text-xs border border-border rounded text-text-secondary"
            >
              <X size={12} />
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-text-muted">Cargando...</p>
      ) : horarios.length === 0 ? (
        <p className="text-xs text-text-muted italic">Sin horarios cargados — el profesional no aparece como disponible en la agenda.</p>
      ) : (
        <ul className="space-y-1">
          {horarios.map(h => (
            <li key={h.id} className="flex items-center justify-between text-xs bg-white border border-border-light rounded px-3 py-1.5">
              <span className="text-text-secondary">
                <strong className="text-text-primary">{diaLabel(h.dia_semana)}</strong>{' '}
                {h.hora_desde.slice(0, 5)} – {h.hora_hasta.slice(0, 5)} · {sedeNombre(h.sede_id)}
              </span>
              <button onClick={() => handleDelete(h)} className="text-text-muted hover:text-red">
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ============================================
// Bloqueos de un profesional
// ============================================
function BloqueosEditor({ profesionalId, sedes }: { profesionalId: string; sedes: Sede[] }) {
  return <BloqueosLista profesionalId={profesionalId} sedes={sedes} title="Bloqueos del profesional" />
}

// ============================================
// Bloqueos generales (sin profesional, ej. feriado para toda la sede)
// ============================================
function BloqueosGenerales({ sedes }: { sedes: Sede[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <CalendarOff size={14} className="text-text-muted" />
        Bloqueos generales (feriados / días cerrados)
      </h2>
      <div className="bg-surface rounded-xl border border-border p-4">
        <BloqueosLista profesionalId={null} sedes={sedes} title="" />
      </div>
    </div>
  )
}

function BloqueosLista({
  profesionalId, sedes, title,
}: {
  profesionalId: string | null
  sedes: Sede[]
  title: string
}) {
  const supabase = createClient()
  const [bloqueos, setBloqueos] = useState<AgendaBloqueo[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    fecha_desde: '',
    hora_desde: '09:00',
    fecha_hasta: '',
    hora_hasta: '18:00',
    sede_id: '',
    motivo: '',
  })

  const fetchBloqueos = useCallback(async () => {
    setLoading(true)
    const query = supabase
      .from('agenda_bloqueos')
      .select('*')
      .order('fecha_desde', { ascending: false })
      .limit(20)
    const { data } = profesionalId
      ? await query.eq('profesional_id', profesionalId)
      : await query.is('profesional_id', null)
    setBloqueos((data as unknown as AgendaBloqueo[]) || [])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profesionalId])

  useEffect(() => { fetchBloqueos() }, [fetchBloqueos])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fecha_desde || !form.fecha_hasta) {
      alert('Indicá fechas')
      return
    }
    const desde = `${form.fecha_desde}T${form.hora_desde}:00-03:00`
    const hasta = `${form.fecha_hasta}T${form.hora_hasta}:00-03:00`
    if (new Date(hasta) <= new Date(desde)) {
      alert('El fin debe ser posterior al inicio')
      return
    }
    const { error } = await supabase.from('agenda_bloqueos').insert({
      profesional_id: profesionalId,
      sede_id: form.sede_id || null,
      fecha_desde: desde,
      fecha_hasta: hasta,
      motivo: form.motivo.trim() || null,
    })
    if (error) {
      alert('Error: ' + error.message)
      return
    }
    setAdding(false)
    setForm({ fecha_desde: '', hora_desde: '09:00', fecha_hasta: '', hora_hasta: '18:00', sede_id: '', motivo: '' })
    fetchBloqueos()
  }

  const handleDelete = async (b: AgendaBloqueo) => {
    if (!confirm('¿Quitar este bloqueo?')) return
    await supabase.from('agenda_bloqueos').delete().eq('id', b.id)
    fetchBloqueos()
  }

  const sedeNombre = (id: string | null) => {
    if (!id) return 'Todas las sedes'
    return sedes.find(s => s.id === id)?.nombre || '—'
  }

  const formatRango = (b: AgendaBloqueo) => {
    const d1 = new Date(b.fecha_desde)
    const d2 = new Date(b.fecha_hasta)
    const opts: Intl.DateTimeFormatOptions = {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    }
    return `${d1.toLocaleString('es-AR', opts)} → ${d2.toLocaleString('es-AR', opts)}`
  }

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide flex items-center gap-1.5">
            <CalendarOff size={12} /> {title}
          </h4>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-green-primary hover:bg-green-light rounded transition-colors"
            >
              <Plus size={12} /> Bloquear
            </button>
          )}
        </div>
      )}

      {!title && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="mb-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-primary border border-green-primary/30 hover:bg-green-light rounded transition-colors"
        >
          <Plus size={12} /> Nuevo bloqueo
        </button>
      )}

      {adding && (
        <form onSubmit={handleAdd} className="bg-white border border-border rounded-lg p-3 mb-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-text-secondary mb-1">Desde</label>
              <div className="flex gap-1">
                <input
                  type="date"
                  value={form.fecha_desde}
                  onChange={e => setForm({ ...form, fecha_desde: e.target.value })}
                  required
                  className="flex-1 border border-border rounded px-2 py-1.5 text-xs bg-white"
                />
                <input
                  type="time"
                  value={form.hora_desde}
                  onChange={e => setForm({ ...form, hora_desde: e.target.value })}
                  className="w-24 border border-border rounded px-2 py-1.5 text-xs bg-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-text-secondary mb-1">Hasta</label>
              <div className="flex gap-1">
                <input
                  type="date"
                  value={form.fecha_hasta}
                  onChange={e => setForm({ ...form, fecha_hasta: e.target.value })}
                  required
                  className="flex-1 border border-border rounded px-2 py-1.5 text-xs bg-white"
                />
                <input
                  type="time"
                  value={form.hora_hasta}
                  onChange={e => setForm({ ...form, hora_hasta: e.target.value })}
                  className="w-24 border border-border rounded px-2 py-1.5 text-xs bg-white"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-text-secondary mb-1">Sede</label>
              <select
                value={form.sede_id}
                onChange={e => setForm({ ...form, sede_id: e.target.value })}
                className="w-full border border-border rounded px-2 py-1.5 text-xs bg-white"
              >
                <option value="">Todas</option>
                {sedes.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-text-secondary mb-1">Motivo</label>
              <input
                type="text"
                value={form.motivo}
                onChange={e => setForm({ ...form, motivo: e.target.value })}
                placeholder="Vacaciones, feriado, etc."
                className="w-full border border-border rounded px-2 py-1.5 text-xs bg-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="submit" className="px-3 py-1.5 text-xs bg-green-primary text-white rounded font-medium">
              Guardar
            </button>
            <button type="button" onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs border border-border rounded text-text-secondary">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-text-muted">Cargando...</p>
      ) : bloqueos.length === 0 ? (
        <p className="text-xs text-text-muted italic">Sin bloqueos cargados.</p>
      ) : (
        <ul className="space-y-1">
          {bloqueos.map(b => (
            <li key={b.id} className="flex items-center justify-between text-xs bg-white border border-border-light rounded px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-text-primary font-medium truncate">{b.motivo || 'Sin motivo'}</div>
                <div className="text-text-muted">{formatRango(b)} · {sedeNombre(b.sede_id)}</div>
              </div>
              <button onClick={() => handleDelete(b)} className="text-text-muted hover:text-red ml-2">
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
