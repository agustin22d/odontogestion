'use client'

import { Sparkles, RotateCcw } from 'lucide-react'
import { useState } from 'react'

export default function DemoBanner() {
  const [resetting, setResetting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return null

  const handleReset = async () => {
    if (!confirm('¿Resetear los datos de demo al estado inicial? Esto borra los cambios que hayas hecho.')) return
    setResetting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/demo-reset', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Error al resetear')
      } else {
        setMessage('✓ Datos reseteados. Refrescando...')
        setTimeout(() => window.location.reload(), 800)
      }
    } catch {
      setMessage('Error de conexión')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-blue-600 to-sky-500 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles size={14} className="shrink-0" />
        <span className="font-semibold truncate">MODO DEMO</span>
        <span className="hidden sm:inline opacity-90 truncate">
          · Estás viendo datos de prueba. Los cambios no afectan ningún sistema real.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {message && <span className="text-xs opacity-90 hidden md:inline">{message}</span>}
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
          title="Resetear datos al estado inicial"
        >
          <RotateCcw size={12} />
          <span className="hidden sm:inline">{resetting ? 'Reseteando...' : 'Resetear demo'}</span>
        </button>
      </div>
    </div>
  )
}
