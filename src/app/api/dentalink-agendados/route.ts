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
    c.includes('pv') ||
    c.includes('primera consulta') ||
    c.includes('paciente nuevo') ||
    c.includes('pac nuevo') ||
    c.includes('pac nueva')
  )
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
    // 1. Traer citas actualizadas en la fecha seleccionada
    const citasHoy = await fetchPaginado<DentalinkCitaFull>('/citas', {
      fecha_actualizacion: [
        { gte: `${fecha} 00:00:00` },
        { lte: `${fecha} 23:59:59` },
      ],
    })

    // 2. Filtrar solo "primera vez" por comentario
    const citasPrimeraVez = citasHoy.filter(c => esPrimeraVez(c.comentarios))

    // 3. Cruzar con pacientes creados HOY en Dentalink
    //    Si es "primera vez", el paciente se creó el mismo día que se dio el turno
    let citasNuevas = citasPrimeraVez
    let metodo = 'primera_vez_only'

    try {
      // Intentar con fecha_creacion
      const pacientesNuevos = await fetchPaginado<DentalinkPaciente>('/pacientes', {
        fecha_creacion: [
          { gte: `${fecha} 00:00:00` },
          { lte: `${fecha} 23:59:59` },
        ],
      })

      if (pacientesNuevos.length > 0) {
        const idsPacientesHoy = new Set(pacientesNuevos.map(p => p.id))
        const filtradas = citasPrimeraVez.filter(c => idsPacientesHoy.has(c.id_paciente))
        citasNuevas = filtradas
        metodo = 'pacientes_creados_hoy'
      }
    } catch {
      // Si falla fecha_creacion, intentar con fecha_ingreso
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
          citasNuevas = filtradas
          metodo = 'pacientes_ingreso_hoy'
        }
      } catch {
        // Ningún endpoint de pacientes funciona, usar solo primera vez
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
      total_primera_vez: citasPrimeraVez.length,
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
