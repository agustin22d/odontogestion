import { requireRole } from '@/lib/auth-guard'
import FinanzasPage from './FinanzasClient'

export default async function FinanzasServerPage() {
  await requireRole('admin')
  return <FinanzasPage />
}
