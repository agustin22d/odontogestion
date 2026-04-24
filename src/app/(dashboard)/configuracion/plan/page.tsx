import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlanClient from './PlanClient'

interface RawSub {
  estado: string
  trial_ends_at: string | null
  current_period_end: string | null
  plan: { nombre: string; precio_mensual: number; max_sedes: number; max_users: number }[] | { nombre: string; precio_mensual: number; max_sedes: number; max_users: number } | null
}

export default async function PlanPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data } = await supabase
    .from('clinic_subscriptions')
    .select('estado, trial_ends_at, current_period_end, plan:plans(nombre, precio_mensual, max_sedes, max_users)')
    .eq('clinic_id', user.clinic_id ?? '')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const raw = data as RawSub | null
  const planObj = Array.isArray(raw?.plan) ? raw?.plan[0] ?? null : raw?.plan ?? null
  const subscription = raw
    ? {
        estado: raw.estado,
        trial_ends_at: raw.trial_ends_at,
        current_period_end: raw.current_period_end,
        plan: planObj,
      }
    : null

  return <PlanClient subscription={subscription} />
}
