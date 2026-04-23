'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, Clock, Loader2, AlertCircle, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PacienteTypeahead from '@/components/PacienteTypeahead'
import type {
  Turno, Sede, Profesional, EstadoTurno, OrigenTurno, SlotLibre,
} from '@/types/database'

const ESTADOS: { value: EstadoTurno; label: string }[] = [
  { value: 'agendado', label: 'Agendado' },
  { value: 'atendido', label: 'Atendido' },
  { value: 'no_asistio', label: 'No asistió' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'reprogramado', label: 'Reprogramado' },
]

const ORIGENES: { value: OrigenTurno; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telefono', label: 'Teléfono' },
  { value: 'web', label: 'Web' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'otro', label: 'Otro' },
]

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Si viene, edita ese turno; si no, crea uno nuevo. */
  turno?: Turno | null
  /** Pre-cargar fecha/hora/sede/profesional al abrir desde un click en hueco. */
  prefill?: {
    fecha?: string
    hora?: string
    sede_id?: string | null
    profesional_id?: string | null
  }
  sedes: Sede[]
  profesionales: Profesional[]
  /** map profesional_id → sede_ids[]. */
  profSedes: Record<string, string[]>
}

export default function TurnoForm({
  open, onClose, onSaved, turno, prefill, sedes, profesionales, profSedes,
}: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotLibre[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [paciente, setPaciente] = useState<{
    patient_id: string | null
    nombre: string
    apellido: string | null
  }>({ patient_id: null, nombre: '', apellido: null })

  const [form, setForm] = useState({
    fecha: '',
    hora: '',
    duracion_min: 30,
    profesional_id: '',
    sede_id: '',
    estado: 'agendado' as EstadoTurno,
    origen: 'whatsapp' as OrigenTurno,
    notas: '',
  })

  // Reset al abrir/editar
  useEffect(() => {
    if (!open) return
    setError(null)
    if (turno) {
      setForm({
        fecha: turno.fecha,
        hora: turno.hora.slice(0, 5),
        duracion_min: turno.duracion_min || 30,
        profesional_id: turno.profesional_id || '',
        sede_id: turno.sede_id || '',
        estado: turno.estado,
        origen: turno.origen,
        notas: turno.notas || '',
      })
      setPaciente({
        patient_id: turno.patient_id || null,
        nombre: turno.paciente.split(' ')[0] || turno.paciente,
        apellido: turno.paciente.split(' ').slice(1).join(' ') || null,
      })
    } else {
      const profId = prefill?.profesional_id || ''
      const profObj = profesionales.find(p => p.id === profId)
      setForm({
        fecha: prefill?.fecha || new Date().toISOString().split('T')[0],
        hora: prefill?.hora || '',
        duracion_min: profObj?.duracion_default_min || 30,
        profesional_id: profId,
        sede_id: prefill?.sede_id || '',
        estado: 'agendado',
        origen: 'whatsapp',
        notas: '',
      })
      setPaciente({ patient_id: null, nombre: '', apellido: null })
    }
  }, [open, turno, prefill, profesionales])

  // Cuando cambia el profesional, ajustar duración default y filtrar sedes
  const sedesDelProf = useMemo(() => {
    if (!form.profesional_id) return sedes
    const allowedIds = profSedes[form.profesional_id] || []
    if (allowedIds.length === 0) return sedes
    return sedes.filter(s => allowedIds.includes(s.id))
  }, [form.profesional_id, profSedes, sedes])

  const handleProfesionalChange = (profId: string) => {
    const profObj = profesionales.find(p => p.id === profId)
    const allowedIds = profSedes[profId] || []
    const newSedeId = form.sede_id && (allowedIds.length === 0 || allowedIds.includes(form.sede_id))
      ? form.sede_id
      : (allowedIds[0] || '')
    setForm(f => ({
      ...f,
      profesional_id: profId,
      sede_id: newSedeId,
      duracion_min: turno ? f.duracion_min : (profObj?.duracion_default_min || f.duracion_min),
    }))
  }

  // Cargar slots cuando hay prof + sede + fecha
  const fetchSlots = useCallback(async () => {
    if (!form.profesional_id || !form.fecha) {
      setSlots([])
      return
    }
    setLoadingSlots(true)
    const { data, error } = await supabase.rpc('agenda_slots_libres', {
      p_profesional_id: form.profesional_id,
      p_sede_id: form.sede_id || null,
      p_fecha: form.fecha,
      p_slot_min: form.duracion_min,
    })
    if (!error && data) {
      setSlots(data as SlotLibre[])
    } else {
      setSlots([])
    }
    setLoadingSlots(false)
  }, [supabase, form.profesional_id, form.sede_id, form.fecha, form.duracion_min])

  useEffect(() => { if (open) fetchSlots() }, [open, fetchSlots])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!paciente.nombre.trim()) {
      setError('Indicá el paciente')
      return
    }
    if (!form.hora) {
      setError('Indicá la hora')
      return
    }
    setSaving(true)

    let patient_id = paciente.patient_id
    // Si no hay link a ficha pero sí nombre, crear/buscar
    if (!patient_id && paciente.nombre.trim()) {
      const { data: pid, error: rpcErr } = await supabase.rpc('find_or_create_paciente', {
        p_nombre: paciente.nombre.trim(),
        p_apellido: paciente.apellido?.trim() || null,
      })
      if (rpcErr) {
        setError('No se pudo crear la ficha del paciente: ' + rpcErr.message)
        setSaving(false)
        return
      }
      patient_id = pid as unknown as string
    }

    const profObj = profesionales.find(p => p.id === form.profesional_id)
    const pacienteNombreCompleto = paciente.apellido
      ? `${paciente.nombre.trim()} ${paciente.apellido.trim()}`
      : paciente.nombre.trim()

    const payload = {
      fecha: form.fecha,
      hora: `${form.hora}:00`,
      duracion_min: Number(form.duracion_min) || 30,
      sede_id: form.sede_id || null,
      profesional_id: form.profesional_id || null,
      patient_id,
      paciente: pacienteNombreCompleto,
      profesional: profObj
        ? `${profObj.nombre}${profObj.apellido ? ' ' + profObj.apellido : ''}`
        : null,
      estado: form.estado,
      origen: form.origen,
      notas: form.notas.trim() || null,
    }

    const { error: dbErr } = turno
      ? await supabase.from('turnos').update(payload).eq('id', turno.id)
      : await supabase.from('turnos').insert(payload)

    setSaving(false)
    if (dbErr) {
      setError(dbErr.message)
      return
    }
    onSaved()
    onClose()
  }

  const handleDelete = async () => {
    if (!turno) return
    if (!confirm('¿Eliminar este turno?')) return
    setSaving(true)
    const { error: dbErr } = await supabase.from('turnos').delete().eq('id', turno.id)
    setSaving(false)
    if (dbErr) {
      setError(dbErr.message)
      return
    }
    onSaved()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-start sm:items-center justify-center p-3 overflow-y-auto">
      <div className="bg-surface rounded-xl border border-border w-full max-w-2xl my-4 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text-primary">
            {turno ? 'Editar turno' : 'Nuevo turno'}
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-red-light text-red rounded-lg text-sm">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Paciente *</label>
            <PacienteTypeahead value={paciente} onChange={setPaciente} required autoFocus={!turno} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Profesional</label>
              <select
                value={form.profesional_id}
                onChange={e => handleProfesionalChange(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              >
                <option value="">Sin asignar</option>
                {profesionales.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} {p.apellido || ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Sede</label>
              <select
                value={form.sede_id}
                onChange={e => setForm({ ...form, sede_id: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              >
                <option value="">Sin sede</option>
                {sedesDelProf.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Fecha *</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm({ ...form, fecha: e.target.value })}
                required
                className="w-full border border-border rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Hora *</label>
              <input
                type="time"
                value={form.hora}
                onChange={e => setForm({ ...form, hora: e.target.value })}
                required
                className="w-full border border-border rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Duración (min)</label>
              <input
                type="number"
                min={5}
                step={5}
                value={form.duracion_min}
                onChange={e => setForm({ ...form, duracion_min: Number(e.target.value) })}
                className="w-full border border-border rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Estado</label>
              <select
                value={form.estado}
                onChange={e => setForm({ ...form, estado: e.target.value as EstadoTurno })}
                className="w-full border border-border rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              >
                {ESTADOS.map(e => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>
          </div>

          {form.profesional_id && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                  <Clock size={12} /> Slots libres del día
                </label>
                {loadingSlots && <Loader2 size={12} className="animate-spin text-text-muted" />}
              </div>
              {!loadingSlots && slots.length === 0 && (
                <p className="text-xs text-text-muted italic">
                  Sin slots libres — verificá horarios y bloqueos del profesional para esta fecha.
                </p>
              )}
              {slots.length > 0 && (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {slots.map(s => {
                    const hhmm = s.slot_inicio.slice(0, 5)
                    const isSel = form.hora === hhmm
                    return (
                      <button
                        key={hhmm}
                        type="button"
                        onClick={() => setForm({ ...form, hora: hhmm })}
                        className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                          isSel
                            ? 'bg-green-primary text-white'
                            : 'bg-white border border-border text-text-secondary hover:border-green-primary hover:text-green-primary'
                        }`}
                      >
                        {hhmm}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Origen</label>
              <select
                value={form.origen}
                onChange={e => setForm({ ...form, origen: e.target.value as OrigenTurno })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
              >
                {ORIGENES.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Notas</label>
            <textarea
              value={form.notas}
              onChange={e => setForm({ ...form, notas: e.target.value })}
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              {turno && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-3 py-2 text-sm text-red hover:bg-red-light rounded-lg transition-colors disabled:opacity-50"
                >
                  Eliminar
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border text-text-secondary text-sm font-medium rounded-lg hover:bg-beige transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-primary hover:bg-green-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? 'Guardando...' : turno ? 'Guardar' : 'Crear turno'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
