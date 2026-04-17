# Deploy de la demo — Odonto Gestión

Esta guía describe cómo clonar esta branch al repo demo, crear el schema en Supabase y desplegar en Vercel.

**Stack destino:**
- Repo: `https://github.com/badental-soft/badental-demo`
- Supabase: `https://urjqrfmkosnbuzhacotc.supabase.co`
- Vercel: proyecto nuevo, subdominio a definir (ej. `demo.badentalstudio.online`)

---

## 1 · Mirrorear la branch al repo demo (5 min)

Desde tu máquina local:

```bash
# Clonar el repo original en una carpeta nueva
git clone https://github.com/badental-soft/ba-dental-gestion.git badental-demo-mirror
cd badental-demo-mirror

# Traer la branch de demo y pararse ahí
git fetch origin claude/demo-clinic-integration-VE71x:demo-source
git checkout demo-source

# Renombrarla a main (el repo demo arranca limpio con main)
git checkout -b main

# Apuntar al repo demo y pushear
git remote set-url origin https://github.com/badental-soft/badental-demo.git
git push -u origin main
```

Listo. El repo `badental-demo` ahora tiene el código de la demo en `main`.

---

## 2 · Configurar Supabase demo (10 min)

### a) Crear el usuario admin

En el dashboard de Supabase (`urjqrfmkosnbuzhacotc`):

1. **Authentication → Users → Add user → Create new user**
2. Email: `admin@odontogestion.com`
3. Password: `demo1234`
4. **Tildar "Auto Confirm User"** (importante — si no queda pendiente de confirmación por email)
5. Crear

### b) Correr el schema

1. **SQL Editor → New query**
2. Pegar todo el contenido de `supabase/demo-schema.sql` y ejecutar
3. Verificar que no haya errores (rojo). Debería terminar con "Success"

### c) Correr el seed

1. **SQL Editor → New query**
2. Pegar `supabase/demo-seed.sql` y ejecutar
3. Al final debería devolver `Demo data reset: 2026-04-XX...` indicando éxito

### d) Verificar

Desde **Table Editor** debería ver:
- `sedes`: 2 filas
- `users`: 1 fila (admin)
- `turnos`: ~80
- `cobranzas`: ~120
- `gastos`: 25
- `stock_productos`: 15
- `laboratorio_casos`: 8

Si alguna tabla está vacía, probablemente falló el seed — revisar el mensaje de error del SQL Editor.

### e) Anotar las credenciales del proyecto

Desde **Project Settings → API**:
- `Project URL` (ya la sabés: `https://urjqrfmkosnbuzhacotc.supabase.co`)
- `anon public` key
- `service_role` key (sensible — solo para env vars, nunca commitear)

---

## 3 · Deploy en Vercel (10 min)

### a) Importar el repo

1. **Vercel Dashboard → Add New → Project**
2. Seleccionar `badental-demo` de la lista de repos de GitHub
3. Framework: **Next.js** (auto-detectado)
4. Root directory: `./` (default)

### b) Env vars (antes de deployar)

En la pantalla de import, expandir **Environment Variables** y agregar:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://urjqrfmkosnbuzhacotc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(el anon key del paso 2.e)* |
| `SUPABASE_SERVICE_ROLE_KEY` | *(el service_role key del paso 2.e)* |
| `NEXT_PUBLIC_DEMO_MODE` | `true` |

`NEXT_PUBLIC_DEMO_MODE=true` activa:
- Banner azul "MODO DEMO" arriba del dashboard
- Botón "Resetear demo" que re-seedea la DB con un clic
- Oculta los botones de sync Dentalink (que no aplican acá)
- Muestra las credenciales en la pantalla de login

### c) Deploy

1. Clic en **Deploy**
2. Esperar ~2 min
3. Abrir la URL `xxx.vercel.app` que te da Vercel y verificar

Si todo va bien, ves:
- Banner azul arriba
- Login con credenciales visibles
- Al entrar: dashboard con KPIs poblados, turnos, cobranzas, gastos, stock, etc.

### d) Dominio custom (opcional)

**Vercel → Project → Settings → Domains → Add**
- Agregar `demo.badentalstudio.online` (o el que prefieras)
- Configurar el CNAME en tu DNS provider apuntando a `cname.vercel-dns.com`

---

## 4 · Probar el flujo completo

1. Entrar al login, usar las credenciales demo
2. Navegar por Dashboard, Turnos, Finanzas, Stock, Laboratorio, Empleados
3. Probar el importador Excel:
   - Ir a Turnos → **Importar Excel**
   - Bajarse una plantilla de ejemplo (ver formato en el modal)
   - Subir y verificar que se insertan
4. Tocar el botón **Resetear demo** del banner — debería volver a los datos iniciales en segundos

---

## 5 · Cómo iterar después

Si mañana querés cambiar algo (agregar módulos, retocar el seed, cambiar textos):

1. **Clonás localmente** el repo `badental-demo`
2. Hacés los cambios
3. Commit + push a `main`
4. Vercel auto-deploya en ~2 min

El schema SQL se mantiene igual — sólo re-correr `demo-seed.sql` si querés refrescar los datos.

Para cerrar la demo / entregar a un nuevo cliente:

- **Reset DB:** correr `SELECT reset_demo_data();` en SQL Editor
- **Dar acceso:** crear un nuevo usuario en Auth y setearle rol `admin` en la tabla `users`
- **Renombrar clínica:** cambiar `sedes.nombre` desde la UI (Configuración) o SQL

---

## Troubleshooting

**"Falta crear el usuario admin@odontogestion.com"** (al correr el seed)
→ Primero ejecutar el paso 2.a (crear usuario en Authentication)

**Login dice "Usuario o contraseña incorrectos"**
→ Probable: no tildaste "Auto Confirm User" al crearlo. En Supabase **Auth → Users**, entrar al usuario, **Confirm user**.

**Banner "MODO DEMO" no aparece**
→ Falta `NEXT_PUBLIC_DEMO_MODE=true` en las env vars de Vercel. Agregarla y **Redeploy**.

**Botón Importar Excel tira 500**
→ Verificar que `xlsx` esté en `package.json` y Vercel haya corrido el install. Revisar logs de runtime en Vercel.

**Datos vacíos en el dashboard**
→ El seed no corrió. Volver al paso 2.c y ejecutar `supabase/demo-seed.sql` completo.

**Quiero renombrar las sedes demo**
→ En Supabase Table Editor → sedes → editar `nombre` in-place. O SQL:
```sql
UPDATE sedes SET nombre = 'Clínica del cliente X' WHERE id = '11111111-1111-1111-1111-111111111111';
```
