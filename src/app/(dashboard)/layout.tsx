import { getCurrentUser, signOut } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AuthProvider } from '@/components/AuthProvider'
import Sidebar from '@/components/Sidebar'

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

  // White-label: cargar los colores de la clínica y exponerlos como CSS vars.
  // Si no hay clinic_id o falla la query, cae al default (NO romper el layout).
  let colorPrimario = '#0ea5e9'
  let colorAcento = '#0284c7'
  if (user.clinic_id) {
    try {
      const supabase = await createClient()
      const { data } = await supabase
        .from('clinic_settings')
        .select('color_primario, color_acento')
        .eq('clinic_id', user.clinic_id)
        .maybeSingle()
      if (data) {
        const settings = data as unknown as { color_primario: string; color_acento: string }
        colorPrimario = settings.color_primario
        colorAcento = settings.color_acento
      }
    } catch (err) {
      console.error('[layout] clinic_settings query falló:', err)
    }
  }

  const themeStyle = {
    ['--clinic-primary' as string]: colorPrimario,
    ['--clinic-accent' as string]: colorAcento,
  } as React.CSSProperties

  return (
    <AuthProvider initialUser={user}>
      <div className="min-h-screen bg-beige" style={themeStyle}>
        <Sidebar />
        {/* Main content — offset by sidebar width */}
        <main className="lg:ml-[250px] transition-all duration-200">
          <div className="p-4 pt-16 sm:p-6 sm:pt-16 lg:p-8 lg:pt-8 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </AuthProvider>
  )
}
