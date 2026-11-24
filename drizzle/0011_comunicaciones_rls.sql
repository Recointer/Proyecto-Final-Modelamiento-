-- Aislamiento por junta para las tablas del módulo de comunicaciones.

ALTER TABLE convocatoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE convocatoria FORCE ROW LEVEL SECURITY;
ALTER TABLE documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento FORCE ROW LEVEL SECURITY;
ALTER TABLE comunicacion_recibida ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunicacion_recibida FORCE ROW LEVEL SECURITY;
ALTER TABLE hilo ENABLE ROW LEVEL SECURITY;
ALTER TABLE hilo FORCE ROW LEVEL SECURITY;
ALTER TABLE mensaje ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensaje FORCE ROW LEVEL SECURITY;

CREATE POLICY convocatoria_tenant ON convocatoria FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY documento_tenant ON documento FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY comunicacion_tenant ON comunicacion_recibida FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY hilo_tenant ON hilo FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY mensaje_tenant ON mensaje FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
