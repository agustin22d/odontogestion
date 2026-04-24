// Catálogo de features que un plan puede habilitar/deshabilitar.
// Espejo TypeScript del JSONB `plans.features` y de la migración
// 20260424000002_planes_starter_pro.sql.

export type PlanFeatureKey =
  | 'finanzas'
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
  finanzas: false,
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
  /** Horas de configuración / soporte incluidas en el primer mes. */
  horas_soporte: number
  incluye: string[]
  no_incluye: string[]
}

/**
 * En modo demo queremos que el usuario navegue como Pro (ve todas las
 * funcionalidades) pero con un chip "Pro" sutil al lado del título de los
 * módulos premium para que entienda qué viene en el plan superior.
 *
 * Activación: setear `NEXT_PUBLIC_SHOW_PRO_BADGES=true` en Vercel Env Vars
 * SOLO en el proyecto demo. En clínicas reales NO se setea.
 */
export function shouldShowProBadges(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_PRO_BADGES === 'true'
}

export const PLAN_TIERS: PlanTier[] = [
  {
    nombre: 'Starter',
    precio: 25000,
    max_sedes: 2,
    max_users: 5,
    horas_soporte: 10,
    incluye: [
      'Hasta 2 sedes',
      'Hasta 5 usuarios',
      '10 horas de configuración y soporte el primer mes',
      'Dashboard operativo (turnos, no-shows, tasa de show)',
      'Agenda con profesionales y bloqueos',
      'Pacientes con historial unificado',
      'Stock con alertas y pedido de reposición',
      'Soporte por email',
    ],
    no_incluye: [
      'Caja: cobranzas, gastos y por cobrar',
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
    horas_soporte: 30,
    incluye: [
      'Hasta 10 sedes',
      'Hasta 50 usuarios',
      '30 horas de configuración y soporte el primer mes',
      'Todo lo de Starter más:',
      'Caja completa: cobranzas, gastos y por cobrar (deudas con saldo)',
      'Aplicar pagos a deudas con un click (descuenta saldo automáticamente)',
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
