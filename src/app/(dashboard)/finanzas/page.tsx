import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import FinanzasPage from './FinanzasClient'

export default async function FinanzasServerPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return <FinanzasPage />
}
