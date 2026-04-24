'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Payment {
  id: string
  fecha: string
  monto: number
  moneda: string
  concepto: string
  notas: string | null
  created_at: string
}

export default function PaymentsList({ clinicId }: { clinicId: string }) {
  const supabase = createClient()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('sysadmin_clinic_payments', { p_clinic_id: clinicId }).then((res: { data: unknown; error: unknown }) => {
      if (!res.error && res.data) setPayments(res.data as Payment[])
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId])

  if (loading) return <p className="text-sm text-text-muted">Cargando pagos...</p>
  if (payments.length === 0) return <p className="text-sm text-text-muted">Sin pagos registrados.</p>

  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-2">Historial de pagos</p>
      <div className="bg-surface rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-beige/30">
              <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-text-muted font-medium">Fecha</th>
              <th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-text-muted font-medium">Monto</th>
              <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-text-muted font-medium">Concepto</th>
              <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-text-muted font-medium hidden sm:table-cell">Notas</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2 text-text-secondary">{new Date(p.fecha).toLocaleDateString('es-AR')}</td>
                <td className="px-3 py-2 text-right font-medium text-text-primary">{p.moneda} {Number(p.monto).toLocaleString('en-US')}</td>
                <td className="px-3 py-2 text-text-primary">{p.concepto}</td>
                <td className="px-3 py-2 text-text-muted text-xs hidden sm:table-cell">{p.notas ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
