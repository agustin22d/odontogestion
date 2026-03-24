'use client'

import { useAuth } from '@/components/AuthProvider'
import TareasTab from '@/components/empleados/TareasTab'

export default function TareasPage() {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin'

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">
          {isAdmin ? 'Tareas' : 'Mis Tareas'}
        </h1>
        <p className="text-sm text-text-secondary">
          {isAdmin ? 'Checklist diaria por empleado' : 'Tu checklist diaria'}
        </p>
      </div>
      <TareasTab isAdmin={isAdmin} />
    </div>
  )
}
