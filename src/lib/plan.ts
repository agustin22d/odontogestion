// Catálogo de features que un plan puede habilitar/deshabilitar.
// Espejo TypeScript del JSONB `plans.features` y de la migración
// 20260424000002_planes_starter_pro.sql.

export type PlanFeatureKey =
  | 'laboratorio'
  | 'stock'
  | 'importar_excel'
  | 'export_csv'
  | 'gastos_recurrentes'
  | 'email_invitations'
  | 'white_label'
  | 'evolucion_anual'

export type PlanFeatures = Partial<Record<PlanFeatureKey, boolean>>

// Defaults conservadores para usar mientras carga / si la RPC falla.
// Mejor mostrar el feature como bloqueado y que el user vea el upsell que
// dejarlo abierto y que choque contra una validación del backend.
export const FEATURES_DEFAULT: PlanFeatures = {
  laboratorio: false,
  stock: true,
  importar_excel: false,
  export_csv: false,
  gastos_recurrentes: false,
  email_invitations: false,
  white_label: false,
  evolucion_anual: false,
}

export const PLAN_LABELS = {
  starter: 'Starter',
  pro: 'Pro',
} as const

// Diferenciales user-facing — usado en /configuracion/plan para el comparador.
interface PlanTier {
  nombre: string
  precio: number
  max_sedes: number
  max_users: number
  incluye: string[]
  no_incluye: string[]
}

export const PLAN_TIERS: PlanTier[] = [
  {
    nombre: 'Starter',
    precio: 25000,
    max_sedes: 2,
    max_users: 5,
    incluye: [
      'Hasta 2 sedes',
      'Hasta 5 usuarios',
      'Dashboard, Turnos, Finanzas',
      'Stock con alertas',
      'Pacientes con historial unificado',
      'Agenda con bloqueos',
      'Soporte por email',
    ],
    no_incluye: [
      'Laboratorio',
      'Import Excel masivo',
      'Export CSV',
      'Gastos recurrentes automáticos',
      'Email automático en invitaciones',
      'White-label (logo + colores)',
      'Evolución anual y comparación año-vs-año',
    ],
  },
  {
    nombre: 'Pro',
    precio: 60000,
    max_sedes: 10,
    max_users: 50,
    incluye: [
      'Hasta 10 sedes',
      'Hasta 50 usuarios',
      'Todo lo de Starter más:',
      'Laboratorio con historial de estados',
      'Import Excel (turnos / cobranzas / gastos)',
      'Export CSV en finanzas',
      'Gastos recurrentes (mensual / semanal / anual)',
      'Email automático en invitaciones (Resend)',
      'White-label: logo + colores de la clínica',
      'Evolución anual y delta % año-vs-año',
      'Soporte prioritario',
    ],
    no_incluye: [],
  },
]
