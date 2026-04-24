-- Reemplaza los 3 planes seed (Free/Basic/Pro) por 2: Starter y Pro.
-- Las clínicas existentes con suscripción a Free/Basic/Pro se migran a Starter
-- (los super-admins pueden bumpear a Pro manualmente desde la tabla
-- clinic_subscriptions).
--
-- Features JSONB (canónico):
--   laboratorio          — habilita módulo /laboratorio en sidebar
--   importar_excel       — habilita botón "Importar Excel" en turnos/cobranzas/gastos
--   export_csv           — habilita botones de export en cobranzas/gastos
--   gastos_recurrentes   — habilita checkbox "recurrente" + RPC en gastos
--   email_invitations    — habilita Resend en /api/invitations (false = link manual)
--   white_label          — habilita upload logo + colores en Configuración → Clínica
--   evolucion_anual      — habilita gráfico EvolucionAnual en dashboard
--   stock                — siempre true en ambos (módulo core)
--
-- Para chequear desde código: helper get_plan_features() definido al final.

-- 1. Insertar/actualizar planes
INSERT INTO plans (nombre, max_sedes, max_users, precio_mensual, features, orden, activo)
VALUES (
  'Starter',
  2,
  5,
  25000,
  '{"finanzas":false,"laboratorio":false,"stock":true,"importar_excel":false,"export_csv":false,"gastos_recurrentes":false,"email_invitations":false,"white_label":false,"evolucion_anual":false}'::jsonb,
  1,
  true
)
ON CONFLICT (nombre) DO UPDATE SET
  max_sedes = EXCLUDED.max_sedes,
  max_users = EXCLUDED.max_users,
  precio_mensual = EXCLUDED.precio_mensual,
  features = EXCLUDED.features,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo;

INSERT INTO plans (nombre, max_sedes, max_users, precio_mensual, features, orden, activo)
VALUES (
  'Pro',
  10,
  50,
  60000,
  '{"finanzas":true,"laboratorio":true,"stock":true,"importar_excel":true,"export_csv":true,"gastos_recurrentes":true,"email_invitations":true,"white_label":true,"evolucion_anual":true}'::jsonb,
  2,
  true
)
ON CONFLICT (nombre) DO UPDATE SET
  max_sedes = EXCLUDED.max_sedes,
  max_users = EXCLUDED.max_users,
  precio_mensual = EXCLUDED.precio_mensual,
  features = EXCLUDED.features,
  orden = EXCLUDED.orden,
  activo = EXCLUDED.activo;

-- 2. Migrar suscripciones existentes:
--    - Las que estaban en Free/Basic → Starter
--    - Las que estaban en Pro (viejo) → Pro (nuevo, mismo nombre)
DO $$
DECLARE
  starter_id UUID;
  pro_id UUID;
  old_free_id UUID;
  old_basic_id UUID;
BEGIN
  SELECT id INTO starter_id FROM plans WHERE nombre = 'Starter';
  SELECT id INTO pro_id FROM plans WHERE nombre = 'Pro';
  SELECT id INTO old_free_id FROM plans WHERE nombre = 'Free';
  SELECT id INTO old_basic_id FROM plans WHERE nombre = 'Basic';

  IF old_free_id IS NOT NULL THEN
    UPDATE clinic_subscriptions SET plan_id = starter_id WHERE plan_id = old_free_id;
  END IF;
  IF old_basic_id IS NOT NULL THEN
    UPDATE clinic_subscriptions SET plan_id = starter_id WHERE plan_id = old_basic_id;
  END IF;

  -- 3. Desactivar (no borrar) los planes Free/Basic para mantener histórico
  IF old_free_id IS NOT NULL THEN
    UPDATE plans SET activo = false WHERE id = old_free_id;
  END IF;
  IF old_basic_id IS NOT NULL THEN
    UPDATE plans SET activo = false WHERE id = old_basic_id;
  END IF;
END $$;

-- 4. Cambiar el plan default que asigna create_clinic_with_admin (era 'Free')
--    a 'Starter'. Reescribimos la RPC con el nuevo nombre.
CREATE OR REPLACE FUNCTION create_clinic_with_admin(p_clinic_name TEXT, p_admin_nombre TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
  v_clinic_id UUID;
  v_plan_id UUID;
  v_role_id UUID;
  v_slug TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Slug autogenerado
  v_slug := lower(regexp_replace(p_clinic_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '^-|-$', '', 'g');
  IF v_slug = '' THEN v_slug := 'clinica'; END IF;
  -- Asegurar unicidad
  WHILE EXISTS (SELECT 1 FROM clinics WHERE slug = v_slug) LOOP
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
  END LOOP;

  INSERT INTO clinics (nombre, slug) VALUES (p_clinic_name, v_slug) RETURNING id INTO v_clinic_id;
  INSERT INTO clinic_settings (clinic_id) VALUES (v_clinic_id);

  -- Suscripción trial al plan Starter por 14 días
  SELECT id INTO v_plan_id FROM plans WHERE nombre = 'Starter' AND activo = true LIMIT 1;
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM plans WHERE activo = true ORDER BY orden LIMIT 1;
  END IF;
  INSERT INTO clinic_subscriptions (clinic_id, plan_id, estado, trial_ends_at)
  VALUES (v_clinic_id, v_plan_id, 'trialing', now() + interval '14 days');

  -- Roles default
  INSERT INTO roles (clinic_id, nombre, is_system, permissions)
  VALUES (v_clinic_id, 'Admin', true, '[]'::jsonb)
  RETURNING id INTO v_role_id;

  INSERT INTO roles (clinic_id, nombre, is_system, permissions)
  VALUES (v_clinic_id, 'Empleado', false,
    '["dashboard.view","turnos.view","cobranzas.view","gastos.view","stock.view","pacientes.view"]'::jsonb);

  INSERT INTO clinic_users (clinic_id, auth_user_id, nombre, role_id)
  VALUES (v_clinic_id, v_user_id, COALESCE(p_admin_nombre, 'Admin'), v_role_id);

  RETURN v_clinic_id;
END $$;

-- 5. Helper para que el frontend pida los features del plan activo de una clinica.
--    Usado por src/lib/plan.ts vía rpc('get_plan_features').
CREATE OR REPLACE FUNCTION get_plan_features()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_clinic_id UUID;
  v_features JSONB;
BEGIN
  v_clinic_id := get_user_clinic_id();
  IF v_clinic_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT p.features
    INTO v_features
    FROM clinic_subscriptions s
    JOIN plans p ON p.id = s.plan_id
   WHERE s.clinic_id = v_clinic_id
     AND s.estado IN ('trialing', 'active')
   ORDER BY s.created_at DESC
   LIMIT 1;

  RETURN COALESCE(v_features, '{}'::jsonb);
END $$;

GRANT EXECUTE ON FUNCTION get_plan_features() TO authenticated;
