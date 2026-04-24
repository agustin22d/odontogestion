-- Panel super-admin: tabla de pagos por clínica + RPCs para administrar
-- planes y registrar cobros. Solo accesibles para super-admins
-- (system_admins). RLS estricta.

-- =====================
-- 1. Tabla de pagos
-- =====================
CREATE TABLE IF NOT EXISTS clinic_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  monto NUMERIC(10,2) NOT NULL CHECK (monto >= 0),
  moneda TEXT NOT NULL DEFAULT 'USD',
  concepto TEXT NOT NULL,
  notas TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clinic_payments_clinic_fecha ON clinic_payments(clinic_id, fecha DESC);

ALTER TABLE clinic_payments ENABLE ROW LEVEL SECURITY;

-- Solo super-admins pueden leer/escribir esta tabla. Esto es metadata operativa
-- no expuesta a las clínicas mismas.
CREATE POLICY clinic_payments_super_admin_only ON clinic_payments
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- =====================
-- 2. Overview de clínicas
-- =====================
-- Devuelve una fila por clínica con la info que el panel sysadmin necesita:
-- nombre, plan actual, estado, fechas de trial/período, último pago, total
-- pagado en el año, conteos básicos.
CREATE OR REPLACE FUNCTION sysadmin_clinics_overview()
RETURNS TABLE (
  clinic_id UUID,
  clinic_nombre TEXT,
  clinic_slug TEXT,
  clinic_creada TIMESTAMPTZ,
  plan_id UUID,
  plan_nombre TEXT,
  plan_precio NUMERIC,
  estado TEXT,
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  ultimo_pago_fecha DATE,
  ultimo_pago_monto NUMERIC,
  total_pagado_anio NUMERIC,
  total_users BIGINT,
  total_sedes BIGINT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id,
    c.nombre,
    c.slug,
    c.created_at,
    p.id,
    p.nombre,
    p.precio_mensual,
    s.estado::text,
    s.trial_ends_at,
    s.current_period_end,
    (SELECT fecha FROM clinic_payments WHERE clinic_id = c.id ORDER BY fecha DESC LIMIT 1),
    (SELECT monto FROM clinic_payments WHERE clinic_id = c.id ORDER BY fecha DESC LIMIT 1),
    COALESCE((SELECT SUM(monto) FROM clinic_payments WHERE clinic_id = c.id AND fecha >= date_trunc('year', CURRENT_DATE)), 0),
    (SELECT COUNT(*) FROM clinic_users WHERE clinic_id = c.id),
    (SELECT COUNT(*) FROM sedes WHERE clinic_id = c.id)
  FROM clinics c
  LEFT JOIN LATERAL (
    SELECT * FROM clinic_subscriptions sub
    WHERE sub.clinic_id = c.id
    ORDER BY sub.created_at DESC LIMIT 1
  ) s ON true
  LEFT JOIN plans p ON p.id = s.plan_id
  WHERE is_super_admin()
  ORDER BY c.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION sysadmin_clinics_overview() TO authenticated;

-- =====================
-- 3. Cambiar plan / suscripción
-- =====================
CREATE OR REPLACE FUNCTION sysadmin_change_subscription(
  p_clinic_id UUID,
  p_plan_id UUID,
  p_estado TEXT,
  p_period_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Acción solo permitida para super-admins';
  END IF;

  IF p_estado NOT IN ('trialing', 'active', 'past_due', 'canceled') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_estado;
  END IF;

  SELECT id INTO v_existing_id
    FROM clinic_subscriptions
   WHERE clinic_id = p_clinic_id
   ORDER BY created_at DESC LIMIT 1;

  IF v_existing_id IS NULL THEN
    INSERT INTO clinic_subscriptions (clinic_id, plan_id, estado, current_period_end)
    VALUES (p_clinic_id, p_plan_id, p_estado::subscription_status, p_period_end);
  ELSE
    UPDATE clinic_subscriptions
       SET plan_id = p_plan_id,
           estado = p_estado::subscription_status,
           current_period_end = p_period_end,
           trial_ends_at = CASE WHEN p_estado = 'trialing' THEN current_period_end ELSE NULL END
     WHERE id = v_existing_id;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION sysadmin_change_subscription(UUID, UUID, TEXT, TIMESTAMPTZ) TO authenticated;

-- =====================
-- 4. Registrar pago
-- =====================
CREATE OR REPLACE FUNCTION sysadmin_record_payment(
  p_clinic_id UUID,
  p_monto NUMERIC,
  p_fecha DATE DEFAULT CURRENT_DATE,
  p_concepto TEXT DEFAULT 'Suscripción mensual',
  p_notas TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Acción solo permitida para super-admins';
  END IF;

  INSERT INTO clinic_payments (clinic_id, monto, fecha, concepto, notas, created_by)
  VALUES (p_clinic_id, p_monto, p_fecha, p_concepto, p_notas, auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION sysadmin_record_payment(UUID, NUMERIC, DATE, TEXT, TEXT) TO authenticated;

-- =====================
-- 5. Listar pagos de una clínica
-- =====================
CREATE OR REPLACE FUNCTION sysadmin_clinic_payments(p_clinic_id UUID)
RETURNS TABLE (
  id UUID,
  fecha DATE,
  monto NUMERIC,
  moneda TEXT,
  concepto TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, fecha, monto, moneda, concepto, notas, created_at
    FROM clinic_payments
   WHERE clinic_id = p_clinic_id AND is_super_admin()
   ORDER BY fecha DESC, created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION sysadmin_clinic_payments(UUID) TO authenticated;

-- =====================
-- 6. Listar admins de una clínica (para reset password)
-- =====================
CREATE OR REPLACE FUNCTION sysadmin_clinic_users(p_clinic_id UUID)
RETURNS TABLE (
  user_id UUID,
  auth_user_id UUID,
  email TEXT,
  nombre TEXT,
  role_nombre TEXT,
  is_admin BOOLEAN
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT cu.id,
         cu.auth_user_id,
         au.email::text,
         cu.nombre,
         r.nombre,
         r.is_system
    FROM clinic_users cu
    JOIN auth.users au ON au.id = cu.auth_user_id
    LEFT JOIN roles r ON r.id = cu.role_id
   WHERE cu.clinic_id = p_clinic_id AND is_super_admin()
   ORDER BY r.is_system DESC NULLS LAST, cu.created_at;
$$;

GRANT EXECUTE ON FUNCTION sysadmin_clinic_users(UUID) TO authenticated;

-- =====================
-- 7. Listado de planes activos (para el selector)
-- =====================
CREATE OR REPLACE FUNCTION sysadmin_plans_list()
RETURNS TABLE (id UUID, nombre TEXT, precio NUMERIC, max_sedes INT, max_users INT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, nombre, precio_mensual, max_sedes, max_users
    FROM plans
   WHERE activo = true AND is_super_admin()
   ORDER BY orden;
$$;

GRANT EXECUTE ON FUNCTION sysadmin_plans_list() TO authenticated;
