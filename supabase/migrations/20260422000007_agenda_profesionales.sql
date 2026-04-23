-- =============================================================
-- Odonto Gestión — Agenda + Profesionales (Fase A)
--
-- Crea las entidades necesarias para la agenda de turnos:
--   - profesionales (doctores/dentistas, antes free-text en turnos.profesional)
--   - profesional_sedes (join multi-sede: un doctor atiende en N sedes)
--   - horarios_atencion (días/horas regulares por profesional+sede)
--   - agenda_bloqueos (vacaciones, días libres, ranges arbitrarios)
--   - turnos.duracion_min (default 30) + turnos.profesional_id (FK opcional)
--
-- Permisos nuevos: profesionales.view, profesionales.manage, agenda.bloquear
--
-- NO toca turnos.profesional (text). Se mantiene como fallback histórico
-- igual que paciente/patient_id en migración 20260422000006.
-- =============================================================

CREATE TABLE profesionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  apellido TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  duracion_default_min INTEGER NOT NULL DEFAULT 30 CHECK (duracion_default_min > 0),
  matricula TEXT,
  email TEXT,
  telefono TEXT,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profesionales_clinic ON profesionales(clinic_id);
CREATE INDEX idx_profesionales_activo ON profesionales(clinic_id, activo);
CREATE TRIGGER trg_profesionales_clinic BEFORE INSERT ON profesionales
  FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();

CREATE TABLE profesional_sedes (
  profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  sede_id UUID NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
  PRIMARY KEY (profesional_id, sede_id)
);
CREATE INDEX idx_prof_sedes_sede ON profesional_sedes(sede_id);

CREATE TABLE horarios_atencion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES sedes(id) ON DELETE CASCADE,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_desde TIME NOT NULL,
  hora_hasta TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (hora_hasta > hora_desde)
);
CREATE INDEX idx_horarios_prof ON horarios_atencion(profesional_id);
CREATE INDEX idx_horarios_clinic_dia ON horarios_atencion(clinic_id, dia_semana);
CREATE TRIGGER trg_horarios_clinic BEFORE INSERT ON horarios_atencion
  FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();

CREATE TABLE agenda_bloqueos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  profesional_id UUID REFERENCES profesionales(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES sedes(id) ON DELETE CASCADE,
  fecha_desde TIMESTAMPTZ NOT NULL,
  fecha_hasta TIMESTAMPTZ NOT NULL,
  motivo TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_hasta > fecha_desde)
);
CREATE INDEX idx_bloqueos_clinic_rango ON agenda_bloqueos(clinic_id, fecha_desde, fecha_hasta);
CREATE INDEX idx_bloqueos_prof ON agenda_bloqueos(profesional_id) WHERE profesional_id IS NOT NULL;
CREATE INDEX idx_bloqueos_sede ON agenda_bloqueos(sede_id) WHERE sede_id IS NOT NULL;
CREATE TRIGGER trg_bloqueos_clinic BEFORE INSERT ON agenda_bloqueos
  FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();

-- TURNOS: agregamos duración (default 30 min) + FK opcional a profesionales
ALTER TABLE turnos
  ADD COLUMN duracion_min INTEGER NOT NULL DEFAULT 30 CHECK (duracion_min > 0),
  ADD COLUMN profesional_id UUID REFERENCES profesionales(id) ON DELETE SET NULL;
CREATE INDEX idx_turnos_profesional_fecha ON turnos(profesional_id, fecha)
  WHERE profesional_id IS NOT NULL;

-- =============================================================
-- RLS
-- Patrón estándar: select por clinic + permission.view, manage por
-- clinic + permission.manage. Super-admin bypass.
-- =============================================================

ALTER TABLE profesionales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profesionales_select" ON profesionales FOR SELECT TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('profesionales.view')));
CREATE POLICY "profesionales_manage" ON profesionales FOR ALL TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('profesionales.manage')))
  WITH CHECK (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('profesionales.manage')));

ALTER TABLE profesional_sedes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prof_sedes_select" ON profesional_sedes FOR SELECT TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM profesionales p
      WHERE p.id = profesional_sedes.profesional_id
        AND p.clinic_id = get_user_clinic_id()
        AND has_permission('profesionales.view')
    )
  );
CREATE POLICY "prof_sedes_manage" ON profesional_sedes FOR ALL TO authenticated
  USING (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM profesionales p
      WHERE p.id = profesional_sedes.profesional_id
        AND p.clinic_id = get_user_clinic_id()
        AND has_permission('profesionales.manage')
    )
  )
  WITH CHECK (
    is_super_admin() OR EXISTS (
      SELECT 1 FROM profesionales p
      WHERE p.id = profesional_sedes.profesional_id
        AND p.clinic_id = get_user_clinic_id()
        AND has_permission('profesionales.manage')
    )
  );

ALTER TABLE horarios_atencion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "horarios_select" ON horarios_atencion FOR SELECT TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('profesionales.view')));
CREATE POLICY "horarios_manage" ON horarios_atencion FOR ALL TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('profesionales.manage')))
  WITH CHECK (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('profesionales.manage')));

ALTER TABLE agenda_bloqueos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bloqueos_select" ON agenda_bloqueos FOR SELECT TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('turnos.view')));
CREATE POLICY "bloqueos_manage" ON agenda_bloqueos FOR ALL TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('agenda.bloquear')))
  WITH CHECK (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('agenda.bloquear')));

-- =============================================================
-- RPC: slots libres del día para un profesional+sede
--
-- Devuelve las franjas horarias disponibles considerando:
--   - horario regular del profesional para el día de semana
--   - bloqueos vigentes (del profesional o globales de la sede)
--   - turnos ya agendados (no cancelados/no-show)
--
-- p_slot_min: granularidad de los slots a generar (default = duración del prof)
-- =============================================================
CREATE OR REPLACE FUNCTION agenda_slots_libres(
  p_profesional_id UUID,
  p_sede_id UUID,
  p_fecha DATE,
  p_slot_min INTEGER DEFAULT NULL
) RETURNS TABLE (slot_inicio TIME, slot_fin TIME)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_dow SMALLINT;
  v_slot_min INTEGER;
  v_dia_inicio TIMESTAMPTZ;
  v_dia_fin TIMESTAMPTZ;
BEGIN
  v_dow := EXTRACT(DOW FROM p_fecha)::SMALLINT;
  v_slot_min := COALESCE(p_slot_min, (
    SELECT duracion_default_min FROM profesionales WHERE id = p_profesional_id
  ), 30);
  v_dia_inicio := (p_fecha::TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires');
  v_dia_fin := v_dia_inicio + interval '1 day';

  RETURN QUERY
  WITH ventanas AS (
    SELECT hora_desde, hora_hasta
    FROM horarios_atencion
    WHERE profesional_id = p_profesional_id
      AND dia_semana = v_dow
      AND (sede_id IS NULL OR sede_id = p_sede_id)
  ),
  pasos AS (
    SELECT
      v.hora_desde + (n * (v_slot_min || ' minutes')::interval) AS s_inicio,
      v.hora_desde + ((n + 1) * (v_slot_min || ' minutes')::interval) AS s_fin
    FROM ventanas v
    CROSS JOIN LATERAL generate_series(
      0,
      GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v.hora_hasta - v.hora_desde)) / 60 / v_slot_min)::INT - 1)
    ) AS n
  ),
  ocupados AS (
    SELECT t.hora AS t_ini,
           (t.hora + (t.duracion_min || ' minutes')::interval)::TIME AS t_fin
    FROM turnos t
    WHERE t.fecha = p_fecha
      AND t.profesional_id = p_profesional_id
      AND t.estado NOT IN ('cancelado', 'no_asistio')
  )
  SELECT p.s_inicio::TIME, p.s_fin::TIME
  FROM pasos p
  WHERE p.s_fin <= (SELECT MAX(hora_hasta) FROM ventanas)
    AND NOT EXISTS (
      SELECT 1 FROM ocupados o
      WHERE p.s_inicio < o.t_fin AND p.s_fin > o.t_ini
    )
    AND NOT EXISTS (
      SELECT 1 FROM agenda_bloqueos b
      WHERE (b.profesional_id = p_profesional_id OR b.profesional_id IS NULL)
        AND (b.sede_id = p_sede_id OR b.sede_id IS NULL)
        AND b.fecha_desde < (v_dia_inicio + p.s_fin)
        AND b.fecha_hasta > (v_dia_inicio + p.s_inicio)
    )
  ORDER BY p.s_inicio;
END;
$$;
