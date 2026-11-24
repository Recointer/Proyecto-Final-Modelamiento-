-- Módulo de Gestión de Comunicaciones (specs/004-gestion-comunicaciones/data-model.md)
-- Las tablas no se borran ni se editan: la aplicación solo recibe permisos de columna (ver migrate.ts).

CREATE TYPE tipo_documento AS ENUM ('acta_asamblea', 'acta_directiva', 'resolucion');
CREATE TYPE estado_registro AS ENUM ('vigente', 'anulado');

-- usuario pasa a poder referenciarse con clave compuesta (la conversación no puede apuntar a otra junta)
ALTER TABLE usuario ADD CONSTRAINT usuario_id_tenant_uq UNIQUE (id, tenant_id);

CREATE TABLE convocatoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  tipo tipo_evento NOT NULL,
  titulo text NOT NULL CHECK (char_length(titulo) BETWEEN 3 AND 150),
  fecha date NOT NULL,
  hora time NOT NULL,
  lugar text NOT NULL CHECK (char_length(lugar) BETWEEN 1 AND 150),
  orden_dia text CHECK (orden_dia IS NULL OR char_length(orden_dia) <= 2000),
  evento_id uuid,
  estado estado_registro NOT NULL DEFAULT 'vigente',
  anulado_por uuid REFERENCES usuario (id),
  anulado_en timestamptz,
  motivo_anulacion text CHECK (motivo_anulacion IS NULL OR char_length(motivo_anulacion) BETWEEN 1 AND 300),
  notificados integer NOT NULL DEFAULT 0 CHECK (notificados >= 0),
  creado_por uuid NOT NULL REFERENCES usuario (id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT convocatoria_id_tenant_uq UNIQUE (id, tenant_id),
  CONSTRAINT convocatoria_anulacion_ck CHECK (
    (estado = 'anulado') = (anulado_por IS NOT NULL AND anulado_en IS NOT NULL AND motivo_anulacion IS NOT NULL)
  ),
  CONSTRAINT convocatoria_evento_fk FOREIGN KEY (evento_id, tenant_id) REFERENCES evento (id, tenant_id)
);
CREATE INDEX convocatoria_fecha_idx ON convocatoria (tenant_id, fecha DESC);

CREATE TABLE documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  tipo tipo_documento NOT NULL,
  titulo text NOT NULL CHECK (char_length(titulo) BETWEEN 3 AND 150),
  fecha date NOT NULL,
  descripcion text CHECK (descripcion IS NULL OR char_length(descripcion) <= 500),
  archivo_ruta text NOT NULL,
  publicado boolean NOT NULL DEFAULT false,
  estado estado_registro NOT NULL DEFAULT 'vigente',
  anulado_por uuid REFERENCES usuario (id),
  anulado_en timestamptz,
  motivo_anulacion text CHECK (motivo_anulacion IS NULL OR char_length(motivo_anulacion) BETWEEN 1 AND 300),
  creado_por uuid NOT NULL REFERENCES usuario (id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documento_id_tenant_uq UNIQUE (id, tenant_id),
  CONSTRAINT documento_anulacion_ck CHECK (
    (estado = 'anulado') = (anulado_por IS NOT NULL AND anulado_en IS NOT NULL AND motivo_anulacion IS NOT NULL)
  )
);
CREATE INDEX documento_fecha_idx ON documento (tenant_id, fecha DESC);

CREATE TABLE comunicacion_recibida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  institucion text NOT NULL CHECK (char_length(institucion) BETWEEN 2 AND 120),
  asunto text NOT NULL CHECK (char_length(asunto) BETWEEN 3 AND 200),
  referencia text CHECK (referencia IS NULL OR char_length(referencia) <= 60),
  fecha_recepcion date NOT NULL,
  resumen text NOT NULL CHECK (char_length(resumen) BETWEEN 1 AND 2000),
  archivo_ruta text,
  publicada boolean NOT NULL DEFAULT false,
  estado estado_registro NOT NULL DEFAULT 'vigente',
  anulado_por uuid REFERENCES usuario (id),
  anulado_en timestamptz,
  motivo_anulacion text CHECK (motivo_anulacion IS NULL OR char_length(motivo_anulacion) BETWEEN 1 AND 300),
  creado_por uuid NOT NULL REFERENCES usuario (id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comunicacion_id_tenant_uq UNIQUE (id, tenant_id),
  CONSTRAINT comunicacion_anulacion_ck CHECK (
    (estado = 'anulado') = (anulado_por IS NOT NULL AND anulado_en IS NOT NULL AND motivo_anulacion IS NOT NULL)
  )
);
CREATE INDEX comunicacion_fecha_idx ON comunicacion_recibida (tenant_id, fecha_recepcion DESC);

CREATE TABLE hilo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  usuario_id uuid NOT NULL,
  asunto text NOT NULL CHECK (char_length(asunto) BETWEEN 3 AND 150),
  iniciado_por_admin boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  ultimo_mensaje_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hilo_id_tenant_uq UNIQUE (id, tenant_id),
  CONSTRAINT hilo_usuario_fk FOREIGN KEY (usuario_id, tenant_id) REFERENCES usuario (id, tenant_id)
);
CREATE INDEX hilo_usuario_idx ON hilo (usuario_id, ultimo_mensaje_en DESC);
CREATE INDEX hilo_tenant_idx ON hilo (tenant_id, ultimo_mensaje_en DESC);

CREATE TABLE mensaje (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  hilo_id uuid NOT NULL,
  autor_id uuid NOT NULL REFERENCES usuario (id),
  de_administracion boolean NOT NULL,
  texto text NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 2000),
  creado_en timestamptz NOT NULL DEFAULT now(),
  leido_en timestamptz,
  CONSTRAINT mensaje_hilo_fk FOREIGN KEY (hilo_id, tenant_id) REFERENCES hilo (id, tenant_id)
);
CREATE INDEX mensaje_hilo_idx ON mensaje (hilo_id, creado_en);
CREATE INDEX mensaje_no_leido_idx ON mensaje (tenant_id, de_administracion) WHERE leido_en IS NULL;
