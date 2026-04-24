import { createClient } from '@/lib/supabase/server'
import SysadminLogin from './SysadminLogin'
import SysadminClient from './SysadminClient'

export const metadata = { title: 'Super-admin · OdontoGestión' }

export default async function SysadminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Sin sesión → mostrar login propio (sin redirect: /sysadmin es ruta pública).
  if (!user) return <SysadminLogin />

  const { data: isAdmin } = await supabase.rpc('is_super_admin')

  // Logueado pero NO super-admin → pantalla "acceso denegado" con opción de salir.
  if (!isAdmin) return <SysadminLogin denied userEmail={user.email ?? null} />

  return <SysadminClient />
}
