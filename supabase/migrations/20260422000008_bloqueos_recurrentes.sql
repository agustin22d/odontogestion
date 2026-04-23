-- =============================================================
-- Odonto Gestión — Bloqueos recurrentes (semanales)
--
-- Antes solo había `agenda_bloqueos` puntuales (rango fecha-hora).
-- Esto agrega `bloqueos_recurrentes` que se repiten todas las semanas
-- en un día/franja específica (ej. "lunes 14:00–16:00 cerrado por
-- reunión semanal", "feriado todos los domingos completos").
--
-- Aplica a profesional específico (profesional_id NOT NULL) o a toda
-- la sede (profesional_id NULL). Mismo patrón que agenda_bloqueos.
--
-- También actualiza la RPC `agenda_slots_libres` para considerar
-- ambas tablas al calcular huecos disponibles.
-- =============================================================

CREATE TABLE bloqueos_recurrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  profesional_id UUID REFERENCES profesionales(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES sedes(id) ON DELETE CASCADE,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_desde TIME NOT NULL,
  hora_hasta TIME NOT NULL,
  motivo TEXT,
  vigente_desde DATE,
  vigente_hasta DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (hora_hasta > hora_desde),
  CHECK (vigente_hasta IS NULL OR vigente_desde IS NULL OR vigente_hasta >= vigente_desde)
);
CREATE INDEX idx_bloq_rec_clinic_dia ON bloqueos_recurrentes(clinic_id, dia_semana);
CREATE INDEX idx_bloq_rec_prof ON bloqueos_recurrentes(profesional_id) WHERE profesional_id IS NOT NULL;
CREATE INDEX idx_bloq_rec_sede ON bloqueos_recurrentes(sede_id) WHERE sede_id IS NOT NULL;
CREATE TRIGGER trg_bloq_rec_clinic BEFORE INSERT ON bloqueos_recurrentes
  FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();

-- RLS — mismo patrón que agenda_bloqueos: ver requiere turnos.view,
-- gestionar requiere agenda.bloquear.
ALTER TABLE bloqueos_recurrentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bloq_rec_select" ON bloqueos_recurrentes FOR SELECT TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('turnos.view')));
CREATE POLICY "bloq_rec_manage" ON bloqueos_recurrentes FOR ALL TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('agenda.bloquear')))
  WITH CHECK (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('agenda.bloquear')));

-- =============================================================
-- Re-crear `agenda_slots_libres` considerando bloqueos recurrentes.
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
BEGIN
  v_dow := EXTRACT(DOW FROM p_fecha)::SMALLINT;
  v_slot_min := COALESCE(p_slot_min, (
    SELECT duracion_default_min FROM profesionales WHERE id = p_profesional_id
  ), 30);
  v_dia_inicio := (p_fecha::TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires');

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
    -- Bloqueos puntuales (rango timestamp)
    AND NOT EXISTS (
      SELECT 1 FROM agenda_bloqueos b
      WHERE (b.profesional_id = p_profesional_id OR b.profesional_id IS NULL)
        AND (b.sede_id = p_sede_id OR b.sede_id IS NULL)
        AND b.fecha_desde < (v_dia_inicio + p.s_fin)
        AND b.fecha_hasta > (v_dia_inicio + p.s_inicio)
    )
    -- Bloqueos recurrentes (mismo día de semana + solapan en franja horaria)
    AND NOT EXISTS (
      SELECT 1 FROM bloqueos_recurrentes br
      WHERE (br.profesional_id = p_profesional_id OR br.profesional_id IS NULL)
        AND (br.sede_id = p_sede_id OR br.sede_id IS NULL)
        AND br.dia_semana = v_dow
        AND br.hora_desde < p.s_fin::TIME
        AND br.hora_hasta > p.s_inicio::TIME
        AND (br.vigente_desde IS NULL OR br.vigente_desde <= p_fecha)
        AND (br.vigente_hasta IS NULL OR br.vigente_hasta >= p_fecha)
    )
  ORDER BY p.s_inicio;
END;
$$;
