import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SysadminClient from './SysadminClient'

export const metadata = { title: 'Super-admin · OdontoGestión' }

export default async function SysadminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: isAdmin } = await supabase.rpc('is_super_admin')
  if (!isAdmin) redirect('/dashboard')

  return <SysadminClient />
}
