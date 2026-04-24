-- Backfill patient_id en registros legacy de cobranzas, turnos, laboratorio_casos
-- y deudas. Para cada fila con patient_id NULL, busca o crea un paciente
-- matching por nombre dentro de la misma clinic_id usando find_or_create_paciente.
--
-- Idempotente: solo toca filas con patient_id NULL.
-- Seguro: clinic_id se preserva.
-- No modifica filas que ya tienen patient_id seteado.

DO $$
DECLARE
  r RECORD;
  v_patient_id UUID;
  v_count_cobranzas INT := 0;
  v_count_turnos INT := 0;
  v_count_lab INT := 0;
  v_count_deudas INT := 0;
BEGIN
  -- Cobranzas
  FOR r IN
    SELECT id, clinic_id, paciente FROM cobranzas
    WHERE patient_id IS NULL AND paciente IS NOT NULL AND trim(paciente) <> ''
  LOOP
    v_patient_id := find_or_create_paciente(r.paciente, r.clinic_id);
    UPDATE cobranzas SET patient_id = v_patient_id WHERE id = r.id;
    v_count_cobranzas := v_count_cobranzas + 1;
  END LOOP;

  -- Turnos (la columna patient_id se agregó en mig 6 como FK opcional)
  FOR r IN
    SELECT id, clinic_id, paciente FROM turnos
    WHERE patient_id IS NULL AND paciente IS NOT NULL AND trim(paciente) <> ''
  LOOP
    v_patient_id := find_or_create_paciente(r.paciente, r.clinic_id);
    UPDATE turnos SET patient_id = v_patient_id WHERE id = r.id;
    v_count_turnos := v_count_turnos + 1;
  END LOOP;

  -- Laboratorio
  FOR r IN
    SELECT id, clinic_id, paciente FROM laboratorio_casos
    WHERE patient_id IS NULL AND paciente IS NOT NULL AND trim(paciente) <> ''
  LOOP
    v_patient_id := find_or_create_paciente(r.paciente, r.clinic_id);
    UPDATE laboratorio_casos SET patient_id = v_patient_id WHERE id = r.id;
    v_count_lab := v_count_lab + 1;
  END LOOP;

  -- Deudas (patient_id agregado en mig 13)
  FOR r IN
    SELECT id, clinic_id, paciente FROM deudas
    WHERE patient_id IS NULL AND paciente IS NOT NULL AND trim(paciente) <> ''
  LOOP
    v_patient_id := find_or_create_paciente(r.paciente, r.clinic_id);
    UPDATE deudas SET patient_id = v_patient_id WHERE id = r.id;
    v_count_deudas := v_count_deudas + 1;
  END LOOP;

  RAISE NOTICE 'Backfill patient_id: cobranzas=%, turnos=%, lab=%, deudas=%',
    v_count_cobranzas, v_count_turnos, v_count_lab, v_count_deudas;
END $$;
