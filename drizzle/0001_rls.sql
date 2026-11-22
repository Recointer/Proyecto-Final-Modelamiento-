-- Aislamiento por junta con Row Level Security (Principio I de la constitución).
-- Contextos (app.role): 'auth' (inicio de sesión), 'super_admin' y 'tenant' (miembros de una junta).
-- app.tenant_id identifica la junta del contexto 'tenant'.

CREATE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT coalesce(current_setting('app.role', true), '') $$;

CREATE FUNCTION app_tenant() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;

ALTER TABLE junta ENABLE ROW LEVEL SECURITY;
ALTER TABLE junta FORCE ROW LEVEL SECURITY;
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario FORCE ROW LEVEL SECURITY;
ALTER TABLE sector ENABLE ROW LEVEL SECURITY;
ALTER TABLE sector FORCE ROW LEVEL SECURITY;
ALTER TABLE designacion_administrador ENABLE ROW LEVEL SECURITY;
ALTER TABLE designacion_administrador FORCE ROW LEVEL SECURITY;
ALTER TABLE sesion ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesion FORCE ROW LEVEL SECURITY;
ALTER TABLE token_recuperacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_recuperacion FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

-- junta (tabla de plataforma)
CREATE POLICY junta_super ON junta FOR ALL
  USING (app_role() = 'super_admin') WITH CHECK (app_role() = 'super_admin');
CREATE POLICY junta_auth ON junta FOR SELECT USING (app_role() = 'auth');
CREATE POLICY junta_tenant_select ON junta FOR SELECT
  USING (app_role() = 'tenant' AND id = app_tenant());
CREATE POLICY junta_tenant_update ON junta FOR UPDATE
  USING (app_role() = 'tenant' AND id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND id = app_tenant());

-- usuario: el super_admin solo ve super_admin y admin_junta (nunca socios ni directiva)
CREATE POLICY usuario_tenant ON usuario FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY usuario_super ON usuario FOR ALL
  USING (app_role() = 'super_admin' AND rol IN ('super_admin', 'admin_junta'))
  WITH CHECK (app_role() = 'super_admin' AND rol IN ('super_admin', 'admin_junta'));
CREATE POLICY usuario_auth_select ON usuario FOR SELECT USING (app_role() = 'auth');
CREATE POLICY usuario_auth_update ON usuario FOR UPDATE
  USING (app_role() = 'auth') WITH CHECK (app_role() = 'auth');

-- sector (solo la propia junta)
CREATE POLICY sector_tenant ON sector FOR ALL
  USING (app_role() = 'tenant' AND tenant_id = app_tenant())
  WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant());

-- designación de administrador
CREATE POLICY designacion_super ON designacion_administrador FOR ALL
  USING (app_role() = 'super_admin') WITH CHECK (app_role() = 'super_admin');
CREATE POLICY designacion_tenant ON designacion_administrador FOR SELECT
  USING (app_role() = 'tenant' AND junta_id = app_tenant());

-- sesiones y tokens: solo contexto de autenticación y super_admin (cierre masivo de sesiones)
CREATE POLICY sesion_auth ON sesion FOR ALL
  USING (app_role() IN ('auth', 'super_admin'))
  WITH CHECK (app_role() IN ('auth', 'super_admin'));
CREATE POLICY sesion_tenant ON sesion FOR DELETE
  USING (app_role() = 'tenant' AND tenant_id = app_tenant());
CREATE POLICY token_auth ON token_recuperacion FOR ALL
  USING (app_role() = 'auth') WITH CHECK (app_role() = 'auth');

-- auditoría: solo INSERT y SELECT
CREATE POLICY audit_insert ON audit_log FOR INSERT
  WITH CHECK (app_role() IN ('auth', 'super_admin', 'tenant'));
CREATE POLICY audit_select_super ON audit_log FOR SELECT USING (app_role() = 'super_admin');
CREATE POLICY audit_select_tenant ON audit_log FOR SELECT
  USING (app_role() = 'tenant' AND tenant_id = app_tenant());
