import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSbClient } from '@supabase/supabase-js'

/**
 * Resetea la password de un usuario auth como super-admin.
 *
 * Body: { auth_user_id: UUID, new_password: string }
 * Auth: el caller debe ser super-admin (system_admins).
 *
 * Internamente usa service_role para llamar a auth.admin.updateUserById.
 * NUNCA exponemos la service_role al client; el chequeo de super-admin
 * se hace contra el JWT del caller.
 */
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: isAdmin, error: errAdmin } = await supabase.rpc('is_super_admin')
  if (errAdmin || !isAdmin) {
    return NextResponse.json({ error: 'Solo super-admins' }, { status: 403 })
  }

  let body: { auth_user_id?: string; new_password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const targetId = body.auth_user_id?.trim()
  const newPwd = body.new_password?.trim()
  if (!targetId || !newPwd) {
    return NextResponse.json({ error: 'Faltan auth_user_id o new_password' }, { status: 400 })
  }
  if (newPwd.length < 8) {
    return NextResponse.json({ error: 'La password debe tener al menos 8 caracteres' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) {
    return NextResponse.json({ error: 'Backend mal configurado' }, { status: 500 })
  }

  const adminClient = createSbClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error } = await adminClient.auth.admin.updateUserById(targetId, { password: newPwd })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
