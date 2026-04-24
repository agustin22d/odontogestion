import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  CalendarDays,
  Wallet,
  Package,
  FlaskConical,
  Users,
  LayoutDashboard,
  Settings,
  ArrowRight,
  Check,
  Mail,
  Globe,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { PLAN_TIERS } from '@/lib/plan'

export const metadata = {
  title: 'OdontoGestión · Software de gestión integral para clínicas dentales',
  description: 'Plataforma web que centraliza turnos, agenda, finanzas, stock, laboratorio y pacientes. Multi-sede, multi-usuario, con white-label.',
}

const MODULOS = [
  { icon: <LayoutDashboard size={22} />, titulo: 'Dashboard ejecutivo', desc: 'KPIs en tiempo real: cobranzas, gastos, resultado, turnos del día y tasa de show. Comparación año-vs-año.' },
  { icon: <CalendarDays size={22} />, titulo: 'Agenda y turnos', desc: 'Vista de grilla por hora con columnas por profesional. Bloqueos puntuales y semanales. Estados completos y reprogramaciones.' },
  { icon: <Wallet size={22} />, titulo: 'Finanzas', desc: 'Cobranzas, gastos por categoría, deudas con plan de cuotas. Aplicación de pagos al saldo en un click. Export CSV.' },
  { icon: <Package size={22} />, titulo: 'Stock', desc: 'Inventario por movimientos con alertas de stock bajo y generador de pedido de reposición vía WhatsApp o portapapeles.' },
  { icon: <FlaskConical size={22} />, titulo: 'Laboratorio', desc: 'Trazabilidad de casos por estado: escaneado, enviado, en proceso, retirado, colocado. Historial completo de cambios.' },
  { icon: <Users size={22} />, titulo: 'Pacientes', desc: 'Ficha unificada con historial cruzado de turnos, cobranzas y casos de laboratorio. Búsqueda por nombre, DNI o teléfono.' },
  { icon: <Settings size={22} />, titulo: 'Equipo y permisos', desc: 'Invitaciones por email, roles personalizados con permisos granulares. White-label: tu logo y colores.' },
]

const POR_QUE = [
  { titulo: 'Multi-sede de verdad', desc: 'Cada cobranza, gasto, turno y stock se registra por sede. Filtros y reportes por sede o consolidados.' },
  { titulo: 'Aislamiento por clínica', desc: 'Tus datos no se mezclan con otros clientes. Row-level security en Postgres con clinic_id en cada fila.' },
  { titulo: 'Sin contratos largos', desc: 'Pagás mes a mes. Bajás cuando quieras. 14 días de prueba gratis al registrarte.' },
  { titulo: 'Onboarding guiado', desc: 'Te acompañamos en la configuración inicial. 10 a 30 hs de soporte el primer mes según tu plan.' },
]

export default async function HomePage() {
  // Si está logueado va directo al dashboard. Sino renderiza landing.
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect('/dashboard')
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest?: string }).digest === 'string' && (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')) {
      throw err
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Top nav */}
      <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-primary" />
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-text-primary">Odonto</span>
            <span className="text-text-muted text-[11px]">|</span>
            <span className="text-[10px] text-text-secondary">Gestión</span>
          </div>
          <nav className="flex items-center gap-2 md:gap-4 text-sm">
            <a href="#planes" className="hidden sm:inline text-text-secondary hover:text-text-primary">Planes</a>
            <a href="#contacto" className="hidden sm:inline text-text-secondary hover:text-text-primary">Contacto</a>
            <Link href="/login" className="text-text-secondary hover:text-text-primary px-2 py-1">Login</Link>
            <Link href="/demo" className="bg-green-primary text-white px-3 py-1.5 rounded-lg font-medium hover:bg-green-primary/90 transition-colors text-xs sm:text-sm">
              Probar demo
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 pt-12 md:pt-20 pb-12 md:pb-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-light text-green-primary text-xs font-medium rounded-full mb-5">
            <Sparkles size={12} /> Software de gestión odontológica
          </div>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold text-text-primary leading-tight mb-5">
            Tu clínica dental, <span className="text-green-primary">bajo control total</span>.
          </h1>
          <p className="text-lg text-text-secondary mb-8 max-w-2xl">
            Una plataforma web que centraliza turnos, finanzas, stock, laboratorio y pacientes. Accedé desde cualquier dispositivo. Multi-sede y multi-usuario.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-5 py-3 bg-green-primary hover:bg-green-primary/90 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Probar la demo <ArrowRight size={16} />
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-5 py-3 bg-surface border border-border hover:bg-beige text-text-primary rounded-lg text-sm font-medium transition-colors"
            >
              Crear cuenta gratis · 14 días
            </Link>
          </div>
          <p className="text-xs text-text-muted mt-3">Sin tarjeta de crédito. Sin compromiso.</p>
        </div>
      </section>

      {/* Módulos */}
      <section className="bg-surface border-y border-border py-14 md:py-20">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-text-primary mb-3">Todo lo que tu clínica necesita</h2>
            <p className="text-text-secondary max-w-2xl mx-auto">Siete módulos integrados con datos compartidos. Sin Excel paralelo. Sin doble carga.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULOS.map((m) => (
              <div key={m.titulo} className="bg-bg rounded-xl border border-border p-5">
                <div className="bg-green-light text-green-primary rounded-lg w-10 h-10 flex items-center justify-center mb-3">
                  {m.icon}
                </div>
                <h3 className="font-semibold text-text-primary mb-1.5">{m.titulo}</h3>
                <p className="text-sm text-text-secondary">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Por qué */}
      <section className="py-14 md:py-20">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-text-primary text-center mb-10 md:mb-14">¿Por qué OdontoGestión?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {POR_QUE.map((p) => (
              <div key={p.titulo} className="bg-surface rounded-xl border border-border p-5">
                <ShieldCheck size={20} className="text-green-primary mb-3" />
                <h3 className="font-semibold text-text-primary mb-1.5">{p.titulo}</h3>
                <p className="text-sm text-text-secondary">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="bg-surface border-y border-border py-14 md:py-20">
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-text-primary mb-3">Planes simples</h2>
            <p className="text-text-secondary">Pagás mes a mes. 14 días de prueba sin tarjeta de crédito.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {PLAN_TIERS.map((plan) => {
              const isPro = plan.nombre === 'Pro'
              return (
                <div
                  key={plan.nombre}
                  className={`bg-bg rounded-xl border p-6 flex flex-col ${isPro ? 'border-green-primary shadow-md' : 'border-border'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-display text-2xl font-semibold text-text-primary">{plan.nombre}</h3>
                    {isPro && (
                      <span className="text-[10px] uppercase tracking-wider font-semibold bg-green-light text-green-primary px-2 py-0.5 rounded">Recomendado</span>
                    )}
                  </div>
                  <p className="text-3xl font-semibold text-text-primary mb-1">
                    USD {plan.precio_usd}
                    <span className="text-sm font-normal text-text-muted"> / mes</span>
                  </p>
                  <p className="text-xs text-text-muted mb-1">Hasta {plan.max_sedes} sedes · {plan.max_users} usuarios</p>
                  <p className="text-xs text-text-muted mb-5">
                    <span className="font-medium text-text-secondary">{plan.horas_soporte} hs</span> de configuración y soporte el primer mes
                  </p>

                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.incluye.map((linea) => (
                      <li key={linea} className="flex items-start gap-2 text-sm text-text-primary">
                        <Check size={16} className="text-green-primary shrink-0 mt-0.5" />
                        <span>{linea}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/signup"
                    className={`block text-center px-4 py-2.5 rounded-lg text-sm font-medium transition
                      ${isPro
                        ? 'bg-green-primary text-white hover:bg-green-primary/90'
                        : 'bg-beige text-text-primary hover:bg-beige/70'
                      }`}
                  >
                    Empezar prueba gratis
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA Demo */}
      <section className="py-14 md:py-20">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <div className="bg-surface rounded-2xl border border-border p-8 md:p-12 text-center">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-text-primary mb-3">
              Mejor que leerlo, probalo
            </h2>
            <p className="text-text-secondary mb-6 max-w-xl mx-auto">
              Una clínica completa, ya cargada con datos reales de muestra. Tocá lo que quieras — los datos se resetean.
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-primary hover:bg-green-primary/90 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Entrar a la demo <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contacto" className="border-t border-border bg-surface py-10">
        <div className="max-w-6xl mx-auto px-4 md:px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-primary" />
              <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-text-primary">Odonto</span>
              <span className="text-text-muted text-[11px]">|</span>
              <span className="text-[10px] text-text-secondary">Gestión</span>
            </div>
            <p className="text-xs text-text-muted">Software de gestión integral para clínicas dentales.</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-2">Contacto</p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-text-muted" />
                <a href="mailto:desa.baires@gmail.com" className="text-text-secondary hover:text-text-primary">desa.baires@gmail.com</a>
              </li>
              <li className="flex items-center gap-2">
                <Globe size={14} className="text-text-muted" />
                <a href="https://didigitalstudio.com" target="_blank" rel="noopener" className="text-text-secondary hover:text-text-primary">didigitalstudio.com</a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-text-muted font-medium mb-2">Producto</p>
            <ul className="space-y-1.5 text-sm">
              <li><Link href="/demo" className="text-text-secondary hover:text-text-primary">Probar la demo</Link></li>
              <li><Link href="/signup" className="text-text-secondary hover:text-text-primary">Crear cuenta gratis</Link></li>
              <li><Link href="/login" className="text-text-secondary hover:text-text-primary">Iniciar sesión</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 md:px-6 mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-muted">
          <p>© {new Date().getFullYear()} OdontoGestión · Todos los derechos reservados</p>
          <p>Hecho por <a href="https://didigitalstudio.com" target="_blank" rel="noopener" className="hover:text-text-primary">DI Digital Studio</a></p>
        </div>
      </footer>
    </div>
  )
}
