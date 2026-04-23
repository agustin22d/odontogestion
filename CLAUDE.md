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
- Toggle **Agenda** (grilla por hora con columnas por doctor) y **Lista**
  (tabla con stats + analytics mensual para admins).
- Vista Agenda: slots de 30min entre 8:00–21:00, hora pintada según
  horarios del doctor (verde claro = dentro del horario; gris claro =
  fuera; rayado gris = bloqueado por puntual o recurrente). Click en
  hueco abre form prefilled; click en turno existente abre edición.
- Filtro por sede (oculta doctores que no atienden ahí).
- Estados: agendado, atendido, no_asistio, cancelado, reprogramado.
- Origen: web, whatsapp, telefono, instagram, presencial, otro.
- Importación por Excel.
- Form turno: typeahead de paciente (link a ficha o crea on-the-fly),
  selector de profesional que autocompleta duración default y filtra
  sedes asignadas, sugerencias de slots libres en chips clickeables
  (RPC `agenda_slots_libres`).

### Finanzas (`/finanzas`)
- **Resumen tab:** KPIs financieros del mes.
- **Cobranzas tab:** CRUD + filtros + importación Excel + export CSV.
  El form usa `PacienteTypeahead`; al seleccionar paciente vinculado se
  consulta la VIEW `por_cobrar` y se muestran sus deudas pendientes en un
  cartel ámbar. Click en una deuda autocompleta tratamiento + monto =
  saldo + `es_cuota`; al guardar la cobranza se llama
  `aplicar_pago_deuda(deuda_id, monto)` que descuenta del saldo y
  recalcula estado a parcial / pagado.
- **Por Cobrar tab:** consulta la VIEW `por_cobrar` (deudas con saldo > 0).
  KPIs: vence hoy / esta semana / este mes; lista con vencidas en rojo y
  sin fecha agrupadas aparte.
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
- **Profesionales**: ABM con color, duración default por turno, matrícula,
  contacto, multi-sede (checkboxes), activo/inactivo. Por cada profesional,
  panel expandible con: editor de **horarios de atención** (franjas por
  día de semana + sede opcional) y **bloqueos del profesional**. Sección
  separada **Bloqueos generales** (feriados / días cerrados sin
  profesional asignado). Cada bloqueo tiene toggle Puntual (timestamp
  range) / Semanal (día + franja horaria + vigencia opcional).
- **Equipo**: lista de miembros, invitar miembros via endpoint
  `/api/invitations` que crea la fila + manda email con Resend (o cae al
  link manual si Resend no está configurado), revocar pendientes.
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
- [src/app/(dashboard)/dashboard/page.tsx](src/app/(dashboard)/dashboard/page.tsx)
  + [EvolucionAnual.tsx](src/app/(dashboard)/dashboard/EvolucionAnual.tsx).
- [src/app/(dashboard)/finanzas/FinanzasClient.tsx](src/app/(dashboard)/finanzas/FinanzasClient.tsx).
- [src/app/(dashboard)/configuracion/ConfiguracionClient.tsx](src/app/(dashboard)/configuracion/ConfiguracionClient.tsx)
  + [ProfesionalesTab.tsx](src/app/(dashboard)/configuracion/ProfesionalesTab.tsx).
- [src/app/(dashboard)/turnos/page.tsx](src/app/(dashboard)/turnos/page.tsx)
  + [AgendaGrid.tsx](src/app/(dashboard)/turnos/AgendaGrid.tsx)
  + [TurnoForm.tsx](src/app/(dashboard)/turnos/TurnoForm.tsx).
- [src/app/(dashboard)/pacientes/PacientesClient.tsx](src/app/(dashboard)/pacientes/PacientesClient.tsx).
- [src/app/(dashboard)/laboratorio/LaboratorioClient.tsx](src/app/(dashboard)/laboratorio/LaboratorioClient.tsx).
- [src/app/api/invitations/route.ts](src/app/api/invitations/route.ts) —
  crea invitación + envía email con Resend (best-effort).
- [src/components/Sidebar.tsx](src/components/Sidebar.tsx) — filtra nav
  por permisos.
- [src/components/AuthProvider.tsx](src/components/AuthProvider.tsx) —
  `useHasPermission`.
- [src/components/PacienteTypeahead.tsx](src/components/PacienteTypeahead.tsx) —
  reusable; usado en turnos, cobranzas, laboratorio.
- [src/components/stock/StockModule.tsx](src/components/stock/StockModule.tsx).

## Tablas Supabase vigentes

**Core SaaS:** `clinics`, `plans`, `clinic_subscriptions`, `clinic_settings`,
`roles`, `sedes`, `clinic_users`, `invitations`, `system_admins`.

**Dominio:** `turnos` (con `duracion_min` + `profesional_id` FK),
`cobranzas` (con `patient_id` FK), `gastos`, `deudas` (con `patient_id` FK),
`stock_productos`, `stock_movimientos`, `laboratorio_casos`
(con `patient_id` + `profesional_id` FKs), `laboratorio_historial`,
`pacientes`.

**Agenda:** `profesionales` (color, duración default, activo),
`profesional_sedes` (join multi-sede), `horarios_atencion` (franjas regulares
por día de semana), `agenda_bloqueos` (puntuales con timestamp range),
`bloqueos_recurrentes` (semanales con día + franja horaria + vigencia opcional).

**Vistas:** `por_cobrar` — derivada de `deudas` con saldo computado, filtra
estado IN (pendiente, parcial). Hereda RLS de `deudas`.

**RPCs principales:** `create_clinic_with_admin`, `get_invitation_by_token`,
`accept_invitation`, `find_or_create_paciente`, `agenda_slots_libres`
(considera horarios + bloqueos puntuales + recurrentes + turnos existentes),
`aplicar_pago_deuda` (descuenta del saldo y recalcula estado),
`seed_demo_data` (v4), `seed_demo_today` (agrega 8 turnos + 8 cobranzas hoy).

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
6. `20260422000002_seed_demo_data.sql` — versión inicial de
   `seed_demo_data(clinic_id)` (luego reescrita en mig 9 / 10 / 11 / 13).
7. `20260422000003_gastos_recurrentes.sql` — columnas + RPC
   `generate_recurring_expense_instances`.
8. `20260422000004_pacientes.sql` — tabla `pacientes` + permisos.
9. `20260422000005_storage_logos.sql` — bucket `clinic-logos` + policies.
10. `20260422000006_patient_id_fk.sql` — FK opcional + helper
    `find_or_create_paciente`.
11. `20260422000007_agenda_profesionales.sql` — tablas `profesionales`,
    `profesional_sedes`, `horarios_atencion`, `agenda_bloqueos`. Agrega
    `turnos.duracion_min` + `turnos.profesional_id`. RPC
    `agenda_slots_libres`. Permisos `profesionales.view/manage`,
    `agenda.bloquear`.
12. `20260422000008_bloqueos_recurrentes.sql` — tabla `bloqueos_recurrentes`
    (semanales). Re-crea `agenda_slots_libres` para considerar ambos tipos.
13. `20260422000009_seed_demo_expanded.sql` — versión 2 del seed (3 sedes,
    50 pacientes, 6 doctores, ~250 turnos, etc.). **Nota:** el INSERT a
    `laboratorio_casos` esperaba `profesional_id` que aún no existía; se
    arregla en la 10.
14. `20260422000010_lab_profesional_fk.sql` — agrega
    `laboratorio_casos.profesional_id` y re-crea el seed.
15. `20260422000011_por_cobrar_view_and_seed_v3.sql` — crea VIEW `por_cobrar`
    y seed v3 (cobranzas densas todos los días + 8 garantizadas HOY +
    gastos recurrentes futuros 6 meses + 30 deudas con vencimientos
    repartidos). BONUS: función `seed_demo_today(clinic_id)` para sembrar
    datos del día sin borrar el resto.
16. `20260422000012_deudas_patient_fk_and_seed_v4.sql` — **NO APLICADA** (se
    rolleó por completo: `CREATE OR REPLACE VIEW` no permite cambiar el orden
    de columnas existentes y todo el script estaba en transacción atómica).
    El contenido (ALTER deudas + RPC `aplicar_pago_deuda` + seed v4) se
    re-aplicó en la mig 13.
17. `20260422000013_fix_view_recreate.sql` — autosuficiente / idempotente:
    `ALTER TABLE deudas ADD COLUMN IF NOT EXISTS patient_id` + `DROP VIEW
    IF EXISTS por_cobrar` + recreación con `patient_id` en posición 4 + RPC
    `aplicar_pago_deuda` + seed v4 (pobla `patient_id` en las 30 deudas).

**Re-poblar datos demo en cualquier momento:**
```sql
SELECT seed_demo_data('TU_CLINIC_ID');           -- borra y recrea TODO
SELECT seed_demo_today('TU_CLINIC_ID');          -- solo agrega 8 turnos + 8 cobranzas HOY
```

## Env vars

- **Obligatorias en Vercel Production:**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- **Opcionales (para mostrar credenciales demo en /login):**
  - `NEXT_PUBLIC_DEMO_EMAIL`
  - `NEXT_PUBLIC_DEMO_PASSWORD`
- **Opcionales (email automático de invitaciones via Resend):**
  - `RESEND_API_KEY` — sin esto, `/api/invitations` igual crea la fila pero
    no envía email; el banner muestra "Email NO enviado" y el admin copia
    el link manualmente.
  - `RESEND_FROM_EMAIL` — default `Odonto Gestión <onboarding@resend.dev>`
    (testing — solo manda al email registrado en Resend). Para producción
    real usar dominio validado: `Odonto Gestión <invitaciones@dominio.com>`.

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
- [x] **Fase 5** — Agenda completa: tabla `profesionales` con horarios
  por día de semana + multi-sede + duración default + colores; bloqueos
  puntuales (timestamp range) y semanales (vigencia opcional); vista
  agenda diaria con grilla por hora con columnas por doctor; form
  create/edit turno con typeahead paciente + sugerencia de slots libres.
  ABM en Configuración → Profesionales.
- [x] **Fase 6** — Linkeo formal de pacientes: `PacienteTypeahead`
  reusable integrado en cobranzas / turnos / laboratorio. Crea ficha
  on-the-fly via `find_or_create_paciente` si el nombre no existe.
  En cobranzas, al elegir paciente vinculado se muestran sus deudas
  pendientes y se puede aplicar el pago al saldo (RPC
  `aplicar_pago_deuda`).
- [x] **Fase 7** — Email automático de invitación: endpoint
  `/api/invitations` con Resend; fallback a copia manual si la API key
  no está configurada.
- [x] **Fase 8** — Demo viva: seed v4 expandido con cobranzas todos los
  días + 8 garantizadas HOY, gastos recurrentes futuros 6 meses,
  30 deudas con vencimientos repartidos. Función `seed_demo_today` para
  refrescar datos del día sin borrar el resto. Vista `por_cobrar`
  cableada (antes mostraba "Sin datos" porque no existía).
- [x] **Fase 9** — Dashboard: evolución anual con gráfico 12 meses
  (línea sólida año actual + dashed año anterior) + toggle Cobranzas /
  Gastos / Resultado + delta % vs año anterior.
- [x] Login con banner de credenciales demo.
- [x] Root page con redirect auth-aware.
- [x] global-error.tsx para 500 legibles.
- [x] Migración middleware → proxy (Next 16).
- [x] Cleanup Dentalink: removido del UI (cobranzas, Por Cobrar,
  /manual, /cobranzas standalone — ambas rutas eran legacy/orfanadas).

## Pendientes (priorizados)

### Alta prioridad — pre-venta ("para salir a vender")
- [ ] **Fix y test mobile.** Audit profundo en dispositivo real (375px
  baseline). Puntos probables: AgendaGrid (scroll horizontal con muchas
  columnas), TurnoForm modal, EvolucionAnual chart legend, ProfesionalesTab
  expanded panels. Probable que algunas tablas necesiten cards alternativas
  en mobile.
- [ ] **Ultrareview en todos los aspectos.** Correr `/ultrareview` (multi-
  agent cloud review) sobre la rama main. Apunta a security + correctness
  + UX + performance. Es triggered por el user (billed); claude no lo
  puede correr solo.
- [ ] **Test QA con varias clínicas y datos/empleados.** Crear 2-3 cuentas
  demo desde signup → invitar miembros con distintos roles → verificar
  RLS aislamiento entre clínicas (datos no se cruzan), permisos correctos,
  flujo signup→invitación→login completo.
- [ ] **Dominio personalizado.** Configurar `app.odontogestion.com` en
  Vercel + DNS. Lo hace el user.

### Media prioridad
- [ ] **Versiones y permisos por versión** (planes Free / Basic / Pro).
  Hoy `plans` existe en la DB pero no hay enforcement. Definir qué features
  va cada plan (ej: Free = 1 sede + 3 users; Basic = 5 sedes + email
  automático; Pro = ilimitado + analytics avanzado). Implementar gating
  en UI (badge "Plan Pro" en features bloqueados) y en RLS si aplica.
- [ ] **Suscripción Vercel y Supabase PRO.** Evaluar si son necesarios.
  Vercel free tier alcanza para baja escala; Pro ($20/mes) saca branding
  y agrega analytics. Supabase free tier limita a 500MB DB + 50k MAU;
  Pro ($25/mes) saca esos límites + backup diario. Recomendación: arrancar
  free; pasar a Pro cuando haya >5 clínicas activas o >100MB de datos.
- [ ] **Manuales / FAQ con bot.** El widget FAQ con Claude API estaba
  scopeado pero desactivado. Reactivar con knowledge base mínima
  (cómo crear sede, invitar miembro, cargar turno, etc.). Env
  `ANTHROPIC_API_KEY`, endpoint `/api/chat`.

### Baja prioridad / nice-to-have
- [ ] **Backfill patient_id** en registros históricos corriendo
  `find_or_create_paciente(paciente, NULL)` por cada fila existente de
  cobranzas/turnos/laboratorio/deudas. Después hacer los FK NOT NULL.
- [ ] **Auditoría completa del import-excel/** — existía en el repo legacy,
  quedó semi-compatible con el schema nuevo pero no probado a fondo.
- [ ] **Multi-sede real en cobranzas/gastos** (opcional — el user dijo que
  el comportamiento actual single-select está OK).

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

Última sesión activa: 2026-04-23. El deploy Vercel está activo en
`odontogestion.vercel.app` y funcional. La sesión cerró las Fases 5–9
del roadmap (agenda completa con profesionales y bloqueos recurrentes,
linkeo formal de pacientes en cobranzas/lab con typeahead, email
automático de invitaciones via Resend, demo viva con datos densos en
todos los módulos, evolución anual con comparación año-vs-año en
Dashboard, cleanup de Dentalink). Working tree limpio, último commit
`a87ea19`.

**Estado de migraciones en Supabase DEV:** todas las migraciones 1–11
deberían estar aplicadas. La 12 falló (transacción atómica del SQL
Editor: `CREATE OR REPLACE VIEW` no permite cambiar orden de columnas);
su contenido se re-aplica completo en la 13 (idempotente). Si en una
sesión nueva hay errores tipo "column does not exist" o "relation does
not exist" en deudas/profesionales/bloqueos, el primer paso es chequear
que las migs 7, 8, 10, 11 y 13 estén aplicadas.

**Demo viva:** las 4 sedes / 6 doctores / 50 pacientes / ~360 cobranzas
/ ~140 gastos / 30 deudas / 20 lab cases vienen del seed v4. Para
refrescar: `SELECT seed_demo_data('clinic_id')` borra todo y recrea;
`SELECT seed_demo_today('clinic_id')` solo agrega 8 turnos + 8
cobranzas con fecha de hoy (no destructivo). Útil correr `seed_demo_today`
antes de cada demo en vivo.

**Pendientes para próxima sesión** (todos en la sección anterior):
mobile audit, /ultrareview, QA multi-clínica, dominio personalizado,
gating por plan, evaluación Vercel/Supabase Pro, FAQ bot.

Branches remotas: solo `main`. Todo push va directo a main con fast-forward.
