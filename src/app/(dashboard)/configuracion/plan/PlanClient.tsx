'use client'

import { Check, X, Sparkles } from 'lucide-react'
import { PLAN_TIERS } from '@/lib/plan'

interface SubscriptionData {
  estado: string
  trial_ends_at: string | null
  current_period_end: string | null
  plan: { nombre: string; precio_mensual: number; max_sedes: number; max_users: number } | null
}

const ARS = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export default function PlanClient({ subscription }: { subscription: SubscriptionData | null }) {
  const planActual = subscription?.plan?.nombre ?? 'Sin suscripción'
  const estado = subscription?.estado ?? null
  const trialEnd = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000)) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-text-primary mb-1">Plan</h1>
        <p className="text-sm text-text-secondary">Tu suscripción y comparación de planes disponibles.</p>
      </div>

      {/* Estado actual */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-1">Plan actual</p>
            <h2 className="font-display text-xl font-semibold text-text-primary">{planActual}</h2>
            {subscription?.plan && (
              <p className="text-sm text-text-secondary mt-1">
                {ARS(subscription.plan.precio_mensual)} / mes · hasta {subscription.plan.max_sedes} sedes · hasta {subscription.plan.max_users} usuarios
              </p>
            )}
          </div>
          <div className="text-right">
            {estado === 'trialing' && trialDaysLeft !== null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                <Sparkles size={12} /> Trial · {trialDaysLeft} día{trialDaysLeft !== 1 ? 's' : ''} restante{trialDaysLeft !== 1 ? 's' : ''}
              </span>
            )}
            {estado === 'active' && (
              <span className="inline-flex items-center px-3 py-1.5 bg-green-light text-green-primary text-xs font-medium rounded-full">Activo</span>
            )}
            {estado === 'past_due' && (
              <span className="inline-flex items-center px-3 py-1.5 bg-red-light text-red text-xs font-medium rounded-full">Vencido</span>
            )}
            {estado === 'canceled' && (
              <span className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">Cancelado</span>
            )}
          </div>
        </div>
      </div>

      {/* Comparador */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PLAN_TIERS.map((plan) => {
          const isCurrent = plan.nombre === planActual
          const isPro = plan.nombre === 'Pro'
          return (
            <div
              key={plan.nombre}
              className={`bg-surface rounded-xl border p-6 flex flex-col ${isPro ? 'border-green-primary shadow-md' : 'border-border'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display text-xl font-semibold text-text-primary">{plan.nombre}</h3>
                {isPro && (
                  <span className="text-[10px] uppercase tracking-wider font-semibold bg-green-light text-green-primary px-2 py-0.5 rounded">
                    Recomendado
                  </span>
                )}
                {isCurrent && (
                  <span className="text-[10px] uppercase tracking-wider font-semibold bg-beige text-text-secondary px-2 py-0.5 rounded">
                    Actual
                  </span>
                )}
              </div>
              <p className="text-2xl font-semibold text-text-primary mb-1">
                {ARS(plan.precio)}
                <span className="text-sm font-normal text-text-muted"> / mes</span>
              </p>
              <p className="text-xs text-text-muted mb-4">
                Hasta {plan.max_sedes} sede{plan.max_sedes !== 1 ? 's' : ''} y {plan.max_users} usuarios
              </p>

              <ul className="space-y-2 mb-4 flex-1">
                {plan.incluye.map((linea) => (
                  <li key={linea} className="flex items-start gap-2 text-sm text-text-primary">
                    <Check size={16} className="text-green-primary shrink-0 mt-0.5" />
                    <span>{linea}</span>
                  </li>
                ))}
                {plan.no_incluye.map((linea) => (
                  <li key={linea} className="flex items-start gap-2 text-sm text-text-muted">
                    <X size={16} className="text-text-muted shrink-0 mt-0.5" />
                    <span className="line-through">{linea}</span>
                  </li>
                ))}
              </ul>

              {!isCurrent && (
                <a
                  href="mailto:soporte@odontogestion.com?subject=Quiero%20cambiar%20mi%20plan"
                  className={`block text-center px-4 py-2.5 rounded-lg text-sm font-medium transition
                    ${isPro
                      ? 'bg-green-primary text-white hover:bg-green-primary/90'
                      : 'bg-beige text-text-primary hover:bg-beige/70'
                    }`}
                >
                  {isPro ? 'Pasar a Pro' : 'Cambiar a Starter'}
                </a>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-text-muted text-center">
        Los cambios de plan se procesan manualmente por ahora. Escribinos a soporte@odontogestion.com y activamos el cambio en menos de 24 horas hábiles.
      </p>
    </div>
  )
}
