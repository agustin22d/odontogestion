-- Asegura que la clínica demo (la del usuario admin@odontogestion.com o quien
-- corresponda al NEXT_PUBLIC_DEMO_EMAIL) está suscrita al plan Pro, no a Starter.
--
-- Idempotente: si la clínica demo ya está en Pro o si el usuario no existe, no
-- pasa nada. Cambiar el email si tu demo usa otro.

DO $$
DECLARE
  v_demo_email TEXT := 'admin@odontogestion.com';
  v_user_id UUID;
  v_clinic_id UUID;
  v_pro_plan UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_demo_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Usuario demo % no existe, skip', v_demo_email;
    RETURN;
  END IF;

  SELECT clinic_id INTO v_clinic_id
    FROM clinic_users
   WHERE auth_user_id = v_user_id
   LIMIT 1;
  IF v_clinic_id IS NULL THEN
    RAISE NOTICE 'Usuario demo % no tiene clinic_users, skip', v_demo_email;
    RETURN;
  END IF;

  SELECT id INTO v_pro_plan FROM plans WHERE nombre = 'Pro' AND activo = true LIMIT 1;
  IF v_pro_plan IS NULL THEN
    RAISE EXCEPTION 'Plan Pro no encontrado — corré primero la migración 20260424000002';
  END IF;

  -- Update suscripción más reciente a Pro (estado active, sin trial)
  UPDATE clinic_subscriptions
     SET plan_id = v_pro_plan,
         estado = 'active',
         trial_ends_at = NULL,
         current_period_end = now() + interval '1 year'
   WHERE clinic_id = v_clinic_id
     AND id = (
       SELECT id FROM clinic_subscriptions
        WHERE clinic_id = v_clinic_id
        ORDER BY created_at DESC LIMIT 1
     );

  RAISE NOTICE 'Clínica demo (%) actualizada a plan Pro activo', v_clinic_id;
END $$;
