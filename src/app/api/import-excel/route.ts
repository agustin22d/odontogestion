import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

type Entity = 'turnos' | 'cobranzas' | 'gastos'

/**
 * Importa un archivo .xlsx/.csv y hace bulk insert en la tabla indicada.
 * Sólo admin.
 *
 * Body: multipart/form-data con:
 *   file:   archivo .xlsx o .csv
 *   entity: 'turnos' | 'cobranzas' | 'gastos'
 *
 * Formato esperado (headers de la primera fila):
 *   turnos:     fecha | hora | sede | paciente | profesional | estado | origen
 *   cobranzas:  fecha | sede | paciente | tratamiento | tipo_pago | monto | notas
 *   gastos:     fecha | concepto | categoria | monto | sede | estado
 */
export async function POST(req: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admin puede importar' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const entity = formData.get('entity') as Entity | null

  if (!file || !entity) {
    return NextResponse.json({ error: 'Faltan file o entity' }, { status: 400 })
  }
  if (!['turnos', 'cobranzas', 'gastos'].includes(entity)) {
    return NextResponse.json({ error: 'Entity inválido' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false })

  if (rows.length === 0) {
    return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  }

  // Mapa sede nombre → id
  const { data: sedes } = await supabase.from('sedes').select('id, nombre')
  const sedeMap = new Map<string, string>()
  for (const s of sedes || []) {
    sedeMap.set(s.nombre.toLowerCase().trim(), s.id)
  }

  const errors: string[] = []
  let inserted = 0

  if (entity === 'turnos') {
    const payload = rows
      .map((r, idx) => {
        const sedeId = sedeMap.get(String(r.sede ?? '').toLowerCase().trim())
        if (!sedeId) {
          errors.push(`Fila ${idx + 2}: sede "${r.sede}" no encontrada`)
          return null
        }
        return {
          fecha: formatDate(r.fecha, idx + 2, errors),
          hora: String(r.hora ?? '09:00'),
          sede_id: sedeId,
          paciente: String(r.paciente ?? '').trim(),
          profesional: r.profesional ? String(r.profesional).trim() : null,
          estado: normalizeEstadoTurno(r.estado),
          origen: normalizeOrigen(r.origen),
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && !!r.fecha && !!r.paciente)

    if (payload.length > 0) {
      const { error } = await supabase.from('turnos').insert(payload)
      if (error) return NextResponse.json({ error: error.message, errors }, { status: 500 })
      inserted = payload.length
    }
  } else if (entity === 'cobranzas') {
    const payload = rows
      .map((r, idx) => {
        const sedeId = sedeMap.get(String(r.sede ?? '').toLowerCase().trim())
        if (!sedeId) {
          errors.push(`Fila ${idx + 2}: sede "${r.sede}" no encontrada`)
          return null
        }
        const monto = parseNumber(r.monto)
        if (monto === null || monto <= 0) {
          errors.push(`Fila ${idx + 2}: monto inválido`)
          return null
        }
        return {
          fecha: formatDate(r.fecha, idx + 2, errors),
          sede_id: sedeId,
          sede_ids: [sedeId],
          user_id: user.id,
          paciente: String(r.paciente ?? '').trim(),
          tratamiento: String(r.tratamiento ?? 'Sin especificar').trim(),
          tipo_pago: normalizeTipoPago(r.tipo_pago),
          monto,
          es_cuota: false,
          notas: r.notas ? String(r.notas).trim() : null,
          moneda: 'ARS',
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && !!r.fecha && !!r.paciente)

    if (payload.length > 0) {
      const { error } = await supabase.from('cobranzas').insert(payload)
      if (error) return NextResponse.json({ error: error.message, errors }, { status: 500 })
      inserted = payload.length
    }
  } else if (entity === 'gastos') {
    const payload = rows
      .map((r, idx) => {
        const sedeIdRaw = String(r.sede ?? '').toLowerCase().trim()
        const sedeId = sedeIdRaw ? sedeMap.get(sedeIdRaw) : null
        const monto = parseNumber(r.monto)
        if (monto === null || monto <= 0) {
          errors.push(`Fila ${idx + 2}: monto inválido`)
          return null
        }
        return {
          fecha: formatDate(r.fecha, idx + 2, errors),
          sede_ids: sedeId ? [sedeId] : [],
          user_id: user.id,
          concepto: String(r.concepto ?? '').trim(),
          categoria: String(r.categoria ?? 'otros').toLowerCase().trim(),
          monto,
          tipo: 'variable' as const,
          estado: normalizeEstadoGasto(r.estado),
          moneda: 'ARS',
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && !!r.fecha && !!r.concepto)

    if (payload.length > 0) {
      const { error } = await supabase.from('gastos').insert(payload)
      if (error) return NextResponse.json({ error: error.message, errors }, { status: 500 })
      inserted = payload.length
    }
  }

  return NextResponse.json({
    ok: true,
    inserted,
    total: rows.length,
    skipped: rows.length - inserted,
    errors: errors.slice(0, 10),
  })
}

// ── Helpers ─────────────────────────────────────

function formatDate(value: unknown, rowNum: number, errors: string[]): string {
  if (!value) {
    errors.push(`Fila ${rowNum}: fecha vacía`)
    return ''
  }
  if (value instanceof Date) return value.toISOString().split('T')[0]
  const str = String(value).trim()
  // Formato DD/MM/YYYY
  const ddmm = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (ddmm) {
    const [, d, m, y] = ddmm
    const year = y.length === 2 ? '20' + y : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // Formato YYYY-MM-DD (ya válido)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  // Intentar parseo nativo
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0]
  errors.push(`Fila ${rowNum}: fecha inválida "${str}"`)
  return ''
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(String(value).replace(/[^\d.,-]/g, '').replace(',', '.'))
  return isNaN(num) ? null : num
}

function normalizeEstadoTurno(v: unknown): string {
  const s = String(v ?? '').toLowerCase().trim()
  if (['atendido', 'no_asistio', 'cancelado', 'reprogramado'].includes(s)) return s
  if (s === 'no asistio' || s === 'no asistió') return 'no_asistio'
  return 'agendado'
}

function normalizeOrigen(v: unknown): string {
  const s = String(v ?? '').toLowerCase().trim()
  if (['web', 'whatsapp', 'telefono', 'teléfono', 'instagram'].includes(s)) {
    return s === 'teléfono' ? 'telefono' : s
  }
  return 'whatsapp'
}

function normalizeTipoPago(v: unknown): string {
  const s = String(v ?? '').toLowerCase().trim()
  if (s.includes('efectivo')) return 'efectivo'
  if (s.includes('transfer')) return 'transferencia'
  if (s.includes('credit')) return 'tarjeta_credito'
  if (s.includes('debit')) return 'tarjeta_debito'
  return 'efectivo'
}

function normalizeEstadoGasto(v: unknown): string {
  const s = String(v ?? '').toLowerCase().trim()
  if (s === 'pagado') return 'pagado'
  return 'pendiente'
}
