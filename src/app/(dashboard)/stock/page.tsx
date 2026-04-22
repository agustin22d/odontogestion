import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import StockModule from '@/components/stock/StockModule'

export default async function StockPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Stock</h1>
        <p className="text-sm text-text-secondary hidden sm:block">Inventario de insumos por sede</p>
      </div>
      <StockModule />
    </div>
  )
}
