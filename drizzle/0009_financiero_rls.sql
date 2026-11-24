-- Aislamiento por junta para las tablas del módulo financiero (solo el contexto 'tenant' de la propia junta).

ALTER TABLE concepto_cobro ENABLE ROW LEVEL SECURITY;
ALTER TABLE concepto_cobro FORCE ROW LEVEL SECURITY;
ALTER TABLE cargo ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargo FORCE ROW LEVEL SECURITY;
ALTER TABLE pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE pago FORCE ROW LEVEL SECURITY;
ALTER TABLE contador_comprobante ENABLE ROW LEVEL SECURITY;
ALTER TABLE contador_comprobante FORCE ROW LEVEL SECURITY;
ALTER TABLE egreso ENABLE ROW LEVEL SECURITY;
ALTER TABLE egreso FORCE ROW LEVEL SECURITY;
ALTER TABLE material ENABLE ROW LEVEL SECURITY;
ALTER TABLE material FORCE ROW LEVEL SECURITY;
ALTER TABLE movimiento_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimiento_material FORCE ROW LEVEL SECURITY;
ALTER TABLE activo_fijo ENABLE ROW LEVEL SECURITY;
ALTER TABLE activo_fijo FORCE ROW LEVEL SECURITY;

CREATE POLICY concepto_tenant ON concepto_cobro FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY cargo_tenant ON cargo FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY pago_tenant ON pago FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY contador_tenant ON contador_comprobante FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY egreso_tenant ON egreso FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY material_tenant ON material FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY movimiento_material_tenant ON movimiento_material FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY activo_tenant ON activo_fijo FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
