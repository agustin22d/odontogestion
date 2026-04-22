import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LaboratorioClient from './LaboratorioClient'

export default async function LaboratorioPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return <LaboratorioClient />
}
