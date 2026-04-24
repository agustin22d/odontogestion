import Link from 'next/link'
import { Sparkles, ArrowRight, CalendarDays, Wallet, Package, FlaskConical, Users } from 'lucide-react'

export const metadata = {
  title: 'Demo · OdontoGestión',
  description: 'Probá OdontoGestión con datos reales de demostración. Acceso libre sin compromiso.',
}

const FEATURES = [
  { icon: <CalendarDays size={20} />, label: 'Agenda con bloqueos y profesionales' },
  { icon: <Wallet size={20} />, label: 'Cobranzas, gastos, por cobrar y reportes' },
  { icon: <Package size={20} />, label: 'Stock con alertas y pedido de reposición' },
  { icon: <FlaskConical size={20} />, label: 'Laboratorio con historial de estados' },
  { icon: <Users size={20} />, label: 'Pacientes con historial unificado' },
]

export default function DemoLanding() {
  const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL || ''
  const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD || ''

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-surface rounded-2xl border border-border p-8 md:p-12 shadow-sm">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-medium uppercase tracking-wider rounded-full mb-4">
            <Sparkles size={12} /> Modo demo
          </div>

          <h1 className="font-display text-3xl md:text-4xl font-semibold text-text-primary mb-3">
            Probá OdontoGestión sin compromiso
          </h1>
          <p className="text-text-secondary mb-6">
            Una clínica completa, ya cargada con datos reales de muestra. Mirá cómo se ve la agenda, las cobranzas, el stock, el laboratorio y los reportes — sin tener que registrarte.
          </p>

          <ul className="space-y-2.5 mb-8">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex items-center gap-3 text-sm text-text-primary">
                <span className="text-green-primary shrink-0">{f.icon}</span>
                {f.label}
              </li>
            ))}
          </ul>

          {demoEmail && demoPassword ? (
            <>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-3 bg-green-primary hover:bg-green-primary/90 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Entrar a la demo
                <ArrowRight size={16} />
              </Link>
              <p className="text-xs text-text-muted mt-3">
                Las credenciales aparecen pre-cargadas en la pantalla de login. Podés tocar cualquier cosa, los datos se resetean automáticamente.
              </p>
            </>
          ) : (
            <p className="text-sm text-text-muted">
              La demo todavía no fue activada en este entorno (faltan vars <code className="bg-beige px-1.5 py-0.5 rounded text-[11px]">NEXT_PUBLIC_DEMO_EMAIL</code> y <code className="bg-beige px-1.5 py-0.5 rounded text-[11px]">NEXT_PUBLIC_DEMO_PASSWORD</code>).
            </p>
          )}

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-xs text-text-muted">
              ¿Querés tu propia clínica?{' '}
              <Link href="/signup" className="text-green-primary hover:underline">
                Crear cuenta gratis (14 días)
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
