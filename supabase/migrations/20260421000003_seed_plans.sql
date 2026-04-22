-- =============================================================
-- Odonto Gestión — Seed de planes + super-admin inicial
-- =============================================================

INSERT INTO plans (nombre, max_sedes, max_users, precio_mensual, features, orden) VALUES
  ('Free',   1,  3,      0, '{"laboratorio":false,"stock":true,"importar_excel":false}'::jsonb, 1),
  ('Basic',  2, 10,  20000, '{"laboratorio":true,"stock":true,"importar_excel":true}'::jsonb,   2),
  ('Pro',   10, 50,  45000, '{"laboratorio":true,"stock":true,"importar_excel":true,"white_label":true}'::jsonb, 3);

-- Super-admin inicial (solo se ejecuta si el usuario ya creó cuenta en auth.users)
INSERT INTO system_admins (auth_user_id)
SELECT id FROM auth.users WHERE email = 'ducculiagustin@hotmail.com';
