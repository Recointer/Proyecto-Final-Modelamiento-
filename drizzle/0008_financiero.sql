-- Módulo de Gestión Financiera (specs/003-gestion-financiera/data-model.md)
-- Importes en numeric(12,2). Los registros financieros no se borran: se anulan con motivo.
-- Las reglas de dinero (saldo, consecutivo, stock) las garantiza la base de datos.

CREATE TYPE tipo_concepto AS ENUM ('cuota', 'servicio', 'multa');
CREATE TYPE estado_concepto AS ENUM ('activo', 'inactivo');
CREATE TYPE forma_pago AS ENUM ('efectivo', 'transferencia', 'deposito');
CREATE TYPE categoria_egreso AS ENUM ('compras', 'trabajos', 'honorarios', 'tasas', 'otros');
CREATE TYPE tipo_movimiento AS ENUM ('entrada', 'salida');
CREATE TYPE estado_material AS ENUM ('activo', 'inactivo');
CREATE TYPE estado_activo AS ENUM ('vigente', 'baja');

-- ---------------------------------------------------------------------------------------------
-- concepto_cobro
-- ---------------------------------------------------------------------------------------------
CREATE TABLE concepto_cobro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  nombre text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 100),
  tipo tipo_concepto NOT NULL,
  monto_defecto numeric(12, 2) NOT NULL DEFAULT 0 CHECK (monto_defecto >= 0),
  estado estado_concepto NOT NULL DEFAULT 'activo',
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT concepto_id_tenant_uq UNIQUE (id, tenant_id)
);
CREATE UNIQUE INDEX concepto_tenant_nombre_uq ON concepto_cobro (tenant_id, lower(nombre));

-- ---------------------------------------------------------------------------------------------
-- cargo (cuenta por cobrar de un socio)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE cargo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  concepto_id uuid NOT NULL,
  socio_id uuid NOT NULL,
  anio smallint NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
  monto numeric(12, 2) NOT NULL CHECK (monto > 0),
  vence date,
  evento_id uuid,
  anulado_en timestamptz,
  anulado_por uuid REFERENCES usuario (id),
  motivo_anulacion text CHECK (motivo_anulacion IS NULL OR char_length(motivo_anulacion) BETWEEN 1 AND 300),
  creado_por uuid NOT NULL REFERENCES usuario (id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cargo_id_tenant_uq UNIQUE (id, tenant_id),
  CONSTRAINT cargo_anulacion_ck CHECK (
    (anulado_en IS NULL) = (anulado_por IS NULL) AND (anulado_en IS NULL) = (motivo_anulacion IS NULL)
  ),
  CONSTRAINT cargo_concepto_fk FOREIGN KEY (concepto_id, tenant_id) REFERENCES concepto_cobro (id, tenant_id),
  CONSTRAINT cargo_socio_fk FOREIGN KEY (socio_id, tenant_id) REFERENCES socio (id, tenant_id),
  CONSTRAINT cargo_evento_fk FOREIGN KEY (evento_id, tenant_id) REFERENCES evento (id, tenant_id)
);
-- un solo cargo vigente por socio, año y concepto (las multas se identifican por evento)
CREATE UNIQUE INDEX cargo_cuota_uq ON cargo (tenant_id, concepto_id, socio_id, anio)
  WHERE anulado_en IS NULL AND evento_id IS NULL;
CREATE UNIQUE INDEX cargo_multa_uq ON cargo (evento_id, socio_id)
  WHERE anulado_en IS NULL AND evento_id IS NOT NULL;
CREATE INDEX cargo_socio_idx ON cargo (socio_id);
CREATE INDEX cargo_anio_idx ON cargo (tenant_id, anio);

-- ---------------------------------------------------------------------------------------------
-- pago (el comprobante es el pago numerado) y contador por junta
-- ---------------------------------------------------------------------------------------------
CREATE TABLE contador_comprobante (
  tenant_id uuid PRIMARY KEY REFERENCES junta (id),
  ultimo integer NOT NULL DEFAULT 0
);

CREATE TABLE pago (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  cargo_id uuid NOT NULL,
  numero integer NOT NULL,
  monto numeric(12, 2) NOT NULL CHECK (monto > 0),
  fecha date NOT NULL,
  forma forma_pago NOT NULL,
  referencia text CHECK (referencia IS NULL OR char_length(referencia) <= 80),
  anulado_en timestamptz,
  anulado_por uuid REFERENCES usuario (id),
  motivo_anulacion text CHECK (motivo_anulacion IS NULL OR char_length(motivo_anulacion) BETWEEN 1 AND 300),
  creado_por uuid NOT NULL REFERENCES usuario (id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pago_id_tenant_uq UNIQUE (id, tenant_id),
  CONSTRAINT pago_numero_uq UNIQUE (tenant_id, numero),
  CONSTRAINT pago_anulacion_ck CHECK (
    (anulado_en IS NULL) = (anulado_por IS NULL) AND (anulado_en IS NULL) = (motivo_anulacion IS NULL)
  ),
  CONSTRAINT pago_cargo_fk FOREIGN KEY (cargo_id, tenant_id) REFERENCES cargo (id, tenant_id)
);
CREATE INDEX pago_cargo_idx ON pago (cargo_id);
CREATE INDEX pago_fecha_idx ON pago (tenant_id, fecha);

-- Antes de insertar: bloquea el cargo, verifica que no exceda el saldo y asigna el consecutivo.
CREATE FUNCTION pago_antes_insertar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  c cargo%ROWTYPE;
  pagado numeric(12, 2);
BEGIN
  SELECT * INTO c FROM cargo WHERE id = NEW.cargo_id AND tenant_id = NEW.tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El cargo no existe' USING ERRCODE = '23503', CONSTRAINT = 'pago_cargo_fk';
  END IF;
  IF c.anulado_en IS NOT NULL THEN
    RAISE EXCEPTION 'El cargo está anulado' USING ERRCODE = '23514', CONSTRAINT = 'pago_cargo_anulado';
  END IF;
  IF NEW.anulado_en IS NOT NULL THEN
    RAISE EXCEPTION 'Un pago nuevo no puede nacer anulado' USING ERRCODE = '23514', CONSTRAINT = 'pago_nace_anulado';
  END IF;
  SELECT coalesce(sum(monto), 0) INTO pagado FROM pago WHERE cargo_id = NEW.cargo_id AND anulado_en IS NULL;
  IF pagado + NEW.monto > c.monto THEN
    RAISE EXCEPTION 'El pago excede el saldo del cargo' USING ERRCODE = '23514', CONSTRAINT = 'pago_excede_saldo';
  END IF;
  INSERT INTO contador_comprobante (tenant_id, ultimo) VALUES (NEW.tenant_id, 1)
    ON CONFLICT (tenant_id) DO UPDATE SET ultimo = contador_comprobante.ultimo + 1
    RETURNING ultimo INTO NEW.numero;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pago_insertar BEFORE INSERT ON pago FOR EACH ROW EXECUTE FUNCTION pago_antes_insertar();

-- Un pago solo puede pasar de vigente a anulado; nada más cambia.
CREATE FUNCTION pago_antes_actualizar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.anulado_en IS NOT NULL
     OR (NEW.tenant_id, NEW.cargo_id, NEW.numero, NEW.monto, NEW.fecha, NEW.forma, NEW.referencia, NEW.creado_por, NEW.creado_en)
        IS DISTINCT FROM
        (OLD.tenant_id, OLD.cargo_id, OLD.numero, OLD.monto, OLD.fecha, OLD.forma, OLD.referencia, OLD.creado_por, OLD.creado_en) THEN
    RAISE EXCEPTION 'Un pago registrado no se modifica; solo puede anularse' USING ERRCODE = '23514', CONSTRAINT = 'pago_inmutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER pago_actualizar BEFORE UPDATE ON pago FOR EACH ROW EXECUTE FUNCTION pago_antes_actualizar();

-- Un cargo solo puede anularse (sin pagos vigentes); sus datos no cambian.
CREATE FUNCTION cargo_antes_actualizar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.anulado_en IS NOT NULL
     OR (NEW.tenant_id, NEW.concepto_id, NEW.socio_id, NEW.anio, NEW.monto, NEW.vence, NEW.evento_id, NEW.creado_por, NEW.creado_en)
        IS DISTINCT FROM
        (OLD.tenant_id, OLD.concepto_id, OLD.socio_id, OLD.anio, OLD.monto, OLD.vence, OLD.evento_id, OLD.creado_por, OLD.creado_en) THEN
    RAISE EXCEPTION 'Un cargo emitido no se modifica; solo puede anularse' USING ERRCODE = '23514', CONSTRAINT = 'cargo_inmutable';
  END IF;
  IF NEW.anulado_en IS NOT NULL AND EXISTS (SELECT 1 FROM pago WHERE cargo_id = OLD.id AND anulado_en IS NULL) THEN
    RAISE EXCEPTION 'El cargo tiene pagos vigentes' USING ERRCODE = '23514', CONSTRAINT = 'cargo_con_pagos';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER cargo_actualizar BEFORE UPDATE ON cargo FOR EACH ROW EXECUTE FUNCTION cargo_antes_actualizar();

-- ---------------------------------------------------------------------------------------------
-- egreso
-- ---------------------------------------------------------------------------------------------
CREATE TABLE egreso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  fecha date NOT NULL,
  categoria categoria_egreso NOT NULL,
  descripcion text NOT NULL CHECK (char_length(descripcion) BETWEEN 3 AND 300),
  beneficiario text NOT NULL CHECK (char_length(beneficiario) BETWEEN 2 AND 120),
  monto numeric(12, 2) NOT NULL CHECK (monto > 0),
  respaldo_ruta text,
  anulado_en timestamptz,
  anulado_por uuid REFERENCES usuario (id),
  motivo_anulacion text CHECK (motivo_anulacion IS NULL OR char_length(motivo_anulacion) BETWEEN 1 AND 300),
  creado_por uuid NOT NULL REFERENCES usuario (id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT egreso_id_tenant_uq UNIQUE (id, tenant_id),
  CONSTRAINT egreso_anulacion_ck CHECK (
    (anulado_en IS NULL) = (anulado_por IS NULL) AND (anulado_en IS NULL) = (motivo_anulacion IS NULL)
  )
);
CREATE INDEX egreso_fecha_idx ON egreso (tenant_id, fecha DESC);

CREATE FUNCTION egreso_antes_actualizar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.anulado_en IS NOT NULL
     OR (NEW.tenant_id, NEW.fecha, NEW.categoria, NEW.descripcion, NEW.beneficiario, NEW.monto, NEW.respaldo_ruta, NEW.creado_por, NEW.creado_en)
        IS DISTINCT FROM
        (OLD.tenant_id, OLD.fecha, OLD.categoria, OLD.descripcion, OLD.beneficiario, OLD.monto, OLD.respaldo_ruta, OLD.creado_por, OLD.creado_en) THEN
    RAISE EXCEPTION 'Un egreso registrado no se modifica; solo puede anularse' USING ERRCODE = '23514', CONSTRAINT = 'egreso_inmutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER egreso_actualizar BEFORE UPDATE ON egreso FOR EACH ROW EXECUTE FUNCTION egreso_antes_actualizar();

-- ---------------------------------------------------------------------------------------------
-- inventario
-- ---------------------------------------------------------------------------------------------
CREATE TABLE material (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  nombre text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 100),
  unidad text NOT NULL CHECK (char_length(unidad) BETWEEN 1 AND 20),
  stock numeric(12, 2) NOT NULL DEFAULT 0 CONSTRAINT material_stock_ck CHECK (stock >= 0),
  minimo numeric(12, 2) NOT NULL DEFAULT 0 CHECK (minimo >= 0),
  estado estado_material NOT NULL DEFAULT 'activo',
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_id_tenant_uq UNIQUE (id, tenant_id)
);
CREATE UNIQUE INDEX material_tenant_nombre_uq ON material (tenant_id, lower(nombre));

CREATE TABLE movimiento_material (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  material_id uuid NOT NULL,
  tipo tipo_movimiento NOT NULL,
  cantidad numeric(12, 2) NOT NULL CHECK (cantidad > 0),
  motivo text NOT NULL CHECK (char_length(motivo) BETWEEN 3 AND 200),
  creado_por uuid NOT NULL REFERENCES usuario (id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT movimiento_material_fk FOREIGN KEY (material_id, tenant_id) REFERENCES material (id, tenant_id)
);
CREATE INDEX movimiento_material_idx ON movimiento_material (material_id, creado_en DESC);

-- ---------------------------------------------------------------------------------------------
-- activo fijo
-- ---------------------------------------------------------------------------------------------
CREATE TABLE activo_fijo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  codigo text NOT NULL CHECK (char_length(codigo) BETWEEN 2 AND 20),
  nombre text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 120),
  fecha_adquisicion date NOT NULL,
  valor numeric(12, 2) NOT NULL CHECK (valor >= 0),
  ubicacion text NOT NULL CHECK (char_length(ubicacion) BETWEEN 1 AND 120),
  estado estado_activo NOT NULL DEFAULT 'vigente',
  motivo_baja text CHECK (motivo_baja IS NULL OR char_length(motivo_baja) BETWEEN 1 AND 300),
  baja_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activo_id_tenant_uq UNIQUE (id, tenant_id),
  CONSTRAINT activo_baja_ck CHECK ((estado = 'baja') = (motivo_baja IS NOT NULL AND baja_en IS NOT NULL))
);
CREATE UNIQUE INDEX activo_tenant_codigo_uq ON activo_fijo (tenant_id, lower(codigo));

-- ---------------------------------------------------------------------------------------------
-- Los registros financieros no se borran desde la aplicación (Principio IV).
-- Se permite solo sin contexto de aplicación (mantenimiento y limpieza de pruebas con el rol administrador).
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION prohibir_borrado_financiero() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF app_role() <> '' THEN
    RAISE EXCEPTION 'Los registros financieros no se eliminan; solo se anulan' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER concepto_no_borrar BEFORE DELETE ON concepto_cobro FOR EACH ROW EXECUTE FUNCTION prohibir_borrado_financiero();
CREATE TRIGGER cargo_no_borrar BEFORE DELETE ON cargo FOR EACH ROW EXECUTE FUNCTION prohibir_borrado_financiero();
CREATE TRIGGER pago_no_borrar BEFORE DELETE ON pago FOR EACH ROW EXECUTE FUNCTION prohibir_borrado_financiero();
CREATE TRIGGER egreso_no_borrar BEFORE DELETE ON egreso FOR EACH ROW EXECUTE FUNCTION prohibir_borrado_financiero();
CREATE TRIGGER material_no_borrar BEFORE DELETE ON material FOR EACH ROW EXECUTE FUNCTION prohibir_borrado_financiero();
CREATE TRIGGER movimiento_no_borrar BEFORE DELETE ON movimiento_material FOR EACH ROW EXECUTE FUNCTION prohibir_borrado_financiero();
CREATE TRIGGER activo_no_borrar BEFORE DELETE ON activo_fijo FOR EACH ROW EXECUTE FUNCTION prohibir_borrado_financiero();

-- ---------------------------------------------------------------------------------------------
-- Vista de saldos: no hay columnas derivadas que sincronizar. security_invoker: aplica el RLS del invocador.
-- ---------------------------------------------------------------------------------------------
CREATE VIEW cargo_saldo WITH (security_invoker = true) AS
SELECT
  c.id, c.tenant_id, c.concepto_id, c.socio_id, c.anio, c.monto, c.vence, c.evento_id,
  c.anulado_en, c.anulado_por, c.motivo_anulacion, c.creado_por, c.creado_en,
  coalesce(p.pagado, 0)::numeric(12, 2) AS pagado,
  (c.monto - coalesce(p.pagado, 0))::numeric(12, 2) AS saldo,
  CASE
    WHEN c.anulado_en IS NOT NULL THEN 'anulado'
    WHEN coalesce(p.pagado, 0) >= c.monto THEN 'pagado'
    WHEN coalesce(p.pagado, 0) > 0 THEN 'parcial'
    ELSE 'pendiente'
  END AS estado,
  (c.anulado_en IS NULL AND c.vence IS NOT NULL AND coalesce(p.pagado, 0) < c.monto
     AND c.vence < (now() AT TIME ZONE 'America/Guayaquil')::date) AS vencido
FROM cargo c
LEFT JOIN LATERAL (
  SELECT sum(pg.monto) AS pagado FROM pago pg WHERE pg.cargo_id = c.id AND pg.anulado_en IS NULL
) p ON true;

-- ---------------------------------------------------------------------------------------------
-- Cifra agregada para el Super Administrador (sin montos ni datos de la junta)
-- ---------------------------------------------------------------------------------------------
CREATE FUNCTION total_pagos_plataforma() RETURNS integer
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
  SELECT count(*)::integer INTO n FROM pago WHERE anulado_en IS NULL;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION total_pagos_plataforma() FROM PUBLIC;
