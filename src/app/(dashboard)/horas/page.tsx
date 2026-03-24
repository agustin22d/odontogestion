'use client'

import { useAuth } from '@/components/AuthProvider'
import HorasTab from '@/components/empleados/HorasTab'

export default function HorasPage() {
  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin'

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-text-primary mb-1">
          {isAdmin ? 'Horas' : 'Mis Horas'}
        </h1>
        <p className="text-sm text-text-secondary">
          {isAdmin ? 'Control de horas del equipo' : 'Registro de horas trabajadas'}
        </p>
      </div>
      <HorasTab isAdmin={isAdmin} />
    </div>
  )
}
