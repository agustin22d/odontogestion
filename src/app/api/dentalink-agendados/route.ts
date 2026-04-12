import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { fetchPaginado } from '@/lib/dentalink'
import { getArgentinaToday } from '@/lib/utils/dates'

const API_BASE = process.env.DENTALINK_API_BASE || 'https://api.dentalink.healthatom.com/api/v1'
const API_TOKEN = process.env.DENTALINK_API_TOKEN || ''

interface DentalinkCitaFull {
  id: number
  id_paciente: number
  nombre_paciente: string
  nombre_social_paciente: string
  id_estado: number
  estado_cita: string
  id_tratamiento: number
  nombre_tratamiento: string
  id_dentista: number
  nombre_dentista: string
  id_sucursal: number
  nombre_sucursal: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  duracion: number
  comentarios: string
  fecha_actualizacion: string
}

interface DentalinkPaciente {
  id: number
  nombre: string
  apellido: string
  fecha_afiliacion: string
  [key: string]: unknown
}

function detectarOrigen(comentario: string): string {
  const c = (comentario || '').toLowerCase()
  if (c.includes('ig') || c.includes('insta') || c.includes('instagram')) return 'Instagram'
  if (c.includes('wp') || c.includes('ws') || c.includes('wsp') || c.includes('whatsapp') || c.includes('wapp')) return 'WhatsApp'
  if (c.includes('web') || c.includes('pag') || c.includes('página') || c.includes('pagina')) return 'Web'
  if (c.includes('tel') || c.includes('llamad') || c.includes('llamó') || c.includes('llamo')) return 'Teléfono'
  if (c.includes('referi') || c.includes('conocido') || c.includes('recomend')) return 'Referido'
  return 'Otro'
}

function extraerFecha(valor: unknown): string {
  if (!valor || typeof valor !== 'string') return ''
  return valor.split(' ')[0].split('T')[0]
}

async function fetchPaciente(idPaciente: number): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API_BASE}/pacientes/${idPaciente}`, {
      headers: {
        'Authorization': `Token ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data || json
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  // Auth check: admin y rolA
  const supabase = await createServerClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('users')
    .select('rol')
    .eq('id', authUser.id)
    .single()
  if (!profile || !['admin', 'rolA'].includes(profile.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha') // YYYY-MM-DD

  if (!fecha) {
    return NextResponse.json({ error: 'Falta parámetro fecha' }, { status: 400 })
  }

  try {
    // "Turnos dados" = pacientes REGISTRADOS en la fecha seleccionada
    // (fecha_afiliacion = fecha), independientemente de cuándo es su turno.
    //
    // Estrategia con fallback:
    // 1) Intentar /pacientes con fecha_actualizacion (la mayoría de endpoints lo soportan)
    //    y filtrar por fecha_afiliacion del response (sin lookups individuales)
    // 2) Si falla, usar /citas con ventana amplia + lookups individuales de pacientes

    let agendados: Array<{
      id: number
      paciente: string
      fecha_turno: string
      hora: string
      profesional: string
      sede: string
      id_sucursal: number
      estado: string
      comentario: string
      origen: string
      fecha_alta: string
    }> = []
    let metodo = ''
    let debugInfo: Record<string, unknown> = {}

    try {
      // Estrategia 1: Consultar pacientes directamente
      // fecha_actualizacion ≈ fecha_afiliacion para pacientes nuevos
      // (los perfiles de pacientes rara vez se actualizan después de la creación)
      const pacientes = await fetchPaginado<DentalinkPaciente>('/pacientes', {
        fecha_actualizacion: [
          { gte: `${fecha} 00:00:00` },
          { lte: `${fecha} 23:59:59` },
        ],
      })

      // Filtrar por fecha_afiliacion = fecha seleccionada
      const nuevos = pacientes.filter(p => {
        const fa = extraerFecha(p.fecha_afiliacion)
        return fa === fecha
      })

      metodo = 'pacientes_directo'
      debugInfo = {
        total_pacientes_actualizados: pacientes.length,
        total_con_afiliacion_match: nuevos.length,
      }

      // Para cada paciente nuevo, obtener su primera cita
      for (const pac of nuevos) {
        const citas = await fetchPaginado<DentalinkCitaFull>('/citas', {
          id_paciente: pac.id,
        })

        const primera = citas.sort((a, b) => {
          return `${a.fecha} ${a.hora_inicio}`.localeCompare(`${b.fecha} ${b.hora_inicio}`)
        })[0]

        const nombre = primera
          ? primera.nombre_paciente?.trim()
          : [pac.nombre, pac.apellido].filter(Boolean).join(' ').trim()

        agendados.push({
          id: primera?.id || pac.id,
          paciente: nombre || 'Sin nombre',
          fecha_turno: primera?.fecha || '',
          hora: primera?.hora_inicio?.slice(0, 5) || '',
          profesional: primera?.nombre_dentista || '',
          sede: primera?.nombre_sucursal || '',
          id_sucursal: primera?.id_sucursal || 0,
          estado: primera?.estado_cita || '',
          comentario: primera?.comentarios || '',
          origen: detectarOrigen(primera?.comentarios || ''),
          fecha_alta: fecha,
        })

        await new Promise(r => setTimeout(r, 150))
      }
    } catch (pacError) {
      // Estrategia 2: Fallback con citas
      console.log('Pacientes endpoint falló, usando fallback de citas:', pacError)

      // Ventana: fecha seleccionada hasta +7 días o hoy
      const windowEnd = new Date(fecha + 'T12:00:00')
      windowEnd.setDate(windowEnd.getDate() + 7)
      const today = getArgentinaToday()
      const endStr = windowEnd.toISOString().split('T')[0]
      const effectiveEnd = endStr > today ? today : endStr

      const citas = await fetchPaginado<DentalinkCitaFull>('/citas', {
        fecha_actualizacion: [
          { gte: `${fecha} 00:00:00` },
          { lte: `${effectiveEnd} 23:59:59` },
        ],
      })

      // Deduplicar por paciente, verificar fecha_afiliacion
      const pacientesVistos = new Set<number>()
      const sampleDates: Record<string, number> = {}
      let lookupsFailed = 0

      for (const cita of citas) {
        if (pacientesVistos.has(cita.id_paciente)) continue
        pacientesVistos.add(cita.id_paciente)

        const paciente = await fetchPaciente(cita.id_paciente)
        if (!paciente) {
          lookupsFailed++
          continue
        }

        const fechaAlta = extraerFecha(paciente['fecha_afiliacion'])

        // Track distribution for debug
        sampleDates[fechaAlta || 'null'] = (sampleDates[fechaAlta || 'null'] || 0) + 1

        if (fechaAlta !== fecha) continue

        agendados.push({
          id: cita.id,
          paciente: cita.nombre_paciente?.trim() || 'Sin nombre',
          fecha_turno: cita.fecha,
          hora: cita.hora_inicio?.slice(0, 5) || '',
          profesional: cita.nombre_dentista || '',
          sede: cita.nombre_sucursal || '',
          id_sucursal: cita.id_sucursal,
          estado: cita.estado_cita || '',
          comentario: cita.comentarios || '',
          origen: detectarOrigen(cita.comentarios),
          fecha_alta: fechaAlta,
        })

        await new Promise(r => setTimeout(r, 100))
      }

      metodo = 'citas_fallback'
      debugInfo = {
        ventana: `${fecha} → ${effectiveEnd}`,
        total_citas: citas.length,
        pacientes_unicos: pacientesVistos.size,
        lookups_failed: lookupsFailed,
        distribucion_fechas_alta: sampleDates,
      }
    }

    // Resumen
    const porSede: Record<string, number> = {}
    const porOrigen: Record<string, number> = {}
    agendados.forEach(a => {
      porSede[a.sede] = (porSede[a.sede] || 0) + 1
      porOrigen[a.origen] = (porOrigen[a.origen] || 0) + 1
    })

    return NextResponse.json({
      fecha,
      total: agendados.length,
      metodo,
      debug: debugInfo,
      por_sede: porSede,
      por_origen: porOrigen,
      agendados,
    })
  } catch (error) {
    console.error('Error fetching agendados:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
