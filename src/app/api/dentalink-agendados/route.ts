import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { fetchPaginado } from '@/lib/dentalink'

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

/**
 * Batch de lookups de pacientes con rate limiting.
 * Ejecuta en lotes de `batchSize` en paralelo, con `delayMs` entre lotes.
 */
async function batchFetchPacientes(
  patientIds: number[],
  batchSize = 10,
  delayMs = 500
): Promise<Map<number, Record<string, unknown>>> {
  const results = new Map<number, Record<string, unknown>>()

  for (let i = 0; i < patientIds.length; i += batchSize) {
    const batch = patientIds.slice(i, i + batchSize)
    const promises = batch.map(async (id) => {
      try {
        const res = await fetch(`${API_BASE}/pacientes/${id}`, {
          headers: {
            'Authorization': `Token ${API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        })
        if (!res.ok) return { id, data: null }
        const json = await res.json()
        return { id, data: json.data || json }
      } catch {
        return { id, data: null }
      }
    })

    const batchResults = await Promise.all(promises)
    for (const r of batchResults) {
      if (r.data) results.set(r.id, r.data)
    }

    // Pausa entre lotes para evitar rate limiting
    if (i + batchSize < patientIds.length) {
      await new Promise(r => setTimeout(r, delayMs))
    }
  }

  return results
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
    // (fecha_afiliacion = fecha), sin importar cuándo es su turno.
    //
    // Estrategia: consultar citas con fecha_actualizacion = día exacto
    // (sin expandir ventana para evitar rate limiting de Dentalink).
    // Para cada paciente único, verificar fecha_afiliacion en batch.
    //
    // Hoy funciona perfecto (~90 pacientes, todos los lookups exitosos).
    // Para fechas pasadas: captura citas no actualizadas desde ese día.

    const citas = await fetchPaginado<DentalinkCitaFull>('/citas', {
      fecha_actualizacion: [
        { gte: `${fecha} 00:00:00` },
        { lte: `${fecha} 23:59:59` },
      ],
    })

    // Deduplicar pacientes
    const pacienteIds: number[] = []
    const pacienteIdSet = new Set<number>()
    const citaPorPaciente = new Map<number, DentalinkCitaFull>()

    for (const cita of citas) {
      if (!pacienteIdSet.has(cita.id_paciente)) {
        pacienteIdSet.add(cita.id_paciente)
        pacienteIds.push(cita.id_paciente)
        citaPorPaciente.set(cita.id_paciente, cita)
      }
    }

    // Batch lookup de pacientes (10 en paralelo, 500ms entre lotes)
    const pacientesData = await batchFetchPacientes(pacienteIds, 10, 500)

    // Filtrar por fecha_afiliacion = fecha seleccionada
    const agendados: Array<{
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
    }> = []

    let lookupsFailed = 0

    for (const patientId of pacienteIds) {
      const paciente = pacientesData.get(patientId)
      if (!paciente) {
        lookupsFailed++
        continue
      }

      const fechaAlta = extraerFecha(paciente['fecha_afiliacion'])
      if (fechaAlta !== fecha) continue

      const cita = citaPorPaciente.get(patientId)!
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
      })
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
      debug: {
        total_citas: citas.length,
        pacientes_unicos: pacienteIds.length,
        lookups_ok: pacientesData.size,
        lookups_failed: lookupsFailed,
      },
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
