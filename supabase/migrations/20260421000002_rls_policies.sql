-- =============================================================
-- Odonto Gestión — RLS policies
-- Aplica ENABLE ROW LEVEL SECURITY + políticas sobre todas las tablas
-- del schema inicial. Corre DESPUÉS de 20260421000001_initial_schema.sql.
-- =============================================================

-- RLS — CORE SAAS
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinics_select_own_or_super" ON clinics FOR SELECT TO authenticated
  USING (is_super_admin() OR id = get_user_clinic_id());
CREATE POLICY "clinics_update_super_admin_only" ON clinics FOR UPDATE TO authenticated USING (is_super_admin());
CREATE POLICY "clinics_insert_super_admin_only" ON clinics FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "clinics_delete_super_admin_only" ON clinics FOR DELETE TO authenticated USING (is_super_admin());

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_select_all_authenticated" ON plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "plans_write_super_admin_only" ON plans FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE clinic_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs_select_own_or_super" ON clinic_subscriptions FOR SELECT TO authenticated
  USING (is_super_admin() OR clinic_id = get_user_clinic_id());
CREATE POLICY "subs_write_super_admin_only" ON clinic_subscriptions FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

ALTER TABLE clinic_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select_own_or_super" ON clinic_settings FOR SELECT TO authenticated
  USING (is_super_admin() OR clinic_id = get_user_clinic_id());
CREATE POLICY "settings_update_clinic_admin" ON clinic_settings FOR UPDATE TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('settings.clinic')));
CREATE POLICY "settings_insert_super_or_service" ON clinic_settings FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select_own_clinic" ON roles FOR SELECT TO authenticated
  USING (is_super_admin() OR clinic_id = get_user_clinic_id());
CREATE POLICY "roles_manage_clinic_admin" ON roles FOR ALL TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('settings.roles')))
  WITH CHECK (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('settings.roles')));

ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sedes_select_own_clinic" ON sedes FOR SELECT TO authenticated
  USING (is_super_admin() OR clinic_id = get_user_clinic_id());
CREATE POLICY "sedes_manage_clinic_admin" ON sedes FOR ALL TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('settings.sedes')))
  WITH CHECK (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('settings.sedes')));

ALTER TABLE clinic_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cu_select_own_clinic" ON clinic_users FOR SELECT TO authenticated
  USING (is_super_admin() OR clinic_id = get_user_clinic_id());
CREATE POLICY "cu_manage_clinic_admin" ON clinic_users FOR ALL TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('settings.users')))
  WITH CHECK (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('settings.users')));

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_select_own_clinic" ON invitations FOR SELECT TO authenticated
  USING (is_super_admin() OR clinic_id = get_user_clinic_id());
CREATE POLICY "inv_manage_clinic_admin" ON invitations FOR ALL TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('settings.users')))
  WITH CHECK (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('settings.users')));

ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_admins_select_self_or_super" ON system_admins FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR is_super_admin());

-- RLS — DOMAIN
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "turnos_select" ON turnos FOR SELECT TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('turnos.view')));
CREATE POLICY "turnos_insert" ON turnos FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id() AND has_permission('turnos.create'));
CREATE POLICY "turnos_update" ON turnos FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id() AND has_permission('turnos.edit'));
CREATE POLICY "turnos_delete" ON turnos FOR DELETE TO authenticated
  USING (clinic_id = get_user_clinic_id() AND has_permission('turnos.delete'));

ALTER TABLE cobranzas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cobranzas_select" ON cobranzas FOR SELECT TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('cobranzas.view')));
CREATE POLICY "cobranzas_insert" ON cobranzas FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id() AND has_permission('cobranzas.create'));
CREATE POLICY "cobranzas_update" ON cobranzas FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id() AND has_permission('cobranzas.edit'));
CREATE POLICY "cobranzas_delete" ON cobranzas FOR DELETE TO authenticated
  USING (clinic_id = get_user_clinic_id() AND has_permission('cobranzas.delete'));

ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gastos_select" ON gastos FOR SELECT TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('gastos.view')));
CREATE POLICY "gastos_insert" ON gastos FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id() AND has_permission('gastos.create'));
CREATE POLICY "gastos_update" ON gastos FOR UPDATE TO authenticated
  USING (clinic_id = get_user_clinic_id() AND has_permission('gastos.edit'));
CREATE POLICY "gastos_delete" ON gastos FOR DELETE TO authenticated
  USING (clinic_id = get_user_clinic_id() AND has_permission('gastos.delete'));

ALTER TABLE deudas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deudas_select" ON deudas FOR SELECT TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('por_cobrar.view')));
CREATE POLICY "deudas_manage" ON deudas FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id() AND has_permission('por_cobrar.manage'))
  WITH CHECK (clinic_id = get_user_clinic_id() AND has_permission('por_cobrar.manage'));

ALTER TABLE stock_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_prod_select" ON stock_productos FOR SELECT TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('stock.view')));
CREATE POLICY "stock_prod_manage" ON stock_productos FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id() AND has_permission('stock.productos.manage'))
  WITH CHECK (clinic_id = get_user_clinic_id() AND has_permission('stock.productos.manage'));

ALTER TABLE stock_movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_mov_select" ON stock_movimientos FOR SELECT TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('stock.view')));
CREATE POLICY "stock_mov_insert" ON stock_movimientos FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id() AND has_permission('stock.movimientos.create'));

ALTER TABLE laboratorio_casos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_select" ON laboratorio_casos FOR SELECT TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('laboratorio.view')));
CREATE POLICY "lab_manage" ON laboratorio_casos FOR ALL TO authenticated
  USING (clinic_id = get_user_clinic_id() AND has_permission('laboratorio.manage'))
  WITH CHECK (clinic_id = get_user_clinic_id() AND has_permission('laboratorio.manage'));

ALTER TABLE laboratorio_historial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_hist_select" ON laboratorio_historial FOR SELECT TO authenticated
  USING (is_super_admin() OR (clinic_id = get_user_clinic_id() AND has_permission('laboratorio.view')));
CREATE POLICY "lab_hist_insert" ON laboratorio_historial FOR INSERT TO authenticated
  WITH CHECK (clinic_id = get_user_clinic_id() AND has_permission('laboratorio.manage'));
