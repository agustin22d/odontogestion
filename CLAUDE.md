@AGENTS.md

# Odonto Gestión — SaaS de gestión integral para clínicas dentales

## Proyecto

Odonto Gestión es un SaaS multi-tenant para clínicas dentales en Argentina.
Cada clínica que contrata el servicio administra sus propios usuarios, sedes,
turnos, cobranzas, gastos, stock y laboratorio. Aislamiento por `clinic_id`
con RLS en Supabase.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Supabase** (Postgres + Auth) con RLS
- **Tailwind v4**, **Recharts**, **lucide-react**, **xlsx**
- **Deploy:** Vercel — dominio objetivo `app.odontogestion.com` (no existe todavía)
- **Node.js:** Usar Node 20 siempre: `export PATH="/opt/homebrew/opt/node@20/bin:$PATH"`

## Arquitectura multi-tenant

- **Una sola base Supabase** compartida entre todas las clínicas (proyecto DEV:
  `vsvnoyggfqkqjoqcjiin`). **NO** una DB por cliente.
- Cada fila de dominio (turnos, cobranzas, gastos, etc.) lleva `clinic_id UUID
  NOT NULL`. Un trigger `BEFORE INSERT` (`auto_set_clinic_id`) lo completa con
  `get_user_clinic_id()` si viene NULL.
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
- **Patrón crítico:** el cliente de Supabase devuelve `{ data, error }` — NO
  lanza excepciones. Siempre chequear `error` explícitamente, nunca usar
  try/catch para errores de Supabase.
- **Singleton:** no incluir `supabase` en deps de useCallback/useEffect.
- **Casts:** usar `as unknown as Type` para clientes sin tipos generados.
- **RLS:** toda tabla nueva habilita RLS desde el inicio; políticas explícitas
  SELECT/INSERT/UPDATE/DELETE para `authenticated`.
- **try/catch/finally:** `setLoading(false)` en `finally`.

## Signup y creación de clínica

1. Usuario entra a `/signup` y completa: nombre de la clínica, su nombre,
   email, password.
2. Front llama `supabase.auth.signUp({ email, password })` (proyecto DEV tiene
   auto-confirm; queda logueado en la misma llamada).
3. Front llama `supabase.rpc('create_clinic_with_admin', { p_clinic_name,
   p_admin_nombre })`. La RPC crea: `clinics` (slug autogenerado),
   `clinic_settings`, suscripción `trialing` al plan Free por 14 días, roles
   `Admin` (is_system=true) y `Empleado`, membership en `clinic_users`.
4. Redirect a `/dashboard`.

Billing manual por ahora (super-admin activa/desactiva suscripciones a mano).
Stripe/Mercado Pago queda para una fase posterior.

## Catálogo de permisos (`roles.permissions`)

Ver también [src/lib/permissions.ts](src/lib/permissions.ts) que es el espejo
canónico en TypeScript, y [src/components/AuthProvider.tsx] que expone
`useHasPermission('perm.key')` para filtrar UI.

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

## Timezone

- Argentina es UTC-3. Usar siempre `getArgentinaToday()` de `@/lib/utils/dates`
  en vez de `new Date().toISOString().split('T')[0]`.
- Después de las 21:00 AR, `toISOString()` devuelve el día siguiente (UTC).

## Git

- `user.email = ducculiagustin@hotmail.com`
- `user.name = OdontoGestion`

## NO hacer

- **NO intentar preview servers** — el port mapping no funciona en este
  entorno. Solo build-check y push.
- **NO usar middleware deprecated** — Next.js 16 depreco middleware, hay un
  warning en build. Eventualmente migrar a "proxy" convention.
- **NO commitear secrets** — solo en env vars (Vercel). Sí commitear
  `.env.example` con placeholders.

## Estructura de módulos

### Dashboard (`/dashboard`)
- KPIs: cobrado hoy/semana/mes, turnos hoy, tasa de show, por cobrar,
  no-shows, cancelados, turnos dados hoy, stock bajo, lab en proceso,
  gastos vencidos.
- Gráfico de barras: Cobranzas vs Gastos por día del mes.
- Turnos por sede.
- Filtro por sede.

### Turnos (`/turnos`)
- Vista diaria con filtro por sede.
- Estados: agendado, atendido, no_asistio, cancelado, reprogramado.
- Origen: web, whatsapp, telefono, instagram, presencial, otro.
- Importación por Excel.

### Finanzas (`/finanzas`)
- **Resumen tab:** KPIs financieros (cobrado hoy/mes, gastos pagados/pendientes,
  resultado mes, por cobrar, próximos vencimientos).
- **Cobranzas tab:** CRUD, filtros mes/sede/tipo_pago, importación Excel.
- **Por Cobrar tab:** deudas de pacientes (placeholder — Fase 1).
- **Gastos tab:** CRUD, 10 categorías con colores, filtros, `fecha_vencimiento`,
  toggle pagado/pendiente, importación Excel.

### Stock (`/stock`)
- Tabla compacta (Sede | Producto | Stock | Mín | Estado).
- Alertas stock bajo / sin stock.
- Summary cards con total por producto.
- Búsqueda por producto/medida.
- Movimientos (entrada/salida).
- ABM productos (nombre, medida, unidad, stock_minimo, precio_compra).
- Stock calculado por movimientos (no stored quantity).

### Laboratorio (`/laboratorio`)
- Casos: paciente, profesional, tipo, laboratorio, estado, notas.
- Estados: escaneado, enviada, en_proceso, retirada, colocada, a_revisar.
- Historial de cambios de estado.

### Pacientes (`/pacientes`)
- Entidad con nombre, apellido, DNI, nacimiento, tel, email, obra social, notas.
- CRUD + búsqueda por nombre/DNI/teléfono.
- Vista detalle con historial unificado (turnos + cobranzas + laboratorio)
  matcheados por nombre — TODO: agregar `patient_id` FK en cobranzas/turnos
  cuando pase el demo para matching formal.

### Configuración (`/configuracion`)
- Clínica, sedes, usuarios, roles (roadmap Fase 1).

## Categorías de gastos
`personal, laboratorio, sueldos, publicidad, limpieza, implantes, insumos,
alquiler, servicios, otros`

## Archivos clave
- `supabase/migrations/` — schema versionado (initial_schema, rls_policies,
  seed_plans + README).
- `src/types/database.ts` — todos los tipos alineados al schema SaaS.
- `src/lib/auth.ts` — `getCurrentUser()` consulta `clinic_users`.
- `src/lib/utils/dates.ts` — `getArgentinaToday()`, etc.
- `src/lib/supabase/middleware.ts` — auth middleware (riesgo redirect loop).
- `src/app/signup/page.tsx` — self-service signup + RPC.
- `src/app/login/page.tsx` — login por email.
- `src/app/(dashboard)/layout.tsx` — layout compartido.
- `src/app/(dashboard)/dashboard/page.tsx` — AdminDashboard con gráfico.
- `src/app/(dashboard)/finanzas/FinanzasClient.tsx` — Resumen + Cobranzas +
  Por Cobrar + Gastos tabs.
- `src/components/Sidebar.tsx` — sidebar con hamburguesa mobile.
- `src/components/stock/StockModule.tsx` — módulo stock completo.

## Tablas Supabase vigentes

**Core SaaS:** `clinics`, `plans`, `clinic_subscriptions`, `clinic_settings`,
`roles`, `sedes`, `clinic_users`, `invitations`, `system_admins`.

**Dominio:** `turnos`, `cobranzas`, `gastos`, `deudas`, `stock_productos`,
`stock_movimientos`, `laboratorio_casos`, `laboratorio_historial`, `pacientes`.

## Roadmap

- [x] **Fase 0** — Fundación SaaS: schema versionado, limpieza de código
  heredado, signup self-service, docs.
- [x] **Fase 1** — Gestión clínica: invitaciones por link manual,
  panel de roles con switches, permisos reales
  (`hasPermission()`/`useHasPermission`), white-label básico (colores
  + logo URL en `clinic_settings`, CSS vars expuestas en el layout).
- [x] **Fase 2** — UX: filtro rango de fecha en Dashboard (Hoy/7d/Mes/
  Año/Rango), generador de pedido de reposición en Stock (copiar texto
  o WhatsApp wa.me) con cantidades sugeridas, indicador visual stock bajo.
- [x] **Fase 3** — Finanzas avanzadas: gastos recurrentes
  (`is_recurring`, `recurrence_frequency`, `parent_expense_id`, RPC
  `generate_recurring_expense_instances`), export CSV de cobranzas/gastos.
- [x] **Fase 4** — Ficha de paciente: entidad `pacientes` con CRUD +
  búsqueda + vista detalle con historial unificado
  (turnos/cobranzas/laboratorio por match de nombre).

### Pendientes / siguientes pasos

- [ ] Envío automático de emails de invitación (Supabase `inviteUserByEmail`
  o Resend). Hoy solo link manual.
- [ ] Responsive mobile (<400px) — audit completo de todas las vistas.
- [ ] Evolución anual con gráfico 12 meses + selector de año (se puede
  hacer con el rango custom del Dashboard si se extiende).
- [ ] Cablear Tailwind a las CSS vars `--clinic-primary` / `--clinic-accent`
  para que el tema se aplique a botones/badges (infra lista, falta
  reemplazar `bg-green-primary` → `bg-clinic-primary`).
- [ ] Upload de logo a Supabase Storage (hoy es URL manual).
- [ ] Agregar FK `patient_id` en cobranzas/turnos/laboratorio para
  matching formal (hoy la vista unificada matchea por nombre).
- [ ] Widget FAQ con Claude API (env `ANTHROPIC_API_KEY`,
  endpoint `/api/chat`).
- [ ] Dominio `app.odontogestion.com` en Vercel.
- [ ] Multi-sede real en cobranzas/gastos (hoy sede_id singular; si el
  usuario elige varias sedes en el form, solo guarda la primera).

## Convenciones para cambios

- Todo cambio de schema: migración nueva en `/supabase/migrations/` con
  timestamp creciente. Nunca editar migraciones ya aplicadas.
- Toda tabla nueva: RLS habilitada desde el inicio.
- Todo componente nuevo: funcional a 375px de ancho.
- Secrets solo en env vars.
