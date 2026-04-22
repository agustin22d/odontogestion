-- =============================================================
-- Odonto Gestión — Initial schema (multi-tenant SaaS)
-- Project ref: vsvnoyggfqkqjoqcjiin
-- YA EJECUTADO en Supabase. Este archivo versiona el estado
-- vigente; no volver a correrlo contra la DB.
-- =============================================================

-- ENUMS
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled');
CREATE TYPE tipo_pago AS ENUM ('efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito', 'mercado_pago', 'otro');
CREATE TYPE estado_deuda AS ENUM ('pendiente', 'parcial', 'pagado');
CREATE TYPE estado_turno AS ENUM ('agendado', 'atendido', 'no_asistio', 'cancelado', 'reprogramado');
CREATE TYPE origen_turno AS ENUM ('web', 'whatsapp', 'telefono', 'instagram', 'presencial', 'otro');
CREATE TYPE tipo_gasto AS ENUM ('fijo', 'variable');
CREATE TYPE estado_pago_gasto AS ENUM ('pendiente', 'pagado');
CREATE TYPE tipo_movimiento_stock AS ENUM ('entrada', 'salida');
CREATE TYPE estado_laboratorio AS ENUM ('escaneado', 'enviada', 'en_proceso', 'retirada', 'colocada', 'a_revisar');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- CORE SAAS
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT UNIQUE NOT NULL,
  max_sedes INTEGER NOT NULL DEFAULT 1,
  max_users INTEGER NOT NULL DEFAULT 3,
  precio_mensual NUMERIC(12,2) NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE clinic_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id),
  estado subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subs_clinic ON clinic_subscriptions(clinic_id);

CREATE TABLE clinic_settings (
  clinic_id UUID PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
  logo_url TEXT,
  color_primario TEXT NOT NULL DEFAULT '#0ea5e9',
  color_acento TEXT NOT NULL DEFAULT '#0284c7',
  timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  moneda TEXT NOT NULL DEFAULT 'ARS',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, nombre)
);
CREATE INDEX idx_roles_clinic ON roles(clinic_id);

CREATE TABLE sedes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  direccion TEXT,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sedes_clinic ON sedes(clinic_id);

CREATE TABLE clinic_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id),
  sede_id UUID REFERENCES sedes(id),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (auth_user_id, clinic_id)
);
CREATE INDEX idx_clinic_users_auth ON clinic_users(auth_user_id);
CREATE INDEX idx_clinic_users_clinic ON clinic_users(clinic_id);

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id),
  sede_id UUID REFERENCES sedes(id),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID REFERENCES auth.users(id),
  status invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_clinic ON invitations(clinic_id);
CREATE INDEX idx_invitations_email ON invitations(email);

CREATE TABLE system_admins (
  auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM system_admins WHERE auth_user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION get_user_clinic_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT clinic_id FROM clinic_users
  WHERE auth_user_id = auth.uid() AND activo = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION has_permission(perm TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM clinic_users cu
    JOIN roles r ON r.id = cu.role_id
    WHERE cu.auth_user_id = auth.uid()
      AND cu.activo = true
      AND (r.is_system = true OR r.permissions ? perm)
  );
$$;

CREATE OR REPLACE FUNCTION auto_set_clinic_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.clinic_id IS NULL THEN
    NEW.clinic_id := get_user_clinic_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- SIGNUP RPC
CREATE OR REPLACE FUNCTION create_clinic_with_admin(
  p_clinic_name TEXT,
  p_admin_nombre TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_clinic_id UUID;
  v_admin_role_id UUID;
  v_free_plan_id UUID;
  v_slug TEXT;
  v_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  v_slug := lower(regexp_replace(p_clinic_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  IF v_slug = '' THEN v_slug := 'clinica'; END IF;
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  INSERT INTO clinics (nombre, slug) VALUES (p_clinic_name, v_slug)
  RETURNING id INTO v_clinic_id;

  INSERT INTO clinic_settings (clinic_id) VALUES (v_clinic_id);

  SELECT id INTO v_free_plan_id FROM plans WHERE nombre = 'Free' AND activo ORDER BY orden LIMIT 1;
  IF v_free_plan_id IS NOT NULL THEN
    INSERT INTO clinic_subscriptions (clinic_id, plan_id, estado, trial_ends_at)
    VALUES (v_clinic_id, v_free_plan_id, 'trialing', now() + interval '14 days');
  END IF;

  INSERT INTO roles (clinic_id, nombre, is_system, permissions)
  VALUES (v_clinic_id, 'Admin', true, '[]'::jsonb)
  RETURNING id INTO v_admin_role_id;

  INSERT INTO roles (clinic_id, nombre, is_system, permissions)
  VALUES (v_clinic_id, 'Empleado', false,
    '["dashboard.view","turnos.view","cobranzas.view","gastos.view","stock.view","laboratorio.view"]'::jsonb);

  INSERT INTO clinic_users (auth_user_id, clinic_id, role_id, nombre, email)
  VALUES (auth.uid(), v_clinic_id, v_admin_role_id, p_admin_nombre, v_email);

  RETURN v_clinic_id;
END;
$$;

-- DOMAIN TABLES
CREATE TABLE turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES sedes(id),
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  paciente TEXT NOT NULL,
  profesional TEXT,
  estado estado_turno NOT NULL DEFAULT 'agendado',
  origen origen_turno NOT NULL DEFAULT 'whatsapp',
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_turnos_clinic_fecha ON turnos(clinic_id, fecha);
CREATE INDEX idx_turnos_sede_fecha ON turnos(sede_id, fecha);
CREATE TRIGGER trg_turnos_clinic BEFORE INSERT ON turnos FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();

CREATE TABLE cobranzas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES sedes(id),
  created_by UUID REFERENCES auth.users(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  paciente TEXT NOT NULL,
  tratamiento TEXT,
  tipo_pago tipo_pago NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  es_cuota BOOLEAN NOT NULL DEFAULT false,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cobranzas_clinic_fecha ON cobranzas(clinic_id, fecha);
CREATE INDEX idx_cobranzas_sede_fecha ON cobranzas(sede_id, fecha);
CREATE TRIGGER trg_cobranzas_clinic BEFORE INSERT ON cobranzas FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();

CREATE TABLE gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES sedes(id),
  created_by UUID REFERENCES auth.users(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  concepto TEXT NOT NULL,
  categoria TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  tipo tipo_gasto NOT NULL DEFAULT 'variable',
  estado_pago estado_pago_gasto NOT NULL DEFAULT 'pagado',
  fecha_vencimiento DATE,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gastos_clinic_fecha ON gastos(clinic_id, fecha);
CREATE INDEX idx_gastos_sede_fecha ON gastos(sede_id, fecha);
CREATE TRIGGER trg_gastos_clinic BEFORE INSERT ON gastos FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();

CREATE TABLE deudas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES sedes(id),
  paciente TEXT NOT NULL,
  tratamiento TEXT,
  monto_total NUMERIC(12,2) NOT NULL CHECK (monto_total > 0),
  monto_cobrado NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monto_cobrado >= 0),
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  estado estado_deuda NOT NULL DEFAULT 'pendiente',
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deudas_clinic ON deudas(clinic_id);
CREATE INDEX idx_deudas_estado ON deudas(estado);
CREATE TRIGGER trg_deudas_clinic BEFORE INSERT ON deudas FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();

CREATE TABLE stock_productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES sedes(id),
  nombre TEXT NOT NULL,
  medida TEXT,
  categoria TEXT NOT NULL DEFAULT 'General',
  unidad TEXT NOT NULL DEFAULT 'unidad',
  stock_minimo INTEGER NOT NULL DEFAULT 0,
  precio_compra NUMERIC(12,2),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_productos_clinic ON stock_productos(clinic_id);
CREATE INDEX idx_stock_productos_sede ON stock_productos(sede_id);
CREATE TRIGGER trg_stock_productos_clinic BEFORE INSERT ON stock_productos FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();

CREATE TABLE stock_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES sedes(id),
  producto_id UUID NOT NULL REFERENCES stock_productos(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo tipo_movimiento_stock NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_mov_clinic_fecha ON stock_movimientos(clinic_id, fecha);
CREATE INDEX idx_stock_mov_producto ON stock_movimientos(producto_id);
CREATE TRIGGER trg_stock_mov_clinic BEFORE INSERT ON stock_movimientos FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();

CREATE TABLE laboratorio_casos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES sedes(id),
  paciente TEXT NOT NULL,
  profesional TEXT,
  tipo TEXT NOT NULL DEFAULT 'corona',
  laboratorio TEXT,
  estado estado_laboratorio NOT NULL DEFAULT 'escaneado',
  notas TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lab_clinic ON laboratorio_casos(clinic_id);
CREATE INDEX idx_lab_estado ON laboratorio_casos(estado);
CREATE TRIGGER trg_lab_clinic BEFORE INSERT ON laboratorio_casos FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();
CREATE TRIGGER trg_lab_updated BEFORE UPDATE ON laboratorio_casos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE laboratorio_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  caso_id UUID NOT NULL REFERENCES laboratorio_casos(id) ON DELETE CASCADE,
  estado_anterior estado_laboratorio,
  estado_nuevo estado_laboratorio NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lab_hist_caso ON laboratorio_historial(caso_id);
CREATE TRIGGER trg_lab_hist_clinic BEFORE INSERT ON laboratorio_historial FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();
