# Supabase migrations — Odonto Gestión

Estado: **YA EJECUTADO** en el proyecto DEV
`vsvnoyggfqkqjoqcjiin`. Estos archivos versionan el schema vigente;
NO volver a correrlos contra esa base.

## Orden de ejecución

1. `20260421000001_initial_schema.sql` — enums, tablas core SaaS
   (clinics, plans, clinic_subscriptions, clinic_settings, roles,
   sedes, clinic_users, invitations, system_admins), tablas de
   dominio (turnos, cobranzas, gastos, deudas, stock_productos,
   stock_movimientos, laboratorio_casos, laboratorio_historial),
   triggers (`auto_set_clinic_id`, `set_updated_at`), helpers
   `SECURITY DEFINER` (`is_super_admin`, `get_user_clinic_id`,
   `has_permission`) y RPC `create_clinic_with_admin`.
2. `20260421000002_rls_policies.sql` — `ENABLE ROW LEVEL SECURITY`
   + todas las `CREATE POLICY` sobre core SaaS y dominio.
3. `20260421000003_seed_plans.sql` — seeds de los 3 planes (Free,
   Basic, Pro) e inserción condicional del super-admin inicial.

## Aislamiento multi-tenant

Cada tabla de dominio tiene `clinic_id UUID NOT NULL`. Un trigger
`BEFORE INSERT` (`auto_set_clinic_id`) lo completa con
`get_user_clinic_id()` si viene NULL. Las políticas RLS filtran
por `clinic_id = get_user_clinic_id()` más `has_permission(...)`
para el verbo correspondiente. Los super-admins bypassean el
filtro por clínica (ven todo).

## Catálogo de permisos (keys válidas para `roles.permissions`)

```
dashboard.view
turnos.view, turnos.create, turnos.edit, turnos.delete
cobranzas.view, cobranzas.create, cobranzas.edit, cobranzas.delete
gastos.view, gastos.create, gastos.edit, gastos.delete
por_cobrar.view, por_cobrar.manage
stock.view, stock.movimientos.create, stock.productos.manage
laboratorio.view, laboratorio.manage
settings.clinic, settings.users, settings.roles, settings.sedes
importar_excel
```

Roles con `is_system = true` (p. ej. el rol `Admin` que seedea
`create_clinic_with_admin`) tienen todos los permisos implícitos
(la función `has_permission` devuelve `true` sin consultar la
lista `permissions`).

## Agregar un super-admin manualmente

El usuario tiene que existir primero en `auth.users` (se crea al
hacer signup desde la app o desde el Dashboard de Supabase →
Authentication → Users). Después, en SQL Editor:

```sql
INSERT INTO system_admins (auth_user_id)
SELECT id FROM auth.users WHERE email = 'x@y.com';
```

## Flujo de signup

1. Usuario entra a `/signup`, completa: nombre de la clínica,
   nombre personal, email, password.
2. Front llama `supabase.auth.signUp({ email, password })`. Si
   el proyecto tiene auto-confirm activado (caso DEV), queda
   logueado en la misma llamada.
3. Front llama `supabase.rpc('create_clinic_with_admin', {
   p_clinic_name, p_admin_nombre })`. Esa RPC (SECURITY DEFINER)
   crea:
   - la clínica (`clinics`) con slug autogenerado,
   - `clinic_settings` con defaults,
   - una suscripción `trialing` al plan Free por 14 días,
   - roles `Admin` (is_system=true) y `Empleado` (permisos
     básicos),
   - la membership del usuario en `clinic_users` con rol
     `Admin`.
4. Front redirige a `/dashboard`.

## Agregar migraciones nuevas

- Nombre: `YYYYMMDDHHMMSS_<slug>.sql` (timestamp creciente).
- RLS habilitada desde el inicio para toda tabla nueva.
- Nunca editar migraciones ya aplicadas; crear una nueva que
  altere el estado deseado.
