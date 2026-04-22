-- =============================================================
-- Odonto Gestión — FK patient_id (opcional) en turnos/cobranzas/laboratorio
--
-- Agrega la columna como nullable y NO hace backfill — la vista de paciente
-- sigue matcheando por nombre para los registros históricos. Los nuevos
-- registros creados desde la UI deberían poblarla.
--
-- Un futuro migration puede correr find_or_create_paciente_by_name() sobre
-- cada registro histórico y luego hacer NOT NULL, pero no lo forzamos ahora.
-- =============================================================

ALTER TABLE turnos
  ADD COLUMN patient_id UUID REFERENCES pacientes(id) ON DELETE SET NULL;
CREATE INDEX idx_turnos_patient ON turnos(patient_id) WHERE patient_id IS NOT NULL;

ALTER TABLE cobranzas
  ADD COLUMN patient_id UUID REFERENCES pacientes(id) ON DELETE SET NULL;
CREATE INDEX idx_cobranzas_patient ON cobranzas(patient_id) WHERE patient_id IS NOT NULL;

ALTER TABLE laboratorio_casos
  ADD COLUMN patient_id UUID REFERENCES pacientes(id) ON DELETE SET NULL;
CREATE INDEX idx_lab_patient ON laboratorio_casos(patient_id) WHERE patient_id IS NOT NULL;

-- Helper: busca o crea un paciente por nombre+apellido en la clínica del
-- usuario actual. Útil para la UI al crear turnos/cobranzas sin abrir el
-- modal de nuevo paciente cada vez.
CREATE OR REPLACE FUNCTION find_or_create_paciente(
  p_nombre TEXT,
  p_apellido TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_clinic_id UUID;
  v_paciente_id UUID;
  v_first TEXT;
  v_last TEXT;
BEGIN
  v_clinic_id := get_user_clinic_id();
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'no_clinic_membership';
  END IF;

  v_first := trim(p_nombre);
  v_last := NULLIF(trim(coalesce(p_apellido, '')), '');

  -- Buscar match exacto (case-insensitive) sobre nombre + apellido.
  SELECT id INTO v_paciente_id
  FROM pacientes
  WHERE clinic_id = v_clinic_id
    AND lower(nombre) = lower(v_first)
    AND (
      (v_last IS NULL AND apellido IS NULL)
      OR lower(apellido) = lower(v_last)
    )
  LIMIT 1;

  IF v_paciente_id IS NOT NULL THEN
    RETURN v_paciente_id;
  END IF;

  INSERT INTO pacientes (clinic_id, nombre, apellido)
  VALUES (v_clinic_id, v_first, v_last)
  RETURNING id INTO v_paciente_id;

  RETURN v_paciente_id;
END;
$$;
