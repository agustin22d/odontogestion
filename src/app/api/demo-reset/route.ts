import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Resetea los datos de la demo al estado inicial.
 * Sólo disponible si NEXT_PUBLIC_DEMO_MODE=true y el usuario es admin.
 */
export async function POST() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
    return NextResponse.json({ error: 'Demo mode disabled' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admin puede resetear' }, { status: 403 })
  }

  const { data, error } = await supabase.rpc('reset_demo_data')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, message: data })
}
