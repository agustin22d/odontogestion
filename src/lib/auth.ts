import { createClient } from '@/lib/supabase/server'
import type { User } from '@/types/database'

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  return profile
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
