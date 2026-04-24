'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  clinic: { clinic_id: string; clinic_nombre: string; plan_precio: number | null }
  onClose: () => void
  onSaved: () => void
}

export default function RecordPaymentModal({ clinic, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [monto, setMonto] = useState(clinic.plan_precio ? String(clinic.plan_precio) : '')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [concepto, setConcepto] = useState('Suscripción mensual')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const m = Number(monto)
    if (isNaN(m) || m < 0) { setError('Monto inválido'); return }
    if (!concepto.trim()) { setError('Concepto requerido'); return }
    setSaving(true)
    setError(null)
    const res = (await supabase.rpc('sysadmin_record_payment', {
      p_clinic_id: clinic.clinic_id,
      p_monto: m,
      p_fecha: fecha,
      p_concepto: concepto.trim(),
      p_notas: notas.trim() || null,
    })) as { error: { message: string } | null }
    setSaving(false)
    if (res.error) setError(res.error.message)
    else onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl border border-border w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-display text-lg font-semibold text-text-primary">Registrar pago</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Clínica</p>
            <p className="text-sm font-medium text-text-primary">{clinic.clinic_nombre}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Monto (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-green-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-green-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Concepto</label>
            <input
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-green-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Notas <span className="text-text-muted">(opcional)</span></label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg focus:outline-none focus:border-green-primary resize-none"
            />
          </div>

          {error && <p className="text-sm text-red bg-red-light p-2 rounded">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-beige">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-primary text-white rounded-lg text-sm font-medium hover:bg-green-primary/90 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}
