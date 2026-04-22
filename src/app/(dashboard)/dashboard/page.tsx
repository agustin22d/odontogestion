'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DollarSign,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckSquare,
  XCircle,
  Building2,
  CalendarPlus,
  Package,
  Crown,
  AlertTriangle,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { Sede } from '@/types/database'
import { getArgentinaToday, getArgentinaDate, formatFechaHoyAR } from '@/lib/utils/dates'

type RangoPreset = 'hoy' | 'semana' | 'mes' | 'anio' | 'custom'

interface TurnoStats {
  total: number
  atendidos: number
  noShows: number
  cancelados: number
  agendados: number
  tasaShow: number
}

interface TurnosPorSede {
  sede_nombre: string
  total: number
  atendidos: number
  noShows: number
}

export default function DashboardPage() {
  return <AdminDashboard />
}

function AdminDashboard() {
  const supabase = createClient()
  const [sedes, setSedes] = useState<Sede[]>([])
  const [sedeFilter, setSedeFilter] = useState<string>('todas')
  const [rango, setRango] = useState<RangoPreset>('mes')
  const [customInicio, setCustomInicio] = useState(() => getArgentinaToday())
  const [customFin, setCustomFin] = useState(() => getArgentinaToday())

  const [turnoStats, setTurnoStats] = useState<TurnoStats>({ total: 0, atendidos: 0, noShows: 0, cancelados: 0, agendados: 0, tasaShow: 0 })
  const [turnosPorSede, setTurnosPorSede] = useState<TurnosPorSede[]>([])
  const [cobradoRango, setCobradoRango] = useState(0)
  const [gastosRango, setGastosRango] = useState(0)
  const [deudasPendientes, setDeudasPendientes] = useState(0)
  const [chartData, setChartData] = useState<{ label: string; cobrado: number; gastos: number }[]>([])
  const [turnosDadosHoy, setTurnosDadosHoy] = useState(0)
  const [stockBajo, setStockBajo] = useState(0)
  const [labPendientes, setLabPendientes] = useState(0)
  const [gastosVencenHoy, setGastosVencenHoy] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const hoy = getArgentinaToday()

  // Calcular inicio/fin según el rango seleccionado
  const { inicio, fin, label } = useMemo(() => computeRango(rango, customInicio, customFin, hoy), [rango, customInicio, customFin, hoy])

  const fetchSedes = useCallback(async () => {
    const { data, error } = await supabase.from('sedes').select('*').eq('activa', true).order('nombre')
    if (error) console.error('Error fetching sedes:', error)
    if (data) setSedes(data)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      let turnosQuery = supabase.from('turnos').select('*, sedes(nombre)').eq('fecha', hoy)
      if (sedeFilter !== 'todas') turnosQuery = turnosQuery.eq('sede_id', sedeFilter)

      const cobRangoQuery = supabase.from('cobranzas').select('fecha, monto, sede_id').gte('fecha', inicio).lte('fecha', fin)
      const gasRangoQuery = supabase.from('gastos').select('fecha, monto, sede_id, estado_pago').gte('fecha', inicio).lte('fecha', fin)

      const deudasQuery = supabase.from('deudas').select('monto_total, monto_cobrado, sede_id').in('estado', ['pendiente', 'parcial'])
      const sedesQuery = supabase.from('sedes').select('*').eq('activa', true).order('nombre')

      const turnosDadosQuery = supabase.from('turnos').select('id', { count: 'exact', head: true }).gte('created_at', hoy + 'T00:00:00').lt('created_at', hoy + 'T23:59:59.999')
      const stockProductosQuery = supabase.from('stock_productos').select('id, stock_minimo').eq('activo', true)
      const stockMovQuery = supabase.from('stock_movimientos').select('producto_id, sede_id, tipo, cantidad')
      const labQuery = supabase.from('laboratorio_casos').select('id', { count: 'exact', head: true }).in('estado', ['escaneado', 'enviada', 'en_proceso', 'a_revisar'])
      const gastosHoyQuery = supabase.from('gastos').select('id', { count: 'exact', head: true }).eq('estado_pago', 'pendiente').eq('fecha_vencimiento', hoy)

      const [turnosRes, cobRangoRes, gasRangoRes, deudasRes, sedesRes, turnosDadosRes, stockProdRes, stockMovRes, labRes, gastosHoyRes] = await Promise.all([
        turnosQuery, cobRangoQuery, gasRangoQuery, deudasQuery, sedesQuery, turnosDadosQuery, stockProductosQuery, stockMovQuery, labQuery, gastosHoyQuery,
      ])

      const errors = [turnosRes, cobRangoRes, gasRangoRes, deudasRes, sedesRes, stockProdRes, stockMovRes].map(r => r.error).filter(Boolean)
      if (errors.length > 0) {
        console.error('Dashboard query errors:', errors)
        setFetchError('Algunas consultas fallaron. Los datos pueden estar incompletos.')
      }

      const allSedes = (sedesRes.data || []) as Sede[]
      if (allSedes.length > 0) setSedes(allSedes)

      const cobMonto = (c: { monto: number; sede_id?: string | null }): number => {
        const monto = Number(c.monto)
        if (sedeFilter === 'todas') return monto
        return c.sede_id === sedeFilter ? monto : 0
      }
      const gasMonto = (g: { monto: number; sede_id?: string | null }): number => {
        const monto = Number(g.monto)
        if (sedeFilter === 'todas') return monto
        return g.sede_id === sedeFilter ? monto : 0
      }

      // Turnos (siempre "hoy" — operativo)
      const turnosHoy = turnosRes.data || []
      const total = turnosHoy.length
      const atendidos = turnosHoy.filter((t: { estado: string }) => t.estado === 'atendido').length
      const noShows = turnosHoy.filter((t: { estado: string }) => t.estado === 'no_asistio').length
      const cancelados = turnosHoy.filter((t: { estado: string }) => t.estado === 'cancelado').length
      const agendados = turnosHoy.filter((t: { estado: string }) => t.estado === 'agendado').length
      const relevantes = atendidos + noShows
      const tasaShow = relevantes > 0 ? Math.round((atendidos / relevantes) * 100) : 0
      setTurnoStats({ total, atendidos, noShows, cancelados, agendados, tasaShow })

      if (sedeFilter === 'todas') {
        const porSede: Record<string, TurnosPorSede> = {}
        turnosHoy.forEach((t: { sedes: { nombre: string } | null; estado: string }) => {
          const nombre = t.sedes?.nombre || 'Sin sede'
          if (!porSede[nombre]) porSede[nombre] = { sede_nombre: nombre, total: 0, atendidos: 0, noShows: 0 }
          porSede[nombre].total++
          if (t.estado === 'atendido') porSede[nombre].atendidos++
          if (t.estado === 'no_asistio') porSede[nombre].noShows++
        })
        setTurnosPorSede(Object.values(porSede).sort((a, b) => b.total - a.total))
      }

      // Cobranzas y gastos del rango
      const cobData = (cobRangoRes.data || []) as { fecha: string; monto: number; sede_id?: string | null }[]
      const gasData = (gasRangoRes.data || []) as { fecha: string; monto: number; sede_id?: string | null; estado_pago?: string }[]

      setCobradoRango(cobData.reduce((s, c) => s + cobMonto(c), 0))
      setGastosRango(gasData.filter(g => g.estado_pago === 'pagado').reduce((s, g) => s + gasMonto(g), 0))

      // Deudas (todas las activas, independiente del rango)
      const deudasData = (deudasRes.data || []) as { monto_total: number; monto_cobrado: number; sede_id?: string }[]
      const totalDeudas = sedeFilter === 'todas'
        ? deudasData.reduce((sum, d) => sum + (Number(d.monto_total) - Number(d.monto_cobrado)), 0)
        : deudasData.filter(d => d.sede_id === sedeFilter).reduce((sum, d) => sum + (Number(d.monto_total) - Number(d.monto_cobrado)), 0)
      setDeudasPendientes(totalDeudas)

      setTurnosDadosHoy(turnosDadosRes.count || 0)

      // Stock bajo
      const productos = (stockProdRes.data || []) as { id: string; stock_minimo: number }[]
      const movimientos = (stockMovRes.data || []) as { producto_id: string; sede_id: string; tipo: string; cantidad: number }[]
      const stockMap: Record<string, number> = {}
      const minimos: Record<string, number> = {}
      for (const p of productos) minimos[p.id] = p.stock_minimo
      for (const m of movimientos) {
        const key = `${m.producto_id}-${m.sede_id}`
        if (!stockMap[key]) stockMap[key] = 0
        stockMap[key] += m.tipo === 'entrada' ? m.cantidad : -m.cantidad
      }
      let alertCount = 0
      for (const [key, qty] of Object.entries(stockMap)) {
        const prodId = key.split('-')[0]
        if (qty <= (minimos[prodId] ?? 0)) alertCount++
      }
      setStockBajo(alertCount)

      setLabPendientes(labRes.count || 0)
      setGastosVencenHoy(gastosHoyRes.count || 0)

      // Chart: bucketizar por día si el rango es corto, por mes si es largo
      setChartData(buildChartData(cobData, gasData, inicio, fin, cobMonto, gasMonto))
    } catch (err) {
      console.error('Error fetching dashboard:', err)
      setFetchError('Error al cargar el dashboard. Intentá recargar la página.')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoy, sedeFilter, inicio, fin])

  useEffect(() => { fetchSedes() }, [fetchSedes])
  useEffect(() => { fetchDashboardData() }, [fetchDashboardData])

  const formatMoney = (n: number) => {
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })
  }

  const resultado = cobradoRango - gastosRango

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Dashboard</h1>
          <p className="text-sm text-text-secondary capitalize hidden sm:block">{formatFechaHoyAR()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={sedeFilter}
          onChange={(e) => setSedeFilter(e.target.value)}
          className="text-sm border border-border rounded-lg px-2 py-1.5 bg-surface text-text-primary focus:outline-none focus:border-green-primary"
        >
          <option value="todas">Todas las sedes</option>
          {sedes.map(s => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>

        <RangoSelector
          rango={rango}
          setRango={setRango}
          customInicio={customInicio}
          setCustomInicio={setCustomInicio}
          customFin={customFin}
          setCustomFin={setCustomFin}
        />

        <span className="text-xs text-text-muted ml-auto">Período: <span className="font-medium text-text-secondary">{label}</span></span>
      </div>

      {fetchError && (
        <div className="bg-red-light rounded-lg border border-red/20 px-4 py-3 mb-4 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red shrink-0" />
          <p className="text-sm text-red">{fetchError}</p>
          <button onClick={() => fetchDashboardData()} className="ml-auto text-sm text-green-primary hover:text-green-dark font-medium whitespace-nowrap">
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-text-muted py-12 text-sm">Cargando dashboard...</div>
      ) : (
        <>
          {/* Row 1 — Financieros del rango */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KPICard
              icon={<DollarSign size={20} />}
              label={`Cobrado · ${label}`}
              value={formatMoney(cobradoRango)}
              color="green"
            />
            <KPICard
              icon={<TrendingDown size={20} />}
              label={`Gastos pagados · ${label}`}
              value={formatMoney(gastosRango)}
              color="red"
            />
            <KPICard
              icon={<TrendingUp size={20} />}
              label={`Resultado · ${label}`}
              value={formatMoney(resultado)}
              color={resultado >= 0 ? 'green' : 'red'}
            />
            <KPICard
              icon={<Clock size={20} />}
              label="Por cobrar"
              value={formatMoney(deudasPendientes)}
              subtitle="Deudas activas"
              color="gold"
            />
          </div>

          {/* Row 2 — Turnos de hoy */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KPICard
              icon={<CalendarDays size={20} />}
              label="Turnos hoy"
              value={turnoStats.total.toString()}
              subtitle={`${turnoStats.agendados} pendientes`}
              color="blue"
            />
            <KPICard
              icon={<XCircle size={20} />}
              label="No-shows hoy"
              value={turnoStats.noShows.toString()}
              color="red"
            />
            <KPICard
              icon={<TrendingUp size={20} />}
              label="Tasa de show · hoy"
              value={`${turnoStats.tasaShow}%`}
              subtitle={`${turnoStats.atendidos} atendidos / ${turnoStats.noShows} no-shows`}
              color={turnoStats.tasaShow >= 80 ? 'green' : turnoStats.tasaShow >= 60 ? 'amber' : 'red'}
            />
            <KPICard
              icon={<AlertTriangle size={20} />}
              label="Gastos vencen hoy"
              value={gastosVencenHoy.toString()}
              subtitle={gastosVencenHoy > 0 ? 'Vencimientos pendientes' : 'Sin vencimientos'}
              color={gastosVencenHoy > 0 ? 'red' : 'green'}
            />
          </div>

          {/* Row 3 — Operativo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KPICard
              icon={<CalendarPlus size={20} />}
              label="Turnos dados hoy"
              value={turnosDadosHoy.toString()}
              subtitle="Cargados hoy"
              color="blue"
            />
            <KPICard
              icon={<Package size={20} />}
              label="Stock bajo"
              value={stockBajo.toString()}
              subtitle={stockBajo > 0 ? 'Productos a reponer' : 'Todo OK'}
              color={stockBajo > 0 ? 'red' : 'green'}
            />
            <KPICard
              icon={<Crown size={20} />}
              label="Lab en proceso"
              value={labPendientes.toString()}
              subtitle="Casos activos"
              color={labPendientes > 0 ? 'amber' : 'green'}
            />
            <KPICard
              icon={<CheckSquare size={20} />}
              label="Sedes activas"
              value={sedes.length.toString()}
              subtitle="Operando"
              color="purple"
            />
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="bg-surface rounded-xl border border-border p-5 mb-6">
              <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-text-muted" />
                Cobranzas vs Gastos · {label}
              </h2>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={2}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} width={40} />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Bar dataKey="cobrado" name="Cobrado" fill="#4a7c59" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="gastos" name="Gastos" fill="#dc2626" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-2 justify-center">
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <div className="w-3 h-3 rounded-sm bg-[#4a7c59]" /> Cobrado
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <div className="w-3 h-3 rounded-sm bg-[#dc2626]" /> Gastos
                </div>
              </div>
            </div>
          )}

          {/* Turnos por sede */}
          {sedeFilter === 'todas' && turnosPorSede.length > 0 && (
            <div className="bg-surface rounded-xl border border-border p-5 mb-6">
              <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Building2 size={16} className="text-text-muted" />
                Turnos por sede — hoy
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {turnosPorSede.map((s) => {
                  const tasa = (s.atendidos + s.noShows) > 0
                    ? Math.round((s.atendidos / (s.atendidos + s.noShows)) * 100)
                    : 0
                  return (
                    <div key={s.sede_nombre} className="flex items-center justify-between p-3 bg-beige rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{s.sede_nombre}</p>
                        <p className="text-xs text-text-secondary">
                          {s.total} turnos · {s.atendidos} atendidos · {s.noShows} no-shows
                        </p>
                      </div>
                      <div className={`text-lg font-semibold ${tasa >= 80 ? 'text-green-primary' : tasa >= 60 ? 'text-amber' : 'text-red'}`}>
                        {tasa}%
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Range selector ──────────────────────────────────
function RangoSelector({
  rango, setRango, customInicio, setCustomInicio, customFin, setCustomFin,
}: {
  rango: RangoPreset
  setRango: (r: RangoPreset) => void
  customInicio: string
  setCustomInicio: (v: string) => void
  customFin: string
  setCustomFin: (v: string) => void
}) {
  const presets: { id: RangoPreset; label: string }[] = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'semana', label: '7 días' },
    { id: 'mes', label: 'Mes' },
    { id: 'anio', label: 'Año' },
    { id: 'custom', label: 'Rango' },
  ]

  return (
    <>
      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
        {presets.map(p => (
          <button
            key={p.id}
            onClick={() => setRango(p.id)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              rango === p.id
                ? 'bg-green-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-beige'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {rango === 'custom' && (
        <div className="flex items-center gap-1 text-xs">
          <input
            type="date"
            value={customInicio}
            onChange={e => setCustomInicio(e.target.value)}
            className="border border-border rounded-lg px-2 py-1 bg-surface focus:outline-none focus:border-green-primary"
          />
          <span className="text-text-muted">→</span>
          <input
            type="date"
            value={customFin}
            onChange={e => setCustomFin(e.target.value)}
            className="border border-border rounded-lg px-2 py-1 bg-surface focus:outline-none focus:border-green-primary"
          />
        </div>
      )}
    </>
  )
}

function KPICard({ icon, label, value, subtitle, color = 'green' }: {
  icon: React.ReactNode
  label: string
  value: string
  subtitle?: string
  color?: 'green' | 'blue' | 'red' | 'amber' | 'gold' | 'purple'
}) {
  const colorMap = {
    green: { bg: 'bg-green-light', icon: 'text-green-primary', value: 'text-green-primary' },
    blue: { bg: 'bg-blue-light', icon: 'text-blue', value: 'text-blue' },
    red: { bg: 'bg-red-light', icon: 'text-red', value: 'text-red' },
    amber: { bg: 'bg-amber-light', icon: 'text-amber', value: 'text-amber' },
    gold: { bg: 'bg-gold-light', icon: 'text-gold-dark', value: 'text-gold-dark' },
    purple: { bg: 'bg-purple-light', icon: 'text-purple', value: 'text-purple' },
  }

  const c = colorMap[color]

  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
          <span className={c.icon}>{icon}</span>
        </div>
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-xl font-semibold ${c.value}`}>{value}</p>
      {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ── Helpers de rango + chart bucketing ──────────────

function computeRango(preset: RangoPreset, customInicio: string, customFin: string, hoy: string): { inicio: string; fin: string; label: string } {
  const d = getArgentinaDate()
  const y = d.getFullYear()
  const m = d.getMonth()

  switch (preset) {
    case 'hoy':
      return { inicio: hoy, fin: hoy, label: 'hoy' }
    case 'semana': {
      const inicioD = new Date(d)
      inicioD.setDate(d.getDate() - 6)
      return { inicio: inicioD.toISOString().split('T')[0], fin: hoy, label: '7 días' }
    }
    case 'mes': {
      const inicioD = new Date(y, m, 1)
      const finD = new Date(y, m + 1, 0)
      return {
        inicio: inicioD.toISOString().split('T')[0],
        fin: finD.toISOString().split('T')[0],
        label: inicioD.toLocaleDateString('es-AR', { month: 'long' }),
      }
    }
    case 'anio': {
      const inicioD = new Date(y, 0, 1)
      const finD = new Date(y, 11, 31)
      return {
        inicio: inicioD.toISOString().split('T')[0],
        fin: finD.toISOString().split('T')[0],
        label: String(y),
      }
    }
    case 'custom':
      return {
        inicio: customInicio,
        fin: customFin >= customInicio ? customFin : customInicio,
        label: 'rango',
      }
  }
}

function buildChartData(
  cobData: { fecha: string; monto: number; sede_id?: string | null }[],
  gasData: { fecha: string; monto: number; sede_id?: string | null; estado_pago?: string }[],
  inicio: string,
  fin: string,
  cobMonto: (c: { monto: number; sede_id?: string | null }) => number,
  gasMonto: (g: { monto: number; sede_id?: string | null }) => number,
): { label: string; cobrado: number; gastos: number }[] {
  const diffDays = Math.ceil((new Date(fin).getTime() - new Date(inicio).getTime()) / (1000 * 60 * 60 * 24)) + 1
  const bucketByMonth = diffDays > 62

  const buckets: Record<string, { cobrado: number; gastos: number }> = {}

  cobData.forEach(c => {
    const key = bucketByMonth ? c.fecha.slice(0, 7) : c.fecha
    const m = cobMonto(c)
    if (m > 0) {
      if (!buckets[key]) buckets[key] = { cobrado: 0, gastos: 0 }
      buckets[key].cobrado += m
    }
  })
  gasData.forEach(g => {
    const key = bucketByMonth ? g.fecha.slice(0, 7) : g.fecha
    const m = gasMonto(g)
    if (m > 0) {
      if (!buckets[key]) buckets[key] = { cobrado: 0, gastos: 0 }
      buckets[key].gastos += m
    }
  })

  const sortedKeys = Object.keys(buckets).sort()
  return sortedKeys.map(k => ({
    label: bucketByMonth
      ? new Date(k + '-01').toLocaleDateString('es-AR', { month: 'short' })
      : k.split('-')[2],
    cobrado: buckets[k].cobrado,
    gastos: buckets[k].gastos,
  }))
}
