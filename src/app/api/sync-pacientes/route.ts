import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { fetchPaginado } from '@/lib/dentalink'
import type { DentalinkCita } from '@/lib/dentalink'

export const maxDuration = 60

const API_BASE = process.env.DENTALINK_API_BASE || 'https://api.dentalink.healthatom.com/api/v1'
const API_TOKEN = process.env.DENTALINK_API_TOKEN || ''

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function detectarOrigen(comentario: string): string {
  const c = (comentario || '').toLowerCase()
  if (c.includes('ig') || c.includes('insta') || c.includes('instagram')) return 'Instagram'
  if (c.includes('wp') || c.includes('ws') || c.includes('wsp') || c.includes('whatsapp') || c.includes('wapp')) return 'WhatsApp'
  if (c.includes('web') || c.includes('pag') || c.includes('página') || c.includes('pagina')) return 'Web'
  if (c.includes('tel') || c.includes('llamad') || c.includes('llamó') || c.includes('llamo')) return 'Teléfono'
  if (c.includes('referi') || c.includes('conocido') || c.includes('recomend')) return 'Referido'
  if (c.includes('fb') || c.includes('facebook')) return 'Facebook'
  return 'Otro'
}

function extraerFecha(valor: unknown): string {
  if (!valor || typeof valor !== 'string') return ''
  return valor.split(' ')[0].split('T')[0]
}

interface DentalinkPaciente {
  id: number
  nombre: string
  apellido: string
  fecha_afiliacion: string
  [key: string]: unknown
}

/**
 * Sync pacientes por fecha_afiliacion para UN día específico.
 * Busca pacientes en Dentalink cuya fecha_afiliacion = fecha,
 * luego busca su primera cita para obtener sede/profesional/comentario.
 */
export async function syncPacientesDia(fecha: string): Promise<number> {
  const supabase = getSupabaseAdmin()

  // 1. Buscar pacientes con fecha_afiliacion = fecha
  const pacientes = await fetchPaginado<DentalinkPaciente>('/pacientes', {
    fecha_afiliacion: [{ gte: fecha }, { lte: fecha }],
  })

  // Double-check fecha
  const pacientesDia = pacientes.filter(p => extraerFecha(p.fecha_afiliacion) === fecha)
  if (pacientesDia.length === 0) return 0

  // 2. Borrar registros existentes para este día (replace completo)
  await supabase
    .from('pacientes_nuevos')
    .delete()
    .eq('fecha_afiliacion', fecha)

  // 3. Buscar citas para obtener detalles (sede, profesional, comentario)
  let citas: DentalinkCita[] = []
  try {
    const hasta = new Date(fecha + 'T12:00:00')
    hasta.setDate(hasta.getDate() + 90)
    const fechaHasta = hasta.toISOString().split('T')[0]
    citas = await fetchPaginado<DentalinkCita>('/citas', {
      fecha: [{ gte: fecha }, { lte: fechaHasta }],
    })
  } catch {
    // Si falla, insertar sin detalles de cita
  }

  // 4. Armar registros
  const rows = pacientesDia.map(p => {
    const nombre = [p.nombre, p.apellido].filter(Boolean).join(' ').trim() || 'Sin nombre'
    const primeraCita = citas
      .filter(c => c.id_paciente === p.id)
      .sort((a, b) => `${a.fecha} ${a.hora_inicio}`.localeCompare(`${b.fecha} ${b.hora_inicio}`))[0]

    return {
      id_dentalink: p.id,
      nombre: primeraCita?.nombre_paciente?.trim() || nombre,
      fecha_afiliacion: fecha,
      primera_cita_fecha: primeraCita?.fecha || null,
      primera_cita_hora: primeraCita?.hora_inicio?.slice(0, 5) || null,
      primera_cita_profesional: primeraCita?.nombre_dentista || null,
      primera_cita_sede: primeraCita?.nombre_sucursal || null,
      primera_cita_id_sucursal: primeraCita?.id_sucursal || null,
      primera_cita_comentario: primeraCita?.comentarios || null,
      origen: detectarOrigen(primeraCita?.comentarios || ''),
    }
  })

  // 5. Insertar
  let inserted = 0
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200)
    const { error } = await supabase.from('pacientes_nuevos').upsert(batch, { onConflict: 'id_dentalink' })
    if (error) console.error('Insert error:', error.message)
    else inserted += batch.length
  }

  return inserted
}

/**
 * POST /api/sync-pacientes
 * Body: { desde: "2026-04-01", hasta: "2026-04-14" }
 *
 * Backfill: sincroniza pacientes día por día usando fecha_afiliacion.
 * Primero limpia la tabla, luego recarga desde Dentalink.
 */
export async function POST(request: Request) {
  try {
    const supabaseAuth = await createServerClient()
    const { data: { user: authUser } } = await supabaseAuth.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const { data: profile } = await supabaseAuth
      .from('users')
      .select('rol')
      .eq('id', authUser.id)
      .single()
    if (!profile || profile.rol !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const desde = body.desde || '2026-04-01'
    const hasta = body.hasta || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
    const limpiar = body.limpiar !== false // default: true

    const supabase = getSupabaseAdmin()

    // Limpiar tabla completa si se pide
    if (limpiar) {
      await supabase.from('pacientes_nuevos').delete().gte('fecha_afiliacion', desde).lte('fecha_afiliacion', hasta)
      console.log(`Limpiados registros de ${desde} a ${hasta}`)
    }

    // Procesar día por día
    let totalInserted = 0
    const cursor = new Date(desde + 'T12:00:00')
    const end = new Date(hasta + 'T12:00:00')
    const resultados: Array<{ fecha: string; count: number }> = []

    while (cursor <= end) {
      const fecha = cursor.toISOString().split('T')[0]
      try {
        const count = await syncPacientesDia(fecha)
        totalInserted += count
        resultados.push({ fecha, count })
        console.log(`Sync pacientes ${fecha}: ${count}`)
      } catch (err) {
        console.error(`Error sync ${fecha}:`, err)
        resultados.push({ fecha, count: -1 })
      }

      cursor.setDate(cursor.getDate() + 1)

      // Pausa entre días para no saturar API
      await new Promise(r => setTimeout(r, 1000))
    }

    return NextResponse.json({
      ok: true,
      desde,
      hasta,
      total: totalInserted,
      por_dia: resultados,
    })
  } catch (error) {
    console.error('Sync pacientes error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
