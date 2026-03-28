import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { UserRole } from '@/types/database'

/**
 * Verifica que el usuario actual tenga uno de los roles permitidos.
 * Si no, redirige a /dashboard. Usar en server components (page.tsx).
 */
export async function requireRole(...allowedRoles: UserRole[]) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!allowedRoles.includes(user.rol)) redirect('/dashboard')
  return user
}
