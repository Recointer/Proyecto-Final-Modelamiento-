-- Aislamiento por junta para las tablas del módulo administrativo.
-- Solo el contexto 'tenant' de la propia junta accede; el super_admin y el contexto de autenticación
-- no ven nada (solo cifras agregadas mediante las funciones de la migración 0007).

ALTER TABLE socio ENABLE ROW LEVEL SECURITY;
ALTER TABLE socio FORCE ROW LEVEL SECURITY;
ALTER TABLE evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento FORCE ROW LEVEL SECURITY;
ALTER TABLE asistencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia FORCE ROW LEVEL SECURITY;
ALTER TABLE predio ENABLE ROW LEVEL SECURITY;
ALTER TABLE predio FORCE ROW LEVEL SECURITY;
ALTER TABLE servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicio FORCE ROW LEVEL SECURITY;
ALTER TABLE turno ENABLE ROW LEVEL SECURITY;
ALTER TABLE turno FORCE ROW LEVEL SECURITY;

CREATE POLICY socio_tenant ON socio FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY evento_tenant ON evento FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY asistencia_tenant ON asistencia FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY predio_tenant ON predio FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY servicio_tenant ON servicio FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY turno_tenant ON turno FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
