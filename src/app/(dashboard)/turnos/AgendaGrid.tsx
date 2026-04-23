'use client'

import { useMemo } from 'react'
import type { Turno, Profesional, AgendaBloqueo, BloqueoRecurrente, HorarioAtencion } from '@/types/database'

const ESTADO_COLORS: Record<string, string> = {
  agendado: 'bg-blue-light/80 text-blue border-blue/30',
  atendido: 'bg-green-light text-green-primary border-green-primary/30',
  no_asistio: 'bg-red-light text-red border-red/30',
  cancelado: 'bg-amber-light text-amber border-amber/30 line-through',
  reprogramado: 'bg-purple-100 text-purple-600 border-purple-300',
}

interface Props {
  fecha: string
  profesionales: Profesional[]
  turnos: Turno[]
  bloqueos: AgendaBloqueo[]
  bloqueosRecurrentes: BloqueoRecurrente[]
  horarios: HorarioAtencion[]
  /** Sede activa (para filtrar bloqueos de sede). null = todas. */
  sedeId: string | null
  /** minutos por celda de la grilla. */
  slotMinutes?: number
  /** hora de inicio visible (default 8:00). */
  startHour?: number
  /** hora final visible exclusiva (default 21:00). */
  endHour?: number
  onClickSlot: (profId: string, hhmm: string) => void
  onClickTurno: (t: Turno) => void
}

const PIXELS_PER_SLOT = 32
const COL_MIN_WIDTH = 140
const TIME_COL_WIDTH = 56

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function minutesToHHMM(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function AgendaGrid({
  fecha, profesionales, turnos, bloqueos, bloqueosRecurrentes, horarios,
  sedeId, slotMinutes = 30, startHour = 8, endHour = 21,
  onClickSlot, onClickTurno,
}: Props) {
  const slotMin = slotMinutes
  const startMin = startHour * 60
  const endMin = endHour * 60
  const totalSlots = Math.ceil((endMin - startMin) / slotMin)
  const colHeight = totalSlots * PIXELS_PER_SLOT

  const dayOfWeek = useMemo(() => {
    const d = new Date(fecha + 'T12:00:00')
    return d.getDay()
  }, [fecha])

  const turnosByProf = useMemo(() => {
    const m: Record<string, Turno[]> = {}
    for (const t of turnos) {
      if (!t.profesional_id) continue
      if (!m[t.profesional_id]) m[t.profesional_id] = []
      m[t.profesional_id].push(t)
    }
    return m
  }, [turnos])

  const fechaDate = useMemo(() => fecha, [fecha]) // alias estable

  const { perProf: bloqueosPerProf, generales: bloqueosGenerales } = useMemo(() => {
    const m: Record<string, AgendaBloqueo[]> = {}
    const generales: AgendaBloqueo[] = []
    for (const b of bloqueos) {
      if (sedeId && b.sede_id && b.sede_id !== sedeId) continue
      if (b.profesional_id) {
        if (!m[b.profesional_id]) m[b.profesional_id] = []
        m[b.profesional_id].push(b)
      } else {
        generales.push(b)
      }
    }
    return { perProf: m, generales }
  }, [bloqueos, sedeId])

  // Bloqueos recurrentes vigentes para el día de semana actual.
  const { perProf: recurrPerProf, generales: recurrGenerales } = useMemo(() => {
    const m: Record<string, BloqueoRecurrente[]> = {}
    const generales: BloqueoRecurrente[] = []
    for (const r of bloqueosRecurrentes) {
      if (r.dia_semana !== dayOfWeek) continue
      if (sedeId && r.sede_id && r.sede_id !== sedeId) continue
      if (r.vigente_desde && r.vigente_desde > fechaDate) continue
      if (r.vigente_hasta && r.vigente_hasta < fechaDate) continue
      if (r.profesional_id) {
        if (!m[r.profesional_id]) m[r.profesional_id] = []
        m[r.profesional_id].push(r)
      } else {
        generales.push(r)
      }
    }
    return { perProf: m, generales }
  }, [bloqueosRecurrentes, dayOfWeek, sedeId, fechaDate])

  const horariosByProf = useMemo(() => {
    const m: Record<string, HorarioAtencion[]> = {}
    for (const h of horarios) {
      if (h.dia_semana !== dayOfWeek) continue
      if (sedeId && h.sede_id && h.sede_id !== sedeId) continue
      if (!m[h.profesional_id]) m[h.profesional_id] = []
      m[h.profesional_id].push(h)
    }
    return m
  }, [horarios, dayOfWeek, sedeId])

  if (profesionales.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center text-sm text-text-muted">
        Cargá al menos un profesional en Configuración → Profesionales para ver la agenda.
      </div>
    )
  }

  const baseDate = new Date(fecha + 'T00:00:00-03:00')

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <div
          className="flex min-w-fit"
          style={{ width: TIME_COL_WIDTH + profesionales.length * COL_MIN_WIDTH }}
        >
          {/* Columna de horas */}
          <div className="shrink-0" style={{ width: TIME_COL_WIDTH }}>
            <div className="bg-beige/50 border-b border-border" style={{ height: PIXELS_PER_SLOT }} />
            <div className="relative">
              {Array.from({ length: totalSlots }).map((_, slotIdx) => {
                const min = startMin + slotIdx * slotMin
                const isHourMark = min % 60 === 0
                return (
                  <div
                    key={slotIdx}
                    className={`text-[10px] font-mono text-text-muted px-1.5 flex items-start ${isHourMark ? 'border-t border-border' : 'border-t border-border-light/50'}`}
                    style={{ height: PIXELS_PER_SLOT }}
                  >
                    {isHourMark ? minutesToHHMM(min) : ''}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Columnas de profesionales */}
          {profesionales.map(prof => {
            const horariosProf = horariosByProf[prof.id] || []
            const bloqueosProf = [...bloqueosGenerales, ...(bloqueosPerProf[prof.id] || [])]
            const recurrProf = [...recurrGenerales, ...(recurrPerProf[prof.id] || [])]
            const turnosProf = turnosByProf[prof.id] || []
            return (
              <div
                key={prof.id}
                className="shrink-0 grow"
                style={{ minWidth: COL_MIN_WIDTH, flexBasis: COL_MIN_WIDTH }}
              >
                {/* Header */}
                <div
                  className="bg-beige/50 border-b border-l border-border px-2 py-2 text-xs font-semibold text-text-primary truncate flex items-center gap-1.5"
                  style={{ height: PIXELS_PER_SLOT }}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: prof.color }} />
                  <span className="truncate">{prof.nombre} {prof.apellido || ''}</span>
                </div>

                {/* Body relativo (slots + overlay turnos) */}
                <div className="relative border-l border-border" style={{ height: colHeight }}>
                  {/* Slots de fondo (clickeables) */}
                  {Array.from({ length: totalSlots }).map((_, slotIdx) => {
                    const min = startMin + slotIdx * slotMin
                    const isHourMark = min % 60 === 0
                    const dentroHorario = horariosProf.some(
                      h => timeToMinutes(h.hora_desde) <= min && timeToMinutes(h.hora_hasta) > min,
                    )
                    const slotInstant = new Date(baseDate.getTime() + min * 60 * 1000)
                    const slotEndInstant = new Date(slotInstant.getTime() + slotMin * 60 * 1000)
                    const bloqueadoPuntual = bloqueosProf.some(b => {
                      const bd = new Date(b.fecha_desde)
                      const bh = new Date(b.fecha_hasta)
                      return bd < slotEndInstant && bh > slotInstant
                    })
                    const slotEndMin = min + slotMin
                    const bloqueadoRec = recurrProf.some(r => {
                      const rIni = timeToMinutes(r.hora_desde)
                      const rFin = timeToMinutes(r.hora_hasta)
                      return rIni < slotEndMin && rFin > min
                    })
                    const bloqueado = bloqueadoPuntual || bloqueadoRec
                    const hhmm = minutesToHHMM(min)
                    return (
                      <button
                        key={slotIdx}
                        type="button"
                        onClick={() => !bloqueado && onClickSlot(prof.id, hhmm)}
                        disabled={bloqueado}
                        className={`
                          block w-full text-left
                          ${isHourMark ? 'border-t border-border' : 'border-t border-border-light/50'}
                          ${bloqueado
                            ? 'cursor-not-allowed bg-gray-200/60 [background-image:repeating-linear-gradient(45deg,transparent_0_4px,rgba(0,0,0,0.04)_4px_8px)]'
                            : dentroHorario
                              ? 'hover:bg-green-light/40 cursor-pointer'
                              : 'bg-gray-50/40 hover:bg-beige/40 cursor-pointer'
                          }
                          transition-colors
                        `}
                        style={{ height: PIXELS_PER_SLOT }}
                      />
                    )
                  })}

                  {/* Overlay de turnos */}
                  {turnosProf.map(t => {
                    const tMin = timeToMinutes(t.hora.slice(0, 5))
                    if (tMin < startMin || tMin >= endMin) return null
                    const top = ((tMin - startMin) / slotMin) * PIXELS_PER_SLOT
                    const height = (t.duracion_min / slotMin) * PIXELS_PER_SLOT
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onClickTurno(t)}
                        className={`absolute left-1 right-1 rounded border text-[11px] leading-tight px-1.5 py-1 overflow-hidden text-left hover:shadow-md transition-shadow ${ESTADO_COLORS[t.estado] || ESTADO_COLORS.agendado}`}
                        style={{ top, height: Math.max(height - 2, 18) }}
                        title={`${t.hora.slice(0, 5)} · ${t.paciente} (${t.duracion_min}min)`}
                      >
                        <div className="font-medium truncate">{t.paciente}</div>
                        <div className="text-[9px] opacity-70 truncate">
                          {t.hora.slice(0, 5)} · {t.duracion_min}min
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 flex-wrap text-[10px] text-text-muted px-3 py-2 border-t border-border bg-beige/30">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-light/40 border border-border" /> Hora dentro de horario
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-50 border border-border" /> Fuera de horario (clickeable igual)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-200 border border-border" /> Bloqueado
        </span>
        <span className="ml-auto">Click en hueco = nuevo turno · Click en turno = editar</span>
      </div>
    </div>
  )
}
