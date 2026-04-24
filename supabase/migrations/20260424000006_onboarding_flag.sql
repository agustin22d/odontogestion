-- Agrega flag onboarded a clinic_settings para gating del wizard.
-- Por defecto false: una clínica nueva (signup) entra al wizard.
-- Las clínicas existentes (incluida la demo) se marcan como onboarded=true
-- para no forzarles el wizard.

ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT false;

-- Marcar como onboarded a las clínicas que ya tienen actividad: tienen al
-- menos una sede, profesional o cobranza. Eso previene que la demo y otras
-- clínicas de prueba caigan en el wizard tras este deploy.
UPDATE clinic_settings cs
   SET onboarded = true
 WHERE cs.clinic_id IN (
   SELECT clinic_id FROM sedes
   UNION
   SELECT clinic_id FROM profesionales
   UNION
   SELECT clinic_id FROM cobranzas
 );

-- Helper: marca la clínica del usuario actual como onboarded.
-- Lo llama el wizard al terminar.
CREATE OR REPLACE FUNCTION mark_onboarded()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_clinic_id UUID;
BEGIN
  v_clinic_id := get_user_clinic_id();
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin clínica asignada';
  END IF;
  UPDATE clinic_settings SET onboarded = true WHERE clinic_id = v_clinic_id;
END $$;

GRANT EXECUTE ON FUNCTION mark_onboarded() TO authenticated;

-- Helper: devuelve si la clínica del user actual ya completó onboarding.
-- El layout server component lo consulta para decidir redirect.
CREATE OR REPLACE FUNCTION is_onboarded()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_clinic_id UUID;
  v_onboarded BOOLEAN;
BEGIN
  v_clinic_id := get_user_clinic_id();
  IF v_clinic_id IS NULL THEN
    RETURN true; -- super-admins u orfans no caen al wizard
  END IF;
  SELECT onboarded INTO v_onboarded FROM clinic_settings WHERE clinic_id = v_clinic_id;
  RETURN COALESCE(v_onboarded, false);
END $$;

GRANT EXECUTE ON FUNCTION is_onboarded() TO authenticated;
