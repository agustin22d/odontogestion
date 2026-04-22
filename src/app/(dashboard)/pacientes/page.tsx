import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import PacientesClient from './PacientesClient'

export default async function PacientesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return <PacientesClient />
}
