import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import OnboardingWizard from './OnboardingWizard'

export const metadata = { title: 'Configurar tu clínica · OdontoGestión' }

export default async function OnboardingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('clinic_settings')
    .select('onboarded, nombre_visible')
    .eq('clinic_id', user.clinic_id ?? '')
    .maybeSingle()

  // Si ya completó, no mostrar wizard de nuevo.
  if (settings?.onboarded) redirect('/dashboard')

  return <OnboardingWizard initialClinicName={settings?.nombre_visible ?? null} />
}
