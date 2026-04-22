// =============================================================
// Odonto Gestión — database types (multi-tenant SaaS)
// Alineado al schema en /supabase/migrations/20260421000001_initial_schema.sql
// =============================================================

// UserRole se mantiene como `string` por compat con código legacy
// (en Fase 1 pasamos a permisos por `has_permission()`).
export type UserRole = string

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'
export type TipoPago =
  | 'efectivo'
  | 'transferencia'
  | 'tarjeta_debito'
  | 'tarjeta_credito'
  | 'mercado_pago'
  | 'otro'
export type EstadoDeuda = 'pendiente' | 'parcial' | 'pagado'
export type EstadoTurno = 'agendado' | 'atendido' | 'no_asistio' | 'cancelado' | 'reprogramado'
export type OrigenTurno = 'web' | 'whatsapp' | 'telefono' | 'instagram' | 'presencial' | 'otro'
export type TipoGasto = 'fijo' | 'variable'
export type EstadoPagoGasto = 'pendiente' | 'pagado'
export type TipoMovimientoStock = 'entrada' | 'salida'
export type EstadoLaboratorio =
  | 'escaneado'
  | 'enviada'
  | 'en_proceso'
  | 'retirada'
  | 'colocada'
  | 'a_revisar'
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

// --- Core SaaS ---

export interface Clinic {
  id: string
  nombre: string
  slug: string
  activa: boolean
  created_at: string
}

export interface Plan {
  id: string
  nombre: string
  max_sedes: number
  max_users: number
  precio_mensual: number
  features: Record<string, unknown>
  activo: boolean
  orden: number
  created_at: string
}

export interface ClinicSubscription {
  id: string
  clinic_id: string
  plan_id: string
  estado: SubscriptionStatus
  trial_ends_at: string | null
  current_period_end: string | null
  created_at: string
}

export interface ClinicSettings {
  clinic_id: string
  logo_url: string | null
  color_primario: string
  color_acento: string
  timezone: string
  moneda: string
  updated_at: string
}

export interface Role {
  id: string
  clinic_id: string
  nombre: string
  is_system: boolean
  permissions: string[]
  created_at: string
}

export interface ClinicUser {
  id: string
  auth_user_id: string
  clinic_id: string
  role_id: string
  sede_id: string | null
  nombre: string
  email: string
  activo: boolean
  created_at: string
}

export interface Invitation {
  id: string
  clinic_id: string
  email: string
  role_id: string
  sede_id: string | null
  token: string
  invited_by: string | null
  status: InvitationStatus
  expires_at: string
  accepted_at: string | null
  created_at: string
}

// --- User legacy shape (devuelto por getCurrentUser) ---
// Se mantiene para que el código que consulta user.rol / user.sede_id siga
// compilando mientras migramos a permisos. TODO fase-1: derivar `rol` de
// roles.permissions y eliminar esta interfaz.
export interface User {
  id: string
  email: string
  nombre: string
  rol: UserRole
  sede_id: string | null
  clinic_id?: string
  role_id?: string
  role_nombre?: string
  is_system_role?: boolean
  permissions?: string[]
  created_at: string
}

// --- Domain ---

export interface Sede {
  id: string
  clinic_id?: string
  nombre: string
  direccion: string | null
  activa: boolean
  created_at?: string
}

export interface Cobranza {
  id: string
  clinic_id?: string
  fecha: string
  sede_id: string | null
  created_by?: string | null
  paciente: string
  tratamiento: string
  tipo_pago: TipoPago
  monto: number
  es_cuota: boolean
  notas: string | null
  created_at: string
  // Legacy opcional (columnas/props previas que puede usar el UI existente)
  moneda?: string
  monto_original?: number | null
  tipo_cambio?: number | null
  user_id?: string | null
  sede_ids?: string[]
  // joins
  sede?: Sede
  sedes?: Sede
}

export interface Gasto {
  id: string
  clinic_id?: string
  fecha: string
  fecha_vencimiento: string | null
  sede_id: string | null
  created_by?: string | null
  concepto: string
  categoria: string
  monto: number
  tipo: TipoGasto
  estado_pago: EstadoPagoGasto
  notas: string | null
  created_at: string
  // Legacy opcional (columnas/props previas que puede usar el UI existente)
  user_id?: string | null
  sede_ids?: string[]
  estado?: EstadoPagoGasto
  pagado_por?: string | null
  // joins
  sede?: Sede
  sedes?: Sede
}

export interface Deuda {
  id: string
  clinic_id?: string
  paciente: string
  tratamiento: string | null
  monto_total: number
  monto_cobrado: number
  fecha_inicio: string
  fecha_vencimiento: string | null
  sede_id: string | null
  estado: EstadoDeuda
  notas: string | null
  created_at: string
  // joins
  sede?: Sede
}

export interface Turno {
  id: string
  clinic_id?: string
  fecha: string
  hora: string
  sede_id: string | null
  paciente: string
  profesional: string | null
  estado: EstadoTurno
  origen: OrigenTurno
  notas: string | null
  created_at: string
  // joins
  sede?: Sede
  sedes?: Sede
}

export interface ProductoStock {
  id: string
  clinic_id?: string
  sede_id: string | null
  nombre: string
  medida: string | null
  categoria: string
  unidad: string
  stock_minimo: number
  precio_compra: number | null
  activo: boolean
  created_at: string
}

export interface MovimientoStock {
  id: string
  clinic_id?: string
  producto_id: string
  sede_id: string | null
  created_by: string | null
  fecha: string
  tipo: TipoMovimientoStock
  cantidad: number
  motivo: string | null
  created_at: string
  // Legacy alias (el UI anterior leía/escribía `descripcion`)
  descripcion?: string | null
  // joins
  producto?: ProductoStock
  sede?: Sede
}

export interface LaboratorioCaso {
  id: string
  clinic_id?: string
  paciente: string
  sede_id: string | null
  profesional: string | null
  tipo: string
  laboratorio: string | null
  estado: EstadoLaboratorio
  notas: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joins
  sede?: Sede
}

export interface LaboratorioHistorial {
  id: string
  clinic_id?: string
  caso_id: string
  estado_anterior: EstadoLaboratorio | null
  estado_nuevo: EstadoLaboratorio
  user_id: string | null
  created_at: string
}
