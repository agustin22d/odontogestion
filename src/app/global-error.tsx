'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fef3c7', minHeight: '100vh' }}>
        <div style={{ maxWidth: 480, margin: '10vh auto', padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: '#0f172a' }}>
            Algo salió mal
          </h1>
          <p style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>
            Hubo un error al cargar la aplicación. Esto puede pasar si:
          </p>
          <ul style={{ fontSize: 13, color: '#475569', marginBottom: 20, paddingLeft: 20 }}>
            <li>Tu sesión expiró — probá ir al login.</li>
            <li>Las variables de entorno de Supabase no están configuradas en Vercel.</li>
            <li>Hay un bug transitorio — probá recargar.</li>
          </ul>
          {error.digest && (
            <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16, fontFamily: 'monospace' }}>
              ID: {error.digest}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={reset}
              style={{ padding: '8px 14px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}
            >
              Reintentar
            </button>
            <a
              href="/login"
              style={{ padding: '8px 14px', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, textDecoration: 'none' }}
            >
              Ir al login
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
