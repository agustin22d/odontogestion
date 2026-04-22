-- =============================================================
-- Odonto Gestión — RPCs para aceptación de invitaciones
-- =============================================================

-- Devuelve datos básicos de una invitación a partir del token,
-- sin exigir autenticación (el token actúa como credencial).
-- Usada por la página pública /invite/[token] para pre-llenar el form.
CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token TEXT)
RETURNS TABLE (
  email TEXT,
  clinic_nombre TEXT,
  role_nombre TEXT,
  status invitation_status,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT i.email, c.nombre, r.nombre, i.status, i.expires_at
  FROM invitations i
  JOIN clinics c ON c.id = i.clinic_id
  JOIN roles r ON r.id = i.role_id
  WHERE i.token = p_token
  LIMIT 1;
$$;

-- Acepta una invitación: el usuario ya tiene que estar autenticado con
-- el email invitado. Crea la membership en clinic_users y marca la
-- invitación como 'accepted'. Devuelve el clinic_id al que se unió.
CREATE OR REPLACE FUNCTION accept_invitation(
  p_token TEXT,
  p_nombre TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv invitations%ROWTYPE;
  v_auth_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT email INTO v_auth_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv FROM invitations WHERE token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation_not_pending'; END IF;
  IF v_inv.expires_at < now() THEN RAISE EXCEPTION 'invitation_expired'; END IF;
  IF lower(v_inv.email) <> lower(v_auth_email) THEN RAISE EXCEPTION 'invitation_email_mismatch'; END IF;

  INSERT INTO clinic_users (auth_user_id, clinic_id, role_id, sede_id, nombre, email)
  VALUES (auth.uid(), v_inv.clinic_id, v_inv.role_id, v_inv.sede_id, p_nombre, v_auth_email)
  ON CONFLICT (auth_user_id, clinic_id) DO UPDATE SET activo = true;

  UPDATE invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_inv.id;

  RETURN v_inv.clinic_id;
END;
$$;
