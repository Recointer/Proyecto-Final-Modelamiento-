-- Cifras agregadas de eventos para el panel del Super Administrador.
-- El super_admin no puede leer filas de las juntas (Principio I); estas funciones SECURITY DEFINER
-- solo devuelven conteos, sin títulos, lugares ni identificar la junta.

CREATE FUNCTION total_eventos_plataforma() RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n integer;
BEGIN
  IF app_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  SELECT count(*)::integer INTO n FROM evento WHERE estado = 'activo';
  RETURN n;
END;
$$;

-- evento.fecha ya es una fecha de calendario (hora local de la junta): no requiere conversión de zona
CREATE FUNCTION eventos_plataforma_por_dia(p_anio integer, p_mes integer)
RETURNS TABLE (dia integer, total integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF app_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_mes NOT BETWEEN 1 AND 12 OR p_anio NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'Mes o año no válido' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT extract(day FROM e.fecha)::integer, count(*)::integer
      FROM evento e
     WHERE e.estado = 'activo'
       AND e.fecha >= make_date(p_anio, p_mes, 1)
       AND e.fecha < (make_date(p_anio, p_mes, 1) + interval '1 month')::date
     GROUP BY 1
     ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION total_eventos_plataforma() FROM PUBLIC;
REVOKE ALL ON FUNCTION eventos_plataforma_por_dia(integer, integer) FROM PUBLIC;
