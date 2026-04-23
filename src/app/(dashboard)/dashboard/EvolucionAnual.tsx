'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface MesData {
  mes: string
  mesNum: number
  actual: number
  anterior: number
  gastosActual: number
  gastosAnterior: number
}

const MES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function EvolucionAnual({ sedeFilter }: { sedeFilter: string }) {
  const supabase = createClient()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [data, setData] = useState<MesData[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'cobranzas' | 'gastos' | 'resultado'>('cobranzas')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const yStart = `${year}-01-01`
    const yEnd = `${year}-12-31`
    const yPrevStart = `${year - 1}-01-01`
    const yPrevEnd = `${year - 1}-12-31`

    let qCobActual = supabase.from('cobranzas').select('fecha, monto').gte('fecha', yStart).lte('fecha', yEnd)
    let qCobAnt = supabase.from('cobranzas').select('fecha, monto').gte('fecha', yPrevStart).lte('fecha', yPrevEnd)
    let qGasActual = supabase.from('gastos').select('fecha, monto, estado_pago').gte('fecha', yStart).lte('fecha', yEnd)
    let qGasAnt = supabase.from('gastos').select('fecha, monto, estado_pago').gte('fecha', yPrevStart).lte('fecha', yPrevEnd)
    if (sedeFilter !== 'todas') {
      qCobActual = qCobActual.eq('sede_id', sedeFilter)
      qCobAnt = qCobAnt.eq('sede_id', sedeFilter)
      qGasActual = qGasActual.eq('sede_id', sedeFilter)
      qGasAnt = qGasAnt.eq('sede_id', sedeFilter)
    }

    const [resCob, resCobP, resGas, resGasP] = await Promise.all([qCobActual, qCobAnt, qGasActual, qGasAnt])

    const cobActual = (resCob.data || []) as unknown as { fecha: string; monto: number }[]
    const cobAnterior = (resCobP.data || []) as unknown as { fecha: string; monto: number }[]
    const gasActual = (resGas.data || []) as unknown as { fecha: string; monto: number; estado_pago: string }[]
    const gasAnterior = (resGasP.data || []) as unknown as { fecha: string; monto: number; estado_pago: string }[]

    const meses: MesData[] = MES_LABELS.map((label, idx) => ({
      mes: label, mesNum: idx + 1,
      actual: 0, anterior: 0, gastosActual: 0, gastosAnterior: 0,
    }))

    for (const c of cobActual) {
      const m = parseInt(c.fecha.split('-')[1]) - 1
      if (m >= 0 && m < 12) meses[m].actual += Number(c.monto)
    }
    for (const c of cobAnterior) {
      const m = parseInt(c.fecha.split('-')[1]) - 1
      if (m >= 0 && m < 12) meses[m].anterior += Number(c.monto)
    }
    for (const g of gasActual) {
      if (g.estado_pago !== 'pagado') continue
      const m = parseInt(g.fecha.split('-')[1]) - 1
      if (m >= 0 && m < 12) meses[m].gastosActual += Number(g.monto)
    }
    for (const g of gasAnterior) {
      if (g.estado_pago !== 'pagado') continue
      const m = parseInt(g.fecha.split('-')[1]) - 1
      if (m >= 0 && m < 12) meses[m].gastosAnterior += Number(g.monto)
    }

    setData(meses)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, sedeFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const totales = useMemo(() => {
    const t = data.reduce(
      (acc, m) => ({
        actual: acc.actual + m.actual,
        anterior: acc.anterior + m.anterior,
        gastosActual: acc.gastosActual + m.gastosActual,
        gastosAnterior: acc.gastosAnterior + m.gastosAnterior,
      }),
      { actual: 0, anterior: 0, gastosActual: 0, gastosAnterior: 0 },
    )
    return {
      ...t,
      resultadoActual: t.actual - t.gastosActual,
      resultadoAnterior: t.anterior - t.gastosAnterior,
    }
  }, [data])

  const chartData = useMemo(() => {
    if (view === 'cobranzas') {
      return data.map(m => ({ mes: m.mes, [`${year}`]: m.actual, [`${year - 1}`]: m.anterior }))
    } else if (view === 'gastos') {
      return data.map(m => ({ mes: m.mes, [`${year}`]: m.gastosActual, [`${year - 1}`]: m.gastosAnterior }))
    } else {
      return data.map(m => ({
        mes: m.mes,
        [`${year}`]: m.actual - m.gastosActual,
        [`${year - 1}`]: m.anterior - m.gastosAnterior,
      }))
    }
  }, [data, view, year])

  const totalActualView = view === 'cobranzas' ? totales.actual : view === 'gastos' ? totales.gastosActual : totales.resultadoActual
  const totalAnteriorView = view === 'cobranzas' ? totales.anterior : view === 'gastos' ? totales.gastosAnterior : totales.resultadoAnterior
  const delta = totalAnteriorView !== 0 ? Math.round(((totalActualView - totalAnteriorView) / Math.abs(totalAnteriorView)) * 100) : 0

  const formatMoney = (n: number) =>
    n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })

  return (
    <div className="bg-surface rounded-xl border border-border p-5 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <TrendingUp size={16} className="text-text-muted" />
          Evolución anual — comparación {year} vs {year - 1}
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-beige border border-border rounded-lg px-1.5 py-1">
            <button onClick={() => setYear(y => y - 1)} className="p-0.5 hover:bg-white rounded">
              <ChevronLeft size={14} className="text-text-secondary" />
            </button>
            <span className="text-xs font-medium text-text-primary px-2">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-0.5 hover:bg-white rounded">
              <ChevronRight size={14} className="text-text-secondary" />
            </button>
          </div>
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
            {(['cobranzas', 'gastos', 'resultado'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors capitalize ${view === v ? 'bg-green-primary text-white' : 'text-text-secondary hover:text-text-primary'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 bg-beige rounded-lg">
          <p className="text-[10px] uppercase tracking-wide text-text-muted">Total {year}</p>
          <p className="text-lg font-semibold text-text-primary">{formatMoney(totalActualView)}</p>
        </div>
        <div className="p-3 bg-beige rounded-lg">
          <p className="text-[10px] uppercase tracking-wide text-text-muted">Total {year - 1}</p>
          <p className="text-lg font-semibold text-text-secondary">{formatMoney(totalAnteriorView)}</p>
        </div>
        <div className="p-3 bg-beige rounded-lg">
          <p className="text-[10px] uppercase tracking-wide text-text-muted">Δ vs año anterior</p>
          <p className={`text-lg font-semibold flex items-center gap-1 ${delta > 0 ? 'text-green-primary' : delta < 0 ? 'text-red' : 'text-text-secondary'}`}>
            {delta > 0 ? <TrendingUp size={16} /> : delta < 0 ? <TrendingDown size={16} /> : null}
            {delta > 0 ? '+' : ''}{delta}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[280px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-text-muted text-sm">Cargando...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={70}
                tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
                formatter={(value) => formatMoney(Number(value))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey={`${year}`} stroke="var(--color-green-primary, #0ea5e9)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey={`${year - 1}`} stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
