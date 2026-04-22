-- =============================================================
-- Odonto Gestión — Ficha de paciente (entidad básica)
-- Por ahora NO hay FK desde turnos/cobranzas/laboratorio; la vista
-- unificada en la app hace matching por nombre (best-effort). El enlace
-- formal con patient_id va en una migración posterior.
-- =============================================================

CREATE TABLE pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES sedes(id),
  nombre TEXT NOT NULL,
  apellido TEXT,
  dni TEXT,
  fecha_nacimiento DATE,
  telefono TEXT,
  email TEXT,
  obra_social TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pacientes_clinic ON pacientes(clinic_id);
CREATE INDEX idx_pacientes_nombre ON pacientes(clinic_id, lower(nombre));
CREATE INDEX idx_pacientes_dni ON pacientes(clinic_id, dni) WHERE dni IS NOT NULL;

CREATE TRIGGER trg_pacientes_clinic BEFORE INSERT ON pacientes FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();
CREATE TRIGGER trg_pacientes_updated BEFORE UPDATE ON pacientes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pacientes_select" ON pacientes FOR SELECT TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('pacientes.view')));
CREATE POLICY "pacientes_manage" ON pacientes FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id() AND has_permission('pacientes.manage'))
  WITH CHECK (clinic_id = get_user_clinic_id() AND has_permission('pacientes.manage'));

-- Nuevos permisos: 'pacientes.view' y 'pacientes.manage'.
-- Los roles is_system=true los reciben automáticamente.
