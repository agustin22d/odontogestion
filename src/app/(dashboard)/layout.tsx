import { getCurrentUser, signOut } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AuthProvider } from '@/components/AuthProvider'
import Sidebar from '@/components/Sidebar'
import { AccountBlocked } from '@/components/AccountBlocked'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user = null
  try {
    user = await getCurrentUser()
  } catch (err) {
    console.error('[layout] getCurrentUser falló:', err)
  }

  if (!user) {
    // Clear stale session to prevent redirect loop with middleware
    try { await signOut() } catch { /* noop */ }
    redirect('/login')
  }

  // White-label: cargar los colores + logo de la clínica.
  // Si no hay clinic_id o falla la query, cae al default (NO romper el layout).
  let colorPrimario = '#0ea5e9'
  let colorAcento = '#0284c7'
  let logoUrl: string | null = null
  let onboarded = true // default true: si la columna no existe (mig 6 no aplicada), no forzamos wizard
  if (user.clinic_id) {
    try {
      const supabase = await createClient()
      const { data } = await supabase
        .from('clinic_settings')
        .select('color_primario, color_acento, logo_url, onboarded')
        .eq('clinic_id', user.clinic_id)
        .maybeSingle()
      if (data) {
        const settings = data as unknown as { color_primario: string; color_acento: string; logo_url: string | null; onboarded?: boolean }
        colorPrimario = settings.color_primario
        colorAcento = settings.color_acento
        logoUrl = settings.logo_url
        if (settings.onboarded === false) onboarded = false
      }
    } catch (err) {
      console.error('[layout] clinic_settings query falló:', err)
    }
  }

  // Clínica recién creada que aún no completó el wizard → forzar onboarding.
  if (!onboarded) redirect('/onboarding')

  // Gate de aprobación: verificar si la clínica está aprobada y la suscripción no está pausada.
  if (user.clinic_id) {
    try {
      const supabase = await createClient()
      const { data: clinicData } = await supabase
        .from('clinics')
        .select('aprobada')
        .eq('id', user.clinic_id)
        .maybeSingle()

      if (clinicData && clinicData.aprobada === false) {
        return <AccountBlocked variant="pending" />
      }

      const { data: subData } = await supabase
        .from('clinic_subscriptions')
        .select('estado')
        .eq('clinic_id', user.clinic_id)
        .maybeSingle()

      if (subData?.estado === 'paused') {
        return <AccountBlocked variant="paused" />
      }
    } catch {
      // fail-soft: si falla la query, dejamos pasar
    }
  }

  const themeStyle = {
    ['--clinic-primary' as string]: colorPrimario,
    ['--clinic-accent' as string]: colorAcento,
  } as React.CSSProperties

  return (
    <AuthProvider initialUser={user}>
      <div className="min-h-screen bg-beige" style={themeStyle}>
        <Sidebar logoUrl={logoUrl} />
        {/* Main content — offset by sidebar width. En mobile usamos pt-16
         * para dejar espacio al botón hamburguesa fixed top-4 left-4. */}
        <main className="lg:ml-[250px] transition-all duration-200">
          <div className="px-3 py-4 pt-16 sm:px-6 sm:py-6 sm:pt-16 lg:p-8 lg:pt-8 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </AuthProvider>
  )
}
