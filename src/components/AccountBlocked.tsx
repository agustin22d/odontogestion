'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Variant = 'pending' | 'paused'

const CONFIG = {
  pending: {
    icon: '⏳',
    title: 'Cuenta pendiente de aprobación',
    description:
      'Registramos tu solicitud. Te avisaremos por email cuando tu cuenta sea aprobada (generalmente en menos de 24 h).',
    action: null,
  },
  paused: {
    icon: '⏸',
    title: 'Cuenta suspendida',
    description:
      'Tu acceso fue suspendido temporalmente. Contactate con nosotros en info@didigitalstudio.com para más información.',
    action: null,
  },
}

export function AccountBlocked({ variant }: { variant: Variant }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const { icon, title, description } = CONFIG[variant]

  return (
    <div className="min-h-screen bg-beige flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="text-6xl">{icon}</div>
        <div>
          <h1 className="text-2xl font-semibold text-text-primary mb-2">{title}</h1>
          <p className="text-text-secondary text-sm leading-relaxed">{description}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-text-muted hover:text-text-secondary underline"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
