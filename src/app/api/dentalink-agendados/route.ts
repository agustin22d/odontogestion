import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { fetchPaginado } from '@/lib/dentalink'

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
  fecha_creacion?: string
  fecha_ingreso?: string
}

function esPrimeraVez(comentario: string): boolean {
  const c = (comentario || '').toLowerCase()
  return (
    c.includes('primera vez') ||
    c.includes('1ra vez') ||
    c.includes('1° vez') ||
    c.includes('1era vez') ||
    c.includes('primer vez') ||
    c.includes('primera consulta') ||
    c.includes('paciente nuevo') ||
    c.includes('pac nuevo') ||
    c.includes('pac nueva')
  )
}

/**
 * Max ID de citas de los 14 días anteriores (una sola query de rango).
 */
async function getMaxIdAnterior(fecha: string): Promise<number> {
  const d = new Date(fecha + 'T12:00:00')

  const yesterday = new Date(d)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const twoWeeksAgo = new Date(d)
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0]

  const citas = await fetchPaginado<DentalinkCitaFull>('/citas', {
    fecha_actualizacion: [
      { gte: `${twoWeeksAgoStr} 00:00:00` },
      { lte: `${yesterdayStr} 23:59:59` },
    ],
  })

  if (citas.length > 0) {
    return Math.max(...citas.map(c => c.id))
  }
  return 0
}

function detectarOrigen(comentario: string): string {
  const c = (comentario || '').toLowerCase()
  if (c.includes('ig') || c.includes('instagram')) return 'Instagram'
  if (c.includes('web')) return 'Web'
  if (c.includes('wp') || c.includes('whatsapp')) return 'WhatsApp'
  if (c.includes('tel') || c.includes('llamad')) return 'Teléfono'
  return 'Otro'
}

export async function GET(request: Request) {
  // Auth check: solo admin
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
  if (!profile || profile.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha') // YYYY-MM-DD

  if (!fecha) {
    return NextResponse.json({ error: 'Falta parámetro fecha' }, { status: 400 })
  }

  try {
    // 1. Obtener max ID de los 14 días anteriores (baseline)
    const maxIdAnterior = await getMaxIdAnterior(fecha)

    // 2. Traer citas actualizadas en la fecha seleccionada
    const citasHoy = await fetchPaginado<DentalinkCitaFull>('/citas', {
      fecha_actualizacion: [
        { gte: `${fecha} 00:00:00` },
        { lte: `${fecha} 23:59:59` },
      ],
    })

    // 3. Filtrar por ID (solo citas creadas recientemente)
    const citasPorId = maxIdAnterior > 0
      ? citasHoy.filter(c => c.id > maxIdAnterior)
      : citasHoy

    // 4. Filtrar solo "primera vez" por comentario
    const citasPrimeraVez = citasPorId.filter(c => esPrimeraVez(c.comentarios))

    // 5. Cruzar con pacientes creados HOY en Dentalink (filtro más preciso)
    let citasNuevas = citasPrimeraVez
    let metodo = 'id+primera_vez'

    try {
      const pacientesNuevos = await fetchPaginado<DentalinkPaciente>('/pacientes', {
        fecha_creacion: [
          { gte: `${fecha} 00:00:00` },
          { lte: `${fecha} 23:59:59` },
        ],
      })

      if (pacientesNuevos.length > 0) {
        const idsPacientesHoy = new Set(pacientesNuevos.map(p => p.id))
        const filtradas = citasPrimeraVez.filter(c => idsPacientesHoy.has(c.id_paciente))
        if (filtradas.length > 0) {
          citasNuevas = filtradas
          metodo = 'id+primera_vez+pacientes'
        }
      }
    } catch {
      try {
        const pacientesNuevos = await fetchPaginado<DentalinkPaciente>('/pacientes', {
          fecha_ingreso: [
            { gte: `${fecha} 00:00:00` },
            { lte: `${fecha} 23:59:59` },
          ],
        })

        if (pacientesNuevos.length > 0) {
          const idsPacientesHoy = new Set(pacientesNuevos.map(p => p.id))
          const filtradas = citasPrimeraVez.filter(c => idsPacientesHoy.has(c.id_paciente))
          if (filtradas.length > 0) {
            citasNuevas = filtradas
            metodo = 'id+primera_vez+ingreso'
          }
        }
      } catch {
        // Pacientes no disponible, queda id+primera_vez
      }
    }

    const agendados = citasNuevas.map(c => ({
      id: c.id,
      paciente: c.nombre_paciente?.trim() || 'Sin nombre',
      fecha_turno: c.fecha,
      hora: c.hora_inicio?.slice(0, 5) || '',
      profesional: c.nombre_dentista || '',
      sede: c.nombre_sucursal || '',
      id_sucursal: c.id_sucursal,
      estado: c.estado_cita || '',
      comentario: c.comentarios || '',
      origen: detectarOrigen(c.comentarios),
      fecha_actualizacion: c.fecha_actualizacion,
    }))

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
      total_modificados: citasHoy.length,
      total_por_id: citasPorId.length,
      total_primera_vez: citasPrimeraVez.length,
      max_id_anterior: maxIdAnterior,
      metodo,
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
