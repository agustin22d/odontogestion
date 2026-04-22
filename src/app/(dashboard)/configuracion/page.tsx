import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ConfiguracionClient from './ConfiguracionClient'

export default async function ConfiguracionPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return <ConfiguracionClient />
}
