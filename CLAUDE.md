@AGENTS.md

# Odonto Gestión — SaaS de gestión integral para clínicas dentales

## Proyecto

Odonto Gestión es un SaaS multi-tenant para clínicas dentales en Argentina.
Cada clínica que contrata el servicio administra sus propios usuarios, sedes,
turnos, cobranzas, gastos, stock, laboratorio y pacientes. Aislamiento por
`clinic_id` con RLS en Supabase.

## Stack

- **Next.js 16** (App Router, `proxy.ts` en vez del viejo `middleware.ts`)
  + **React 19** + **TypeScript**
- **Supabase** (Postgres + Auth + Storage) con RLS
- **Tailwind v4**, **Recharts**, **lucide-react**, **xlsx**
- **Deploy:** Vercel — dominio objetivo `app.odontogestion.com` (no configurado
  todavía). Hoy vive en `odontogestion.vercel.app`.
- **Node.js:** Usar Node 20 siempre: `export PATH="/opt/homebrew/opt/node@20/bin:$PATH"`

## Arquitectura multi-tenant

- **Una sola base Supabase** compartida entre todas las clínicas (proyecto DEV:
  `vsvnoyggfqkqjoqcjiin`). **NO** una DB por cliente.
- Cada fila de dominio lleva `clinic_id UUID NOT NULL`. Un trigger
  `BEFORE INSERT` (`auto_set_clinic_id`) lo completa con `get_user_clinic_id()`
  si viene NULL.
- RLS filtra por `clinic_id = get_user_clinic_id() AND has_permission(...)`.
- **Super-admins** (tabla `system_admins`) bypassean el filtro por clínica.
- Helpers `SECURITY DEFINER`: `is_super_admin()`, `get_user_clinic_id()`,
  `has_permission(perm TEXT)`.

## Supabase — proyecto DEV

- **Project ref:** `vsvnoyggfqkqjoqcjiin`
- **URL:** `https://vsvnoyggfqkqjoqcjiin.supabase.co`
- **Región:** East US
- **Env vars** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`) se configuran en Vercel a mano. NO commitear.
- **Patrón crítico:** el cliente Supabase devuelve `{ data, error }` — NO
  lanza excepciones. Siempre chequear `error` explícitamente, nunca usar
  try/catch para errores de Supabase.
- **Singleton:** no incluir `supabase` en deps de useCallback/useEffect.
- **Casts:** usar `as unknown as Type` para clientes sin tipos generados.
- **RLS:** toda tabla nueva habilita RLS desde el inicio; políticas explícitas
  SELECT/INSERT/UPDATE/DELETE para `authenticated`.
- **try/catch/finally:** `setLoading(false)` en `finally`.
- **Email confirmation:** en el dashboard de Auth → Providers → Email está
  **OFF** para DEV. Si se re-activa, el signup tiene fallback a
  `signInWithPassword` pero igual pide confirmar mail.

## Signup y creación de clínica

1. Usuario entra a `/signup` y completa: nombre de la clínica, su nombre,
   email, password.
2. Front llama `supabase.auth.signUp({ email, password })`. Si el proyecto
   tiene `Confirm email` apagado queda logueado en la misma llamada. Si está
   prendido, el form hace fallback a `signInWithPassword` para forzar la sesión.
3. Front llama `supabase.rpc('create_clinic_with_admin', { p_clinic_name,
   p_admin_nombre })`. La RPC crea: `clinics` (slug autogenerado),
   `clinic_settings`, suscripción `trialing` al plan Free por 14 días, roles
   `Admin` (is_system=true) y `Empleado`, membership en `clinic_users`.
4. Redirect a `/dashboard`.

Billing manual por ahora (super-admin activa/desactiva suscripciones a mano).
Stripe/Mercado Pago queda para una fase posterior.

## Catálogo de permisos (`roles.permissions`)

Ver también [src/lib/permissions.ts](src/lib/permissions.ts) que es el espejo
canónico en TypeScript, y [src/components/AuthProvider.tsx](src/components/AuthProvider.tsx)
que expone `useHasPermission('perm.key')` para filtrar UI.

```
dashboard.view
turnos.view, turnos.create, turnos.edit, turnos.delete
cobranzas.view, cobranzas.create, cobranzas.edit, cobranzas.delete
gastos.view, gastos.create, gastos.edit, gastos.delete
por_cobrar.view, por_cobrar.manage
stock.view, stock.movimientos.create, stock.productos.manage
laboratorio.view, laboratorio.manage
pacientes.view, pacientes.manage
settings.clinic, settings.users, settings.roles, settings.sedes
importar_excel
```

Roles con `is_system = true` (p. ej. `Admin` creado por
`create_clinic_with_admin`) tienen todos los permisos implícitos
(`has_permission` devuelve true sin consultar la lista).

## White-label

El `DashboardLayout` (server component) lee `clinic_settings` y expone
`--clinic-primary` y `--clinic-accent` como CSS vars en el root div. En
[src/app/globals.css](src/app/globals.css) los tokens `--color-green-primary`
y `--color-gold` delegan a esas vars con fallback al azul/celeste default, así
que **todas** las clases `bg-green-primary`, `text-green-primary`, etc.
se re-pintan automáticamente con el color de la clínica. El `-dark` para hover
se deriva con `color-mix(... 82%, black)`.

El logo vive en el bucket público `clinic-logos` (path
`<clinic_id>/logo.<ext>`). El uploader está en Configuración → Clínica y
usa cache-busting con `?v=timestamp`.

## Timezone

- Argentina es UTC-3. Usar siempre `getArgentinaToday()` de `@/lib/utils/dates`
  en vez de `new Date().toISOString().split('T')[0]`.
- Después de las 21:00 AR, `toISOString()` devuelve el día siguiente (UTC).

## Git

- `user.email = ducculiagustin@hotmail.com`
- `user.name = OdontoGestion`

## NO hacer

- **NO intentar preview servers** — el port mapping no funciona en este
  entorno. Solo build-check (`npm run build`) y push.
- **NO commitear secrets** — solo en env vars de Vercel. Sí commitear
  `.env.example` con placeholders.
- **NO editar migraciones ya aplicadas** — crear una nueva con timestamp.
- **NO usar `<img>` sin `eslint-disable-next-line @next/next/no-img-element`**
  o pasar a `next/image`.

## Estructura de módulos

### Dashboard (`/dashboard`)
- Filtro de **rango de fecha**: Hoy / 7 días / Mes / Año / Custom.
- KPIs del rango: Cobrado, Gastos pagados, Resultado, Por cobrar.
- KPIs operativos (siempre "hoy"): turnos hoy, no-shows, tasa de show,
  gastos que vencen hoy, turnos dados hoy, stock bajo, lab en proceso,
  sedes activas.
- Gráfico de barras Cobranzas vs Gastos — se bucketiza por día o por mes
  según el span del rango.
- Filtro por sede.

### Turnos (`/turnos`)
- Vista diaria con filtro por sede.
- Estados: agendado, atendido, no_asistio, cancelado, reprogramado.
- Origen: web, whatsapp, telefono, instagram, presencial, otro.
- Importación por Excel.

### Finanzas (`/finanzas`)
- **Resumen tab:** KPIs financieros del mes.
- **Cobranzas tab:** CRUD + filtros + importación Excel + export CSV.
- **Por Cobrar tab:** deudas de pacientes.
- **Gastos tab:** CRUD + 10 categorías + toggle pagado/pendiente +
  **recurrentes** (checkbox + frecuencia mensual/semanal/anual + cantidad
  de repeticiones, genera instancias futuras via RPC) + importación Excel
  + export CSV.

### Stock (`/stock`)
- Tabla compacta (Sede | Producto | Stock | Mín | Estado).
- Alertas stock bajo / sin stock.
- **Generador de pedido de reposición**: modal con cantidades sugeridas
  (2× el mínimo), copia al portapapeles o abre WhatsApp (wa.me) con el
  mensaje formateado agrupado por sede.
- Movimientos (entrada/salida) + ABM productos.
- Stock calculado por movimientos (no stored quantity).

### Laboratorio (`/laboratorio`)
- Casos: paciente, profesional, tipo, laboratorio, estado, notas.
- Estados: escaneado, enviada, en_proceso, retirada, colocada, a_revisar.
- Historial de cambios de estado.

### Pacientes (`/pacientes`)
- Entidad con nombre, apellido, DNI, nacimiento, tel, email, obra social, notas.
- CRUD + búsqueda por nombre/DNI/teléfono.
- Vista detalle con historial unificado que combina: (a) registros con
  `patient_id` FK que apuntan a este paciente, (b) registros legacy sin FK
  matcheados por nombre (ILIKE). Todo ordenado por fecha descendente.

### Configuración (`/configuracion`)
- **Clínica**: nombre, color primario/acento, upload de logo.
- **Sedes**: CRUD.
- **Equipo**: lista de miembros, generar link de invitación (`/invite/<token>`
  → signup + `accept_invitation` RPC), revocar pendientes.
- **Roles**: CRUD de roles custom con checkboxes por permiso; los `is_system`
  son read-only.

## Categorías de gastos
`personal, laboratorio, sueldos, publicidad, limpieza, implantes, insumos,
alquiler, servicios, otros`

## Archivos clave

### Backend / schema
- [supabase/migrations/](supabase/migrations/) — schema versionado + seeds.
- [src/types/database.ts](src/types/database.ts) — tipos alineados al schema.
- [src/lib/auth.ts](src/lib/auth.ts) — `getCurrentUser()` con join a roles +
  permisos expandidos.
- [src/lib/permissions.ts](src/lib/permissions.ts) — catálogo canónico.
- [src/lib/utils/dates.ts](src/lib/utils/dates.ts) — `getArgentinaToday()`.
- [src/lib/utils/csv.ts](src/lib/utils/csv.ts) — `downloadCsv()` helper.
- [src/lib/supabase/server.ts](src/lib/supabase/server.ts) — createClient
  con placeholders seguros si faltan env vars.
- [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts) —
  `updateSession()` (la llama proxy.ts).
- [src/proxy.ts](src/proxy.ts) — matcher + proxy function (Next 16).

### Páginas
- [src/app/signup/page.tsx](src/app/signup/page.tsx) — signup + RPC.
- [src/app/login/page.tsx](src/app/login/page.tsx) — login + banner demo
  (si `NEXT_PUBLIC_DEMO_EMAIL`/`_PASSWORD` están seteadas).
- [src/app/invite/[token]/page.tsx](src/app/invite/[token]/page.tsx) —
  accept invitation.
- [src/app/page.tsx](src/app/page.tsx) — root con redirect auth-aware.
- [src/app/global-error.tsx](src/app/global-error.tsx) — 500 legible.
- [src/app/(dashboard)/layout.tsx](src/app/(dashboard)/layout.tsx) — layout
  con CSS vars de white-label + logo.
- [src/app/(dashboard)/dashboard/page.tsx](src/app/(dashboard)/dashboard/page.tsx).
- [src/app/(dashboard)/finanzas/FinanzasClient.tsx](src/app/(dashboard)/finanzas/FinanzasClient.tsx).
- [src/app/(dashboard)/configuracion/ConfiguracionClient.tsx](src/app/(dashboard)/configuracion/ConfiguracionClient.tsx).
- [src/app/(dashboard)/pacientes/PacientesClient.tsx](src/app/(dashboard)/pacientes/PacientesClient.tsx).
- [src/components/Sidebar.tsx](src/components/Sidebar.tsx) — filtra nav
  por permisos.
- [src/components/AuthProvider.tsx](src/components/AuthProvider.tsx) —
  `useHasPermission`.
- [src/components/stock/StockModule.tsx](src/components/stock/StockModule.tsx).

## Tablas Supabase vigentes

**Core SaaS:** `clinics`, `plans`, `clinic_subscriptions`, `clinic_settings`,
`roles`, `sedes`, `clinic_users`, `invitations`, `system_admins`.

**Dominio:** `turnos`, `cobranzas`, `gastos`, `deudas`, `stock_productos`,
`stock_movimientos`, `laboratorio_casos`, `laboratorio_historial`, `pacientes`.

**Storage:** bucket público `clinic-logos` (path `<clinic_id>/logo.<ext>`).

## Migraciones aplicadas (todas deberían estar corridas en Supabase DEV)

Si ves errores de "column does not exist" o "relation does not exist", chequeá
que todas estén aplicadas en el SQL Editor:

1. `20260421000001_initial_schema.sql` — schema base (enums, tablas, triggers,
   RPC `create_clinic_with_admin`).
2. `20260421000002_rls_policies.sql` — todas las políticas RLS.
3. `20260421000003_seed_plans.sql` — seed de planes Free/Basic/Pro.
4. `20260421000004_accept_invitation.sql` — RPCs
   `get_invitation_by_token` + `accept_invitation`.
5. `20260422000001_accept_invitation.sql` — (duplicado del anterior,
   dejar aplicado el primero).
6. `20260422000002_seed_demo_data.sql` — función `seed_demo_data(clinic_id)`.
7. `20260422000003_gastos_recurrentes.sql` — columnas + RPC
   `generate_recurring_expense_instances`.
8. `20260422000004_pacientes.sql` — tabla `pacientes` + permisos.
9. `20260422000005_storage_logos.sql` — bucket `clinic-logos` + policies.
10. `20260422000006_patient_id_fk.sql` — FK opcional + helper
    `find_or_create_paciente`.

## Env vars

- **Obligatorias en Vercel Production:**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- **Opcionales (para mostrar credenciales demo en /login):**
  - `NEXT_PUBLIC_DEMO_EMAIL`
  - `NEXT_PUBLIC_DEMO_PASSWORD`

## Roadmap — completado

- [x] **Fase 0** — Fundación SaaS: schema versionado, limpieza legacy,
  signup self-service.
- [x] **Fase 1** — Gestión clínica: invitaciones por link manual,
  panel de roles, permisos reales (`hasPermission()`), white-label
  (colores + logo via Storage + CSS vars cableadas a Tailwind).
- [x] **Fase 2** — UX: filtro rango de fecha en Dashboard, generador de
  pedido de reposición en Stock (WhatsApp/clipboard), responsive mobile
  básico.
- [x] **Fase 3** — Finanzas avanzadas: gastos recurrentes (mensual /
  semanal / anual con N instancias), export CSV de cobranzas/gastos.
- [x] **Fase 4** — Ficha de paciente: entidad `pacientes` con CRUD +
  vista detalle con historial unificado (patient_id FK + fallback a
  match por nombre).
- [x] Login con banner de credenciales demo.
- [x] Root page con redirect auth-aware.
- [x] global-error.tsx para 500 legibles.
- [x] Migración middleware → proxy (Next 16).

## Pendientes (priorizados)

### Alta prioridad
- [ ] **UI de linkeo paciente en forms de cobranzas/turnos.** La FK
  `patient_id` está en la DB y el helper `find_or_create_paciente()` en SQL,
  pero los forms siguen pidiendo el nombre como free text. Próximo paso:
  typeahead contra `pacientes` con fallback a free-text + llamar
  `find_or_create_paciente(nombre, apellido)` al guardar y setear
  `patient_id` en el insert.
- [ ] **Email automático de invitación.** Hoy el admin copia el link a mano.
  Dos caminos:
  - Supabase `inviteUserByEmail` (service role, cero deps, pero el flujo de
    onboarding cambia: genera magic link de Supabase Auth).
  - Resend (volver a agregar dep + templates + `RESEND_API_KEY`).
  Recomendación: Supabase.

### Media prioridad
- [ ] **Evolución anual** con gráfico 12 meses + selector de año + comparación
  año-contra-año. El Dashboard ya soporta "Año" en el rango pero no hay vista
  comparativa año actual vs anterior.
- [ ] **Multi-sede real en cobranzas/gastos.** Hoy si el form tiene checkbox
  multi-sede solo se guarda la primera. Dos caminos: (a) simplificar UI a
  single-select (rápido), (b) tabla join `cobranzas_sedes` (correcto).
- [ ] **Dominio `app.odontogestion.com`** en Vercel (lo configura el user).

### Baja prioridad
- [ ] **Responsive mobile más profundo.** Lo hecho son quick wins; un audit
  en dispositivo real puede descubrir cosas puntuales en Finanzas, Stock,
  Laboratorio.
- [ ] **Widget FAQ con Claude API** (scope definido pero desactivado por
  pedido del user; env `ANTHROPIC_API_KEY`, endpoint `/api/chat`).
- [ ] **Backfill patient_id** en registros históricos corriendo
  `find_or_create_paciente(paciente, NULL)` por cada fila existente de
  cobranzas/turnos/laboratorio. Después hacer el FK NOT NULL.
- [ ] **Auditoría completa del import-excel/** — existía en el repo legacy,
  quedó semi-compatible con el schema nuevo pero no probado a fondo.

## Convenciones para cambios

- Todo cambio de schema: migración nueva en `/supabase/migrations/` con
  timestamp creciente. Nunca editar migraciones ya aplicadas.
- Toda tabla nueva: RLS habilitada desde el inicio + catalog update en
  `src/lib/permissions.ts` si agrega permisos nuevos.
- Todo componente nuevo: funcional a 375px de ancho.
- Secrets solo en env vars.
- Permisos: usar `useHasPermission('perm.key')` para hide/show UI. Nunca
  hardcodear `user.rol === 'admin'` (el `rol` legacy es un placeholder).

## Handoff / contexto de sesión

Última sesión activa: 2026-04-22. El deploy Vercel está activo en
`odontogestion.vercel.app` y funcional (login, signup, dashboard, todos los
módulos). Existe al menos una cuenta demo creada por el user.

Branches remotas: solo `main`. Todo push va directo a main con fast-forward.
