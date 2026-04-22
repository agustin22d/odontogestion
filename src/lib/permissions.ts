// =============================================================
// Odonto Gestión — Catálogo de permisos
// Espejo exacto del contrato con `has_permission(perm TEXT)` en Postgres.
// =============================================================

export const PERMISSION_GROUPS = {
  dashboard: {
    label: 'Dashboard',
    perms: [{ key: 'dashboard.view', label: 'Ver dashboard' }],
  },
  turnos: {
    label: 'Turnos',
    perms: [
      { key: 'turnos.view', label: 'Ver' },
      { key: 'turnos.create', label: 'Crear' },
      { key: 'turnos.edit', label: 'Editar' },
      { key: 'turnos.delete', label: 'Eliminar' },
    ],
  },
  cobranzas: {
    label: 'Cobranzas',
    perms: [
      { key: 'cobranzas.view', label: 'Ver' },
      { key: 'cobranzas.create', label: 'Crear' },
      { key: 'cobranzas.edit', label: 'Editar' },
      { key: 'cobranzas.delete', label: 'Eliminar' },
    ],
  },
  gastos: {
    label: 'Gastos',
    perms: [
      { key: 'gastos.view', label: 'Ver' },
      { key: 'gastos.create', label: 'Crear' },
      { key: 'gastos.edit', label: 'Editar' },
      { key: 'gastos.delete', label: 'Eliminar' },
    ],
  },
  por_cobrar: {
    label: 'Por cobrar',
    perms: [
      { key: 'por_cobrar.view', label: 'Ver' },
      { key: 'por_cobrar.manage', label: 'Gestionar' },
    ],
  },
  stock: {
    label: 'Stock',
    perms: [
      { key: 'stock.view', label: 'Ver' },
      { key: 'stock.movimientos.create', label: 'Registrar movimientos' },
      { key: 'stock.productos.manage', label: 'Gestionar productos' },
    ],
  },
  laboratorio: {
    label: 'Laboratorio',
    perms: [
      { key: 'laboratorio.view', label: 'Ver' },
      { key: 'laboratorio.manage', label: 'Gestionar casos' },
    ],
  },
  pacientes: {
    label: 'Pacientes',
    perms: [
      { key: 'pacientes.view', label: 'Ver' },
      { key: 'pacientes.manage', label: 'Gestionar fichas' },
    ],
  },
  settings: {
    label: 'Configuración',
    perms: [
      { key: 'settings.clinic', label: 'Editar datos de clínica' },
      { key: 'settings.sedes', label: 'Gestionar sedes' },
      { key: 'settings.users', label: 'Gestionar equipo + invitaciones' },
      { key: 'settings.roles', label: 'Gestionar roles' },
    ],
  },
  otros: {
    label: 'Otros',
    perms: [{ key: 'importar_excel', label: 'Importar datos desde Excel' }],
  },
} as const

export type PermissionKey =
  (typeof PERMISSION_GROUPS)[keyof typeof PERMISSION_GROUPS]['perms'][number]['key']

export const ALL_PERMISSION_KEYS: string[] = Object.values(PERMISSION_GROUPS).flatMap(
  g => g.perms.map(p => p.key),
)

/** Expande los permisos efectivos de un rol. Un rol is_system obtiene todo. */
export function expandPermissions(role: { is_system: boolean; permissions: string[] }): string[] {
  if (role.is_system) return [...ALL_PERMISSION_KEYS]
  return role.permissions
}

export function hasPermissionIn(permissions: string[], perm: string): boolean {
  return permissions.includes(perm)
}
