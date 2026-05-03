'use client'

import { Sparkles, CheckCircle2, Clock } from 'lucide-react'

interface SubscriptionData {
  estado: string
  trial_ends_at: string | null
  current_period_end: string | null
  plan: { nombre: string; max_sedes: number; max_users: number; precio_mensual?: number } | null
}

export default function PlanClient({ subscription }: { subscription: SubscriptionData | null }) {
  const planActual = subscription?.plan?.nombre ?? 'Sin suscripción'
  const estado = subscription?.estado ?? null
  const trialEnd = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000)) : null

  const isPro = planActual.toLowerCase() === 'pro'

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-text-primary mb-1">Plan y suscripción</h1>
        <p className="text-sm text-text-secondary">Tu plan actual y opciones disponibles.</p>
      </div>

      {/* Estado actual */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-1">Plan actual</p>
            <h2 className="font-display text-xl font-semibold text-text-primary">{planActual}</h2>
            {subscription?.plan && (
              <p className="text-sm text-text-secondary mt-1">
                Hasta {subscription.plan.max_sedes} sedes · hasta {subscription.plan.max_users} usuarios
              </p>
            )}
          </div>
          <div>
            {estado === 'trialing' && trialDaysLeft !== null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                <Sparkles size={12} /> Trial · {trialDaysLeft} día{trialDaysLeft !== 1 ? 's' : ''} restante{trialDaysLeft !== 1 ? 's' : ''}
              </span>
            )}
            {estado === 'active' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-light text-green-primary text-xs font-medium rounded-full">
                <CheckCircle2 size={12} /> Activo
              </span>
            )}
            {(estado === 'past_due' || estado === 'canceled') && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-light text-red text-xs font-medium rounded-full">
                <Clock size={12} /> {estado === 'past_due' ? 'Vencido' : 'Cancelado'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* CTA de cambio */}
      <div className={`rounded-xl border p-6 ${isPro ? 'bg-green-light/30 border-green-primary/30' : 'bg-surface border-border'}`}>
        {isPro ? (
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="text-green-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-text-primary">Tenés el plan Pro activo</p>
              <p className="text-sm text-text-secondary mt-1">Tenés acceso a todas las funciones de la plataforma.</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-2">Plan Pro disponible</p>
            <p className="font-semibold text-text-primary mb-1">Accedé a todas las funciones</p>
            <p className="text-sm text-text-secondary mb-4">
              Con el plan Pro habilitás Finanzas, Laboratorio, White-label, reportes avanzados y más.
              Contactanos y lo activamos en menos de 24 horas hábiles.
            </p>
            <a
              href="mailto:info@didigitalstudio.com?subject=Solicitud%20plan%20Pro%20-%20Odontogestion"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-primary text-white rounded-lg text-sm font-semibold hover:bg-green-primary/90 transition"
            >
              Contactar a DI Digital Studio
            </a>
          </div>
        )}
      </div>

      <p className="text-xs text-text-muted">
        Los cambios de plan se activan manualmente. Escribinos a{' '}
        <a href="mailto:info@didigitalstudio.com" className="text-green-primary hover:underline">
          info@didigitalstudio.com
        </a>{' '}
        y lo gestionamos en menos de 24 horas hábiles.
      </p>
    </div>
  )
}
