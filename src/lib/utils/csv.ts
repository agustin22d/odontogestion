// =============================================================
// CSV export utilities — cliente-side, sin dependencias.
// Genera un CSV compatible con Excel AR (UTF-8 + BOM, separador ';').
// =============================================================

type CsvValue = string | number | null | undefined | boolean

export interface CsvColumn<T> {
  header: string
  get: (row: T) => CsvValue
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const SEP = ';'
  const escape = (v: CsvValue): string => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'number' ? v.toString().replace('.', ',') : String(v)
    // Si contiene separador, comillas o saltos de línea, envolver en comillas y escapar dobles.
    if (s.includes(SEP) || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const headerLine = columns.map(c => escape(c.header)).join(SEP)
  const dataLines = rows.map(row => columns.map(c => escape(c.get(row))).join(SEP))
  // BOM para que Excel abra bien los acentos.
  const content = '﻿' + [headerLine, ...dataLines].join('\r\n')

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Formatea un número con coma decimal (para columnas monetarias). */
export function moneyCsv(n: number | string | null | undefined): number | null {
  if (n === null || n === undefined || n === '') return null
  const num = typeof n === 'string' ? parseFloat(n) : n
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null
}
