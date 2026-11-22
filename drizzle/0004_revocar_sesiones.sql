-- Un DELETE con WHERE también exige una política de lectura (SELECT) sobre las filas; la política de
-- borrado para miembros de una junta no la tenía y borraba 0 filas sin error, dejando vivas las
-- sesiones de cuentas desactivadas o con credencial restablecida.
-- Se reemplaza por una función SECURITY DEFINER acotada: un miembro de una junta solo puede cerrar
-- sesiones de usuarios de su propia junta, sin poder leer la tabla de sesiones.
DROP POLICY IF EXISTS sesion_tenant ON sesion;

CREATE FUNCTION revocar_sesiones_usuario(p_usuario uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF app_role() = 'tenant' THEN
    DELETE FROM sesion WHERE usuario_id = p_usuario AND tenant_id = app_tenant();
  ELSIF app_role() IN ('auth', 'super_admin') THEN
    DELETE FROM sesion WHERE usuario_id = p_usuario;
  ELSE
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION revocar_sesiones_usuario(uuid) FROM PUBLIC;
