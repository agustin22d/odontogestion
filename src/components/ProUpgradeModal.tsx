'use client'

import { X } from 'lucide-react'

export function ProUpgradeModal({ feature, onClose }: { feature: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <span className="text-[10px] font-bold uppercase tracking-[3px] text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
            Plan Pro
          </span>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition">
            <X size={18} />
          </button>
        </div>
        <h3 className="font-display text-lg font-semibold text-text-primary mb-2">
          {feature} requiere el plan Pro
        </h3>
        <p className="text-sm text-text-secondary mb-5 leading-relaxed">
          Esta función está disponible en el plan Pro. Contactanos y la activamos en menos de 24 horas hábiles.
        </p>
        <div className="flex gap-2">
          <a
            href="mailto:info@didigitalstudio.com?subject=Solicitud%20plan%20Pro%20-%20Odontogestion"
            className="flex-1 text-center bg-green-primary text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-green-primary/90 transition"
          >
            Contactar a DI Digital
          </a>
          <button
            onClick={onClose}
            className="px-4 rounded-lg border border-border text-text-secondary text-sm hover:bg-beige transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
