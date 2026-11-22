-- Cambio de administrador: degradar al admin_junta vigente a socio.
-- Una política RLS no sirve aquí: PostgreSQL exige que la fila resultante (socio) sea visible para el
-- super_admin, lo que expondría a todos los socios. Se usa una función SECURITY DEFINER mínima que
-- solo actúa para el super_admin y solo sobre una fila que hoy es admin_junta de la junta indicada.
CREATE FUNCTION degradar_administrador(p_junta uuid, p_usuario uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF app_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  UPDATE usuario
     SET rol = 'socio'
   WHERE id = p_usuario AND tenant_id = p_junta AND rol = 'admin_junta';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Administrador no encontrado' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION degradar_administrador(uuid, uuid) FROM PUBLIC;
