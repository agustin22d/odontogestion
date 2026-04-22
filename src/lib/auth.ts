import { createClient } from '@/lib/supabase/server'
import type { User } from '@/types/database'

/**
 * Devuelve el usuario logueado con shape compatible con el `User` legacy.
 * Consulta `clinic_users` por `auth_user_id`. Si el usuario no tiene membership
 * (todavía no hizo signup ni aceptó invitación) devuelve null.
 *
 * TODO fase-1: derivar `rol` desde `roles.permissions` en vez de hardcodear 'admin'.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data: profile } = await supabase
    .from('clinic_users')
    .select('id, clinic_id, nombre, email, sede_id, activo, created_at')
    .eq('auth_user_id', authUser.id)
    .eq('activo', true)
    .maybeSingle()

  if (!profile) return null

  return {
    id: authUser.id,
    email: profile.email,
    nombre: profile.nombre,
    rol: 'admin',
    sede_id: profile.sede_id,
    clinic_id: profile.clinic_id,
    created_at: profile.created_at,
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
