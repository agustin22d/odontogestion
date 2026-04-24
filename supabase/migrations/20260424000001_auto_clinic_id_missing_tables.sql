-- Agrega trigger auto_set_clinic_id a tablas que tienen clinic_id NOT NULL pero
-- no tenían el trigger. Sin esto, INSERTs desde la UI sin clinic_id explícito
-- fallan con "new row violates row-level security policy" porque la WITH CHECK
-- de la política compara clinic_id (NULL) contra get_user_clinic_id().
--
-- Tablas afectadas: sedes, roles, clinic_users, clinic_subscriptions, invitations.
-- Verificado contra QA real con admin recién signup-eado: la creación de sedes y
-- roles desde Configuración → Sedes/Roles fallaba con código 42501.

CREATE TRIGGER trg_sedes_clinic
  BEFORE INSERT ON sedes
  FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();

CREATE TRIGGER trg_roles_clinic
  BEFORE INSERT ON roles
  FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();

CREATE TRIGGER trg_clinic_users_clinic
  BEFORE INSERT ON clinic_users
  FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();

CREATE TRIGGER trg_clinic_subscriptions_clinic
  BEFORE INSERT ON clinic_subscriptions
  FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();

CREATE TRIGGER trg_invitations_clinic
  BEFORE INSERT ON invitations
  FOR EACH ROW EXECUTE FUNCTION auto_set_clinic_id();
