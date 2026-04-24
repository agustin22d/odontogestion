-- Marca a desa.baires@gmail.com como super-admin.
-- Idempotente: si ya está, no inserta de nuevo.
-- El usuario auth se creó previamente vía Admin API (id 2610084a-...).

INSERT INTO system_admins (auth_user_id)
SELECT id FROM auth.users WHERE email = 'desa.baires@gmail.com'
ON CONFLICT DO NOTHING;
