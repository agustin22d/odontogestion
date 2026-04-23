'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Paciente } from '@/types/database'

interface Props {
  value: { patient_id: string | null; nombre: string; apellido: string | null }
  onChange: (next: { patient_id: string | null; nombre: string; apellido: string | null }) => void
  required?: boolean
  autoFocus?: boolean
  placeholder?: string
}

/**
 * Typeahead que busca en `pacientes` por nombre/apellido/DNI/teléfono.
 * Si el usuario tipea un nombre que no existe, queda como free-text con
 * patient_id=null — el caller resuelve si llamar `find_or_create_paciente`
 * al guardar.
 */
export default function PacienteTypeahead({
  value, onChange, required, autoFocus, placeholder,
}: Props) {
  const supabase = createClient()
  const [query, setQuery] = useState(value.patient_id
    ? `${value.nombre}${value.apellido ? ' ' + value.apellido : ''}`
    : value.nombre || ''
  )
  const [results, setResults] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    const ilikeQ = `%${trimmed}%`
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .or(`nombre.ilike.${ilikeQ},apellido.ilike.${ilikeQ},dni.ilike.${ilikeQ},telefono.ilike.${ilikeQ}`)
      .limit(8)
    if (!error && data) {
      setResults(data as unknown as Paciente[])
    }
    setLoading(false)
  }

  const handleQueryChange = (q: string) => {
    setQuery(q)
    setOpen(true)
    // Si cambia el texto, soltamos el patient_id linkeado (vuelve a free-text)
    if (value.patient_id) {
      onChange({ patient_id: null, nombre: q, apellido: null })
    } else {
      onChange({ patient_id: null, nombre: q, apellido: null })
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 200)
  }

  const selectPaciente = (p: Paciente) => {
    setQuery(`${p.nombre}${p.apellido ? ' ' + p.apellido : ''}`)
    onChange({ patient_id: p.id, nombre: p.nombre, apellido: p.apellido })
    setOpen(false)
  }

  const clear = () => {
    setQuery('')
    onChange({ patient_id: null, nombre: '', apellido: null })
    setResults([])
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder={placeholder || 'Buscar paciente o tipear nombre nuevo...'}
          required={required}
          autoFocus={autoFocus}
          className="w-full border border-border rounded-lg pl-8 pr-8 py-2 text-sm bg-white focus:outline-none focus:border-green-primary"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {value.patient_id && (
        <p className="text-[10px] text-green-primary mt-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-primary" /> Vinculado a ficha existente
        </p>
      )}

      {open && (results.length > 0 || loading || query.trim().length >= 2) && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-text-muted">Buscando...</div>
          )}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <div className="px-3 py-2 text-xs text-text-muted flex items-center gap-1.5">
              <UserPlus size={12} />
              Sin coincidencias — al guardar se crea ficha nueva con &ldquo;{query.trim()}&rdquo;
            </div>
          )}
          {!loading && results.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPaciente(p)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-beige border-b border-border-light last:border-0 transition-colors"
            >
              <div className="font-medium text-text-primary">
                {p.nombre} {p.apellido || ''}
              </div>
              <div className="text-[10px] text-text-muted flex items-center gap-2 mt-0.5">
                {p.dni && <span>DNI {p.dni}</span>}
                {p.telefono && <span>{p.telefono}</span>}
                {p.obra_social && <span>{p.obra_social}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
