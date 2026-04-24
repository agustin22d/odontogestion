'use client'

import Link from 'next/link'
import { shouldShowProBadges } from '@/lib/plan'

/**
 * Chip pequeño "Pro" para mostrar al lado del título de un módulo premium.
 * Solo se muestra si NEXT_PUBLIC_SHOW_PRO_BADGES=true (en el deploy demo).
 *
 * En instalaciones reales (clínicas) no se muestra — el plan ya filtra
 * lo que ven y los grayed-out de sidebar/dashboard hacen el upsell.
 */
export default function ProBadge({ className = '' }: { className?: string }) {
  if (!shouldShowProBadges()) return null
  return (
    <Link
      href="/configuracion/plan"
      className={`inline-flex items-center text-[10px] uppercase tracking-wider font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded hover:bg-amber-200 transition-colors ${className}`}
      title="Esta funcionalidad pertenece al plan Pro"
    >
      Pro
    </Link>
  )
}
