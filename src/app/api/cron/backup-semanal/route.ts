import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET || ''
const BACKUP_EMAIL = process.env.BACKUP_EMAIL || ''
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Cron semanal: exporta datos críticos y los manda por email como CSV adjuntos.
 * Tablas: laboratorio_casos, gastos, stock_productos, stock_movimientos, pacientes_nuevos
 * Corre los domingos a las 06:00 UTC (03:00 AR).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!RESEND_API_KEY || !BACKUP_EMAIL) {
    return NextResponse.json({ error: 'RESEND_API_KEY or BACKUP_EMAIL not configured' }, { status: 500 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const fecha = new Date().toISOString().split('T')[0]

    // Fetch all critical tables
    const [labRes, gastosRes, stockProdRes, stockMovRes, pacientesRes] = await Promise.all([
      supabase.from('laboratorio_casos').select('*').order('created_at', { ascending: false }),
      supabase.from('gastos').select('*').order('fecha', { ascending: false }),
      supabase.from('stock_productos').select('*').order('nombre'),
      supabase.from('stock_movimientos').select('*').order('fecha', { ascending: false }),
      supabase.from('pacientes_nuevos').select('*').order('fecha_afiliacion', { ascending: false }),
    ])

    // Convert to CSV
    function toCsv(data: Record<string, unknown>[]): string {
      if (!data.length) return ''
      const headers = Object.keys(data[0])
      const rows = data.map(row => headers.map(h => {
        const val = row[h]
        if (val === null || val === undefined) return ''
        const str = String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(','))
      return [headers.join(','), ...rows].join('\n')
    }

    const attachments = [
      { filename: `laboratorio_${fecha}.csv`, content: Buffer.from(toCsv((labRes.data || []) as Record<string, unknown>[]), 'utf-8') },
      { filename: `gastos_${fecha}.csv`, content: Buffer.from(toCsv((gastosRes.data || []) as Record<string, unknown>[]), 'utf-8') },
      { filename: `stock_productos_${fecha}.csv`, content: Buffer.from(toCsv((stockProdRes.data || []) as Record<string, unknown>[]), 'utf-8') },
      { filename: `stock_movimientos_${fecha}.csv`, content: Buffer.from(toCsv((stockMovRes.data || []) as Record<string, unknown>[]), 'utf-8') },
      { filename: `pacientes_nuevos_${fecha}.csv`, content: Buffer.from(toCsv((pacientesRes.data || []) as Record<string, unknown>[]), 'utf-8') },
    ].filter(a => a.content.length > 0)

    const resend = new Resend(RESEND_API_KEY)

    await resend.emails.send({
      from: 'Odonto Gestión Backup <onboarding@resend.dev>',
      to: BACKUP_EMAIL.split(',').map(e => e.trim()),
      subject: `Backup semanal Odonto Gestión — ${fecha}`,
      html: `
        <h2>Backup semanal — ${fecha}</h2>
        <p>Adjuntos los datos críticos del sistema:</p>
        <ul>
          <li><strong>Laboratorio:</strong> ${labRes.data?.length || 0} casos</li>
          <li><strong>Gastos:</strong> ${gastosRes.data?.length || 0} registros</li>
          <li><strong>Stock productos:</strong> ${stockProdRes.data?.length || 0} productos</li>
          <li><strong>Stock movimientos:</strong> ${stockMovRes.data?.length || 0} movimientos</li>
          <li><strong>Pacientes nuevos:</strong> ${pacientesRes.data?.length || 0} registros</li>
        </ul>
        <p style="color: #666; font-size: 12px;">Generado automáticamente por Odonto Gestión</p>
      `,
      attachments,
    })

    return NextResponse.json({
      ok: true,
      fecha,
      tablas: {
        laboratorio: labRes.data?.length || 0,
        gastos: gastosRes.data?.length || 0,
        stock_productos: stockProdRes.data?.length || 0,
        stock_movimientos: stockMovRes.data?.length || 0,
        pacientes_nuevos: pacientesRes.data?.length || 0,
      },
    })
  } catch (error) {
    console.error('Backup error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
