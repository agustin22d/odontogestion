'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building2, Search, Filter, ShieldCheck, LogOut, ChevronDown, ChevronRight, RefreshCcw } from 'lucide-react'
import ChangePlanModal from './ChangePlanModal'
import RecordPaymentModal from './RecordPaymentModal'
import ResetPasswordModal from './ResetPasswordModal'
import PaymentsList from './PaymentsList'

interface ClinicRow {
  clinic_id: string
  clinic_nombre: string
  clinic_slug: string
  clinic_creada: string
  plan_id: string | null
  plan_nombre: string | null
  plan_precio: number | null
  estado: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  ultimo_pago_fecha: string | null
  ultimo_pago_monto: number | null
  total_pagado_anio: number
  total_users: number
  total_sedes: number
}

const USD = (n: number | null) => (n == null ? '—' : `USD ${Number(n).toLocaleString('en-US')}`)

const ESTADO_CHIP: Record<string, string> = {
  trialing: 'bg-amber-100 text-amber-700',
  active: 'bg-green-light text-green-primary',
  past_due: 'bg-red-light text-red',
  canceled: 'bg-gray-100 text-gray-600',
}

export default function SysadminClient() {
  const supabase = createClient()
  const [rows, setRows] = useState<ClinicRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<string>('todas')
  const [expandida, setExpandida] = useState<string | null>(null)

  const [modalCambioPlan, setModalCambioPlan] = useState<ClinicRow | null>(null)
  const [modalPago, setModalPago] = useState<ClinicRow | null>(null)
  const [modalReset, setModalReset] = useState<ClinicRow | null>(null)

  const fetchClinicas = useCallback(async () => {
    setLoading(true)
    const res = (await supabase.rpc('sysadmin_clinics_overview')) as { data: unknown; error: { message: string } | null }
    if (res.error) {
      alert('Error al cargar: ' + res.error.message)
      setRows([])
    } else {
      setRows((res.data ?? []) as ClinicRow[])
    }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchClinicas() }, [fetchClinicas])

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    window.location.href = '/login'
  }

  const filtradas = rows.filter(r => {
    if (estadoFiltro !== 'todas' && r.estado !== estadoFiltro) return false
    if (search.trim() && !r.clinic_nombre.toLowerCase().includes(search.toLowerCase()) && !r.clinic_slug.includes(search.toLowerCase())) return false
    return true
  })

  const totalActivas = rows.filter(r => r.estado === 'active').length
  const totalTrial = rows.filter(r => r.estado === 'trialing').length
  const totalRevenue = rows.reduce((s, r) => s + Number(r.total_pagado_anio || 0), 0)

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="bg-surface border-b border-border sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-green-primary" />
            <span className="text-sm font-semibold tracking-wider uppercase text-text-primary">Super-admin</span>
            <span className="text-text-muted text-xs hidden sm:inline">·</span>
            <span className="hidden sm:inline text-xs text-text-secondary">OdontoGestión</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchClinicas} className="p-2 text-text-muted hover:text-text-primary" title="Refrescar">
              <RefreshCcw size={16} />
            </button>
            <button onClick={handleLogout} className="text-xs text-text-secondary hover:text-red flex items-center gap-1.5 px-2 py-1">
              <LogOut size={14} /> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KPI label="Clínicas totales" value={rows.length.toString()} icon={<Building2 size={16} />} />
          <KPI label="Activas" value={totalActivas.toString()} chip="bg-green-light text-green-primary" />
          <KPI label="Trial" value={totalTrial.toString()} chip="bg-amber-100 text-amber-700" />
          <KPI label="Cobrado en el año" value={USD(totalRevenue)} />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Buscar por nombre o slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-surface focus:outline-none focus:border-green-primary"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2">
            <Filter size={14} className="text-text-muted" />
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="bg-transparent text-sm py-2 focus:outline-none"
            >
              <option value="todas">Todos los estados</option>
              <option value="trialing">Trial</option>
              <option value="active">Activas</option>
              <option value="past_due">Vencidas</option>
              <option value="canceled">Canceladas</option>
            </select>
          </div>
          <span className="text-xs text-text-muted ml-auto">{filtradas.length} de {rows.length}</span>
        </div>

        {/* Tabla */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-beige/50">
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider font-medium text-text-secondary">Clínica</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider font-medium text-text-secondary hidden md:table-cell">Plan</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider font-medium text-text-secondary">Estado</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider font-medium text-text-secondary hidden lg:table-cell">Vence</th>
                  <th className="text-right px-4 py-3 text-xs uppercase tracking-wider font-medium text-text-secondary hidden md:table-cell">Cobrado año</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-sm text-text-muted">Cargando...</td></tr>
                ) : filtradas.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-sm text-text-muted">Sin clínicas que coincidan.</td></tr>
                ) : (
                  filtradas.map((c) => {
                    const isOpen = expandida === c.clinic_id
                    const venceDate = c.current_period_end ?? c.trial_ends_at
                    const venceStr = venceDate ? new Date(venceDate).toLocaleDateString('es-AR') : '—'
                    const venceVencido = venceDate ? new Date(venceDate) < new Date() : false
                    return (
                      <>
                        <tr key={c.clinic_id} className={`border-b border-border last:border-b-0 ${isOpen ? 'bg-beige/30' : 'hover:bg-beige/20'}`}>
                          <td className="px-4 py-3">
                            <button onClick={() => setExpandida(isOpen ? null : c.clinic_id)} className="flex items-center gap-2 text-left">
                              {isOpen ? <ChevronDown size={14} className="text-text-muted shrink-0" /> : <ChevronRight size={14} className="text-text-muted shrink-0" />}
                              <div>
                                <div className="font-medium text-text-primary">{c.clinic_nombre}</div>
                                <div className="text-xs text-text-muted">{c.clinic_slug} · {c.total_sedes} sedes · {c.total_users} users</div>
                              </div>
                            </button>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="font-medium text-text-primary">{c.plan_nombre ?? 'Sin plan'}</div>
                            <div className="text-xs text-text-muted">{USD(c.plan_precio)} / mes</div>
                          </td>
                          <td className="px-4 py-3">
                            {c.estado ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_CHIP[c.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                                {c.estado}
                              </span>
                            ) : <span className="text-xs text-text-muted">—</span>}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-sm">
                            <span className={venceVencido ? 'text-red font-medium' : 'text-text-secondary'}>{venceStr}</span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-right text-sm text-text-primary">
                            {USD(c.total_pagado_anio)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button onClick={() => setModalCambioPlan(c)} className="text-xs px-2 py-1 text-green-primary hover:bg-green-light rounded">Plan</button>
                            <button onClick={() => setModalPago(c)} className="text-xs px-2 py-1 text-green-primary hover:bg-green-light rounded ml-1">Pago</button>
                            <button onClick={() => setModalReset(c)} className="text-xs px-2 py-1 text-text-secondary hover:bg-beige rounded ml-1">Pwd</button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-beige/30 border-b border-border">
                            <td colSpan={6} className="px-4 py-4">
                              <PaymentsList clinicId={c.clinic_id} />
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {modalCambioPlan && (
        <ChangePlanModal
          clinic={modalCambioPlan}
          onClose={() => setModalCambioPlan(null)}
          onSaved={() => { setModalCambioPlan(null); fetchClinicas() }}
        />
      )}
      {modalPago && (
        <RecordPaymentModal
          clinic={modalPago}
          onClose={() => setModalPago(null)}
          onSaved={() => { setModalPago(null); fetchClinicas() }}
        />
      )}
      {modalReset && (
        <ResetPasswordModal
          clinic={modalReset}
          onClose={() => setModalReset(null)}
        />
      )}
    </div>
  )
}

function KPI({ label, value, icon, chip }: { label: string; value: string; icon?: React.ReactNode; chip?: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted font-medium mb-1">
        {icon}
        {label}
      </div>
      <div className="flex items-center gap-2">
        <p className="text-xl font-semibold text-text-primary">{value}</p>
        {chip && <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${chip}`}>•</span>}
      </div>
    </div>
  )
}
