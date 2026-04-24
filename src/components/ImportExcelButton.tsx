'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { useHasFeature } from './AuthProvider'

interface Props {
  entity: 'turnos' | 'cobranzas' | 'gastos'
  onSuccess?: () => void
}

const FORMATS: Record<Props['entity'], { cols: string[]; example: string }> = {
  turnos: {
    cols: ['fecha', 'hora', 'sede', 'paciente', 'profesional', 'estado', 'origen'],
    example: '17/04/2026 | 10:30 | Clínica Centro | Martínez, Laura | Dra. Benítez | agendado | whatsapp',
  },
  cobranzas: {
    cols: ['fecha', 'sede', 'paciente', 'tratamiento', 'tipo_pago', 'monto', 'notas'],
    example: '17/04/2026 | Clínica Centro | Martínez, Laura | Limpieza | efectivo | 25000 | —',
  },
  gastos: {
    cols: ['fecha', 'concepto', 'categoria', 'monto', 'sede', 'estado'],
    example: '17/04/2026 | Alquiler abril | alquiler | 850000 | Clínica Centro | pagado',
  },
}

export default function ImportExcelButton({ entity, onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{
    ok: boolean
    inserted?: number
    skipped?: number
    total?: number
    errors?: string[]
    message?: string
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fmt = FORMATS[entity]
  const canImport = useHasFeature('importar_excel')

  if (!canImport) {
    return (
      <Link
        href="/configuracion/plan"
        className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm font-medium text-text-muted hover:bg-beige transition-colors"
        title="Disponible en plan Pro"
      >
        <FileSpreadsheet size={16} />
        Importar Excel
        <span className="text-[9px] uppercase tracking-wider font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Pro</span>
      </Link>
    )
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setResult(null)

    const form = new FormData()
    form.append('file', file)
    form.append('entity', entity)

    try {
      const res = await fetch('/api/import-excel', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setResult({ ok: false, message: data.error || 'Error al importar' })
      } else {
        setResult(data)
        if (data.inserted > 0 && onSuccess) onSuccess()
      }
    } catch (e) {
      setResult({ ok: false, message: 'Error de conexión' })
    } finally {
      setUploading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const close = () => {
    setOpen(false)
    reset()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-surface hover:bg-beige border border-border rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
        title={`Importar ${entity} desde Excel`}
      >
        <FileSpreadsheet size={16} />
        Importar Excel
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4">
          <div className="bg-surface rounded-xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-text-primary">
                  Importar {entity} desde Excel
                </h2>
                <p className="text-sm text-text-secondary mt-1">
                  Subí un archivo .xlsx o .csv con los datos.
                </p>
              </div>
              <button onClick={close} className="text-text-muted hover:text-text-primary">
                <X size={20} />
              </button>
            </div>

            {/* Formato esperado */}
            <div className="mb-4 p-3 bg-blue-light border border-blue/20 rounded-lg">
              <p className="text-xs font-semibold tracking-wider uppercase text-blue mb-2">
                Formato esperado
              </p>
              <p className="text-xs text-text-secondary mb-1">
                Primera fila = encabezados con las columnas:
              </p>
              <p className="text-xs font-mono text-text-primary bg-surface/50 px-2 py-1 rounded">
                {fmt.cols.join(' | ')}
              </p>
              <p className="text-[11px] text-text-muted mt-2">
                Ejemplo de fila: <span className="font-mono">{fmt.example}</span>
              </p>
            </div>

            {/* File input */}
            {!result && (
              <div className="mb-4">
                <label className="block">
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${file ? 'border-blue bg-blue-light/30' : 'border-border hover:border-blue'}`}>
                    <Upload size={24} className="mx-auto text-text-muted mb-2" />
                    {file ? (
                      <>
                        <p className="text-sm font-medium text-text-primary">{file.name}</p>
                        <p className="text-xs text-text-muted mt-1">
                          {(file.size / 1024).toFixed(1)} KB · clic para cambiar
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-text-secondary">Clic para elegir archivo</p>
                        <p className="text-xs text-text-muted mt-1">.xlsx, .xls o .csv</p>
                      </>
                    )}
                  </div>
                </label>
              </div>
            )}

            {/* Resultado */}
            {result && (
              <div
                className={`mb-4 p-4 rounded-lg border ${result.ok ? 'bg-blue-light border-blue/20' : 'bg-red-light border-red/20'}`}
              >
                <div className="flex items-start gap-3">
                  {result.ok ? (
                    <CheckCircle2 size={20} className="text-blue shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={20} className="text-red shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    {result.ok ? (
                      <>
                        <p className="text-sm font-semibold text-text-primary">
                          Importados {result.inserted} de {result.total}
                        </p>
                        {(result.skipped ?? 0) > 0 && (
                          <p className="text-xs text-text-secondary mt-0.5">
                            {result.skipped} filas saltadas (ver errores abajo)
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-red">{result.message}</p>
                    )}
                    {result.errors && result.errors.length > 0 && (
                      <ul className="mt-2 text-xs text-text-secondary space-y-0.5 max-h-32 overflow-y-auto">
                        {result.errors.map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              {result ? (
                <button
                  onClick={close}
                  className="px-4 py-2 bg-green-primary hover:bg-green-dark text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Listo
                </button>
              ) : (
                <>
                  <button
                    onClick={close}
                    className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-secondary hover:bg-beige transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className="px-4 py-2 bg-green-primary hover:bg-green-dark text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Importando...' : 'Importar'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
