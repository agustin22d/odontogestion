import { createClient } from '@/lib/supabase/server'
import type { User } from '@/types/database'
import { expandPermissions } from '@/lib/permissions'

/**
 * Devuelve el usuario logueado con shape compatible con el `User` legacy.
 * Consulta `clinic_users` + `roles` por `auth_user_id`. Si no hay membership
 * (todavía no hizo signup ni aceptó invitación) devuelve null.
 *
 * Adjunta `permissions: string[]` ya expandidos (los roles is_system obtienen
 * todos los permisos del catálogo). El campo legacy `rol` se mantiene como
 * `'admin'` si is_system y el nombre real del rol en caso contrario — la UI
 * vieja que checkea `user.rol === 'admin'` sigue respondiendo razonablemente.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data: profile } = await supabase
    .from('clinic_users')
    .select('id, clinic_id, nombre, email, sede_id, activo, created_at, roles(id, nombre, is_system, permissions)')
    .eq('auth_user_id', authUser.id)
    .eq('activo', true)
    .maybeSingle()

  if (!profile) return null

  const row = profile as unknown as {
    id: string
    clinic_id: string
    nombre: string
    email: string
    sede_id: string | null
    created_at: string
    roles: { id: string; nombre: string; is_system: boolean; permissions: string[] } | null
  }

  const role = row.roles
  const permissions = role ? expandPermissions(role) : []
  const rolLegacy = role?.is_system ? 'admin' : (role?.nombre || 'empleado')

  return {
    id: authUser.id,
    email: row.email,
    nombre: row.nombre,
    rol: rolLegacy,
    sede_id: row.sede_id,
    clinic_id: row.clinic_id,
    role_id: role?.id,
    role_nombre: role?.nombre,
    is_system_role: role?.is_system ?? false,
    permissions,
    created_at: row.created_at,
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
