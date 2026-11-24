-- Módulo de Gestión Administrativa (specs/002-gestion-administrativa/data-model.md)
-- Cada tabla referenciada declara UNIQUE (id, tenant_id) y las referencias son claves foráneas
-- compuestas (x_id, tenant_id): la base de datos impide que un registro apunte a otra junta.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- sector pasa a poder referenciarse con clave compuesta
ALTER TABLE sector ADD CONSTRAINT sector_id_tenant_uq UNIQUE (id, tenant_id);

CREATE TYPE estado_socio AS ENUM ('activo', 'inactivo');
CREATE TYPE tipo_evento AS ENUM ('asamblea', 'minga');
CREATE TYPE estado_evento AS ENUM ('activo', 'anulado');
CREATE TYPE estado_asistencia AS ENUM ('presente', 'ausente', 'justificado');
CREATE TYPE estado_predio AS ENUM ('activo', 'inactivo');
CREATE TYPE tipo_servicio AS ENUM ('agua_riego', 'agua_potable', 'espacio_comunal', 'maquinaria', 'otro');
CREATE TYPE estado_servicio AS ENUM ('activo', 'inactivo');

-- ---------------------------------------------------------------------------------------------
-- socio (padrón)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE socio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  cedula text NOT NULL CHECK (cedula ~ '^[0-9]{10}$'),
  nombres text NOT NULL CHECK (char_length(nombres) BETWEEN 3 AND 120),
  sector_id uuid NOT NULL,
  telefono text CHECK (telefono IS NULL OR char_length(telefono) <= 30),
  correo text CHECK (correo IS NULL OR char_length(correo) <= 160),
  estado estado_socio NOT NULL DEFAULT 'activo',
  fecha_ingreso date NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT socio_id_tenant_uq UNIQUE (id, tenant_id),
  CONSTRAINT socio_tenant_cedula_uq UNIQUE (tenant_id, cedula),
  CONSTRAINT socio_sector_fk FOREIGN KEY (sector_id, tenant_id)
    REFERENCES sector (id, tenant_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX socio_tenant_correo_uq ON socio (tenant_id, lower(correo)) WHERE correo IS NOT NULL;
CREATE INDEX socio_nombres_idx ON socio (tenant_id, lower(nombres));
CREATE INDEX socio_estado_sector_idx ON socio (tenant_id, estado, sector_id);

-- ---------------------------------------------------------------------------------------------
-- evento (asambleas y mingas); no se eliminan: se anulan con motivo
-- ---------------------------------------------------------------------------------------------
CREATE TABLE evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  tipo tipo_evento NOT NULL,
  titulo text NOT NULL CHECK (char_length(titulo) BETWEEN 3 AND 150),
  fecha date NOT NULL,
  lugar text NOT NULL CHECK (char_length(lugar) BETWEEN 1 AND 150),
  estado estado_evento NOT NULL DEFAULT 'activo',
  motivo_anulacion text CHECK (motivo_anulacion IS NULL OR char_length(motivo_anulacion) <= 500),
  anulado_por uuid REFERENCES usuario (id),
  anulado_en timestamptz,
  asistencia_registrada_en timestamptz,
  creado_por uuid NOT NULL REFERENCES usuario (id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evento_id_tenant_uq UNIQUE (id, tenant_id),
  CONSTRAINT evento_anulacion_ck CHECK (
    (estado = 'anulado') = (motivo_anulacion IS NOT NULL AND anulado_por IS NOT NULL AND anulado_en IS NOT NULL)
  )
);

CREATE INDEX evento_fecha_idx ON evento (tenant_id, fecha DESC);

-- ---------------------------------------------------------------------------------------------
-- asistencia (socio x evento); se corrige el estado, no se elimina
-- ---------------------------------------------------------------------------------------------
CREATE TABLE asistencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  evento_id uuid NOT NULL,
  socio_id uuid NOT NULL,
  estado estado_asistencia NOT NULL,
  motivo text CHECK (motivo IS NULL OR char_length(motivo) <= 300),
  registrado_por uuid NOT NULL REFERENCES usuario (id),
  registrado_en timestamptz NOT NULL DEFAULT now(),
  modificado_por uuid NOT NULL REFERENCES usuario (id),
  modificado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asistencia_evento_socio_uq UNIQUE (evento_id, socio_id),
  CONSTRAINT asistencia_motivo_ck CHECK (estado <> 'justificado' OR (motivo IS NOT NULL AND char_length(btrim(motivo)) > 0)),
  CONSTRAINT asistencia_evento_fk FOREIGN KEY (evento_id, tenant_id) REFERENCES evento (id, tenant_id),
  CONSTRAINT asistencia_socio_fk FOREIGN KEY (socio_id, tenant_id) REFERENCES socio (id, tenant_id)
);

CREATE INDEX asistencia_socio_idx ON asistencia (socio_id);
CREATE INDEX asistencia_evento_idx ON asistencia (evento_id);

-- ---------------------------------------------------------------------------------------------
-- predio / recurso
-- ---------------------------------------------------------------------------------------------
CREATE TABLE predio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  codigo text NOT NULL CHECK (char_length(codigo) BETWEEN 2 AND 20),
  nombre text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 120),
  superficie_ha numeric(10, 4) NOT NULL CHECK (superficie_ha > 0),
  sector_id uuid NOT NULL,
  socio_id uuid NOT NULL,
  latitud numeric(9, 6) CHECK (latitud BETWEEN -90 AND 90),
  longitud numeric(9, 6) CHECK (longitud BETWEEN -180 AND 180),
  imagen_ruta text,
  estado estado_predio NOT NULL DEFAULT 'activo',
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT predio_id_tenant_uq UNIQUE (id, tenant_id),
  CONSTRAINT predio_coordenadas_ck CHECK ((latitud IS NULL) = (longitud IS NULL)),
  CONSTRAINT predio_sector_fk FOREIGN KEY (sector_id, tenant_id) REFERENCES sector (id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT predio_socio_fk FOREIGN KEY (socio_id, tenant_id) REFERENCES socio (id, tenant_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX predio_tenant_codigo_uq ON predio (tenant_id, lower(codigo));
CREATE INDEX predio_sector_idx ON predio (tenant_id, sector_id);
CREATE INDEX predio_socio_idx ON predio (socio_id);

-- ---------------------------------------------------------------------------------------------
-- servicio y turno (calendario semanal)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE servicio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  nombre text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 100),
  tipo tipo_servicio NOT NULL,
  estado estado_servicio NOT NULL DEFAULT 'activo',
  CONSTRAINT servicio_id_tenant_uq UNIQUE (id, tenant_id)
);

CREATE UNIQUE INDEX servicio_tenant_nombre_uq ON servicio (tenant_id, lower(nombre));

CREATE TABLE turno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  servicio_id uuid NOT NULL,
  sector_id uuid NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  CONSTRAINT turno_horario_ck CHECK (hora_fin > hora_inicio),
  CONSTRAINT turno_servicio_fk FOREIGN KEY (servicio_id, tenant_id) REFERENCES servicio (id, tenant_id),
  CONSTRAINT turno_sector_fk FOREIGN KEY (sector_id, tenant_id) REFERENCES sector (id, tenant_id) ON DELETE RESTRICT,
  -- sin solapamientos para el mismo servicio, sector y día (rangos [inicio, fin): los contiguos son válidos)
  CONSTRAINT turno_sin_solape EXCLUDE USING gist (
    servicio_id WITH =,
    sector_id WITH =,
    dia_semana WITH =,
    tsrange(('2000-01-01'::date + hora_inicio), ('2000-01-01'::date + hora_fin), '[)') WITH &&
  )
);

CREATE INDEX turno_servicio_idx ON turno (tenant_id, servicio_id);
