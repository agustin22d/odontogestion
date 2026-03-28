import { requireRole } from '@/lib/auth-guard'

export default async function GastosPage() {
  await requireRole('admin')

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">Gastos</h1>
      <p className="text-sm text-text-secondary mb-8">Control de gastos por categoría</p>
      <div className="bg-surface rounded-xl border border-border p-8 text-center text-text-muted">
        Módulo en construcción
      </div>
    </div>
  )
}
