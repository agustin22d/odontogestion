'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface PlanRow { id: string; nombre: string; precio: number; max_sedes: number; max_users: number }

interface Props {
  clinic: { clinic_id: string; clinic_nombre: string; plan_id: string | null; estado: string | null; current_period_end: string | null }
  onClose: () => void
  onSaved: () => void
}

export default function ChangePlanModal({ clinic, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [planId, setPlanId] = useState(clinic.plan_id ?? '')
  const [estado, setEstado] = useState(clinic.estado ?? 'active')
  const [periodEnd, setPeriodEnd] = useState(
    clinic.current_period_end ? clinic.current_period_end.slice(0, 10) : ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('sysadmin_plans_list').then((res: { data: unknown; error: unknown }) => {
      if (!res.error && res.data) setPlans(res.data as PlanRow[])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    if (!planId) { setError('Elegí un plan'); return }
    setSaving(true)
    setError(null)
    const res = (await supabase.rpc('sysadmin_change_subscription', {
      p_clinic_id: clinic.clinic_id,
      p_plan_id: planId,
      p_estado: estado,
      p_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
    })) as { error: { message: string } | null }
    setSaving(false)
    if (res.error) setError(res.error.message)
    else onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl border border-border w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display text-lg font-semibold text-text-primary">Cambiar plan</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Clínica</p>
            <p className="text-sm font-medium text-text-primary">{clinic.clinic_nombre}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Plan</label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-green-primary"
            >
              <option value="">— Elegir plan —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} · USD {p.precio} · {p.max_sedes} sedes / {p.max_users} users</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-green-primary"
            >
              <option value="trialing">Trial</option>
              <option value="active">Activa</option>
              <option value="past_due">Vencida</option>
              <option value="canceled">Cancelada</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Próximo vencimiento <span className="text-text-muted">(opcional)</span>
            </label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-green-primary"
            />
          </div>

          {error && <p className="text-sm text-red bg-red-light p-2 rounded">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-beige">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-primary/90 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
