-- Migración inicial: tablas del módulo de Plataforma (ver specs/001-gestion-plataforma/data-model.md)

CREATE TYPE tipo_junta AS ENUM ('riego', 'agua_potable', 'parroquial', 'barrial', 'otra');
CREATE TYPE estado_junta AS ENUM ('activa', 'desactivada');
CREATE TYPE rol_usuario AS ENUM ('super_admin', 'admin_junta', 'secretario', 'tesorero', 'socio');
CREATE TYPE estado_usuario AS ENUM ('activo', 'desactivado');

CREATE TABLE junta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre text NOT NULL,
  tipo tipo_junta NOT NULL,
  provincia text NOT NULL,
  canton text NOT NULL,
  parroquia text NOT NULL,
  contacto_nombre text,
  contacto_telefono text,
  contacto_correo text,
  parametros jsonb NOT NULL DEFAULT '{}'::jsonb,
  estado estado_junta NOT NULL DEFAULT 'activa',
  creada_en timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX junta_nombre_parroquia_uq ON junta (lower(nombre), lower(parroquia));

CREATE TABLE usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES junta (id),
  cedula text NOT NULL CHECK (cedula ~ '^[0-9]{10}$'),
  nombres text NOT NULL,
  correo text,
  telefono text,
  rol rol_usuario NOT NULL,
  estado estado_usuario NOT NULL DEFAULT 'activo',
  password_hash text NOT NULL,
  debe_cambiar_password boolean NOT NULL DEFAULT false,
  intentos_fallidos integer NOT NULL DEFAULT 0,
  bloqueado_hasta timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  -- solo el super_admin carece de junta
  CONSTRAINT usuario_tenant_rol_ck CHECK ((rol = 'super_admin') = (tenant_id IS NULL))
);

CREATE UNIQUE INDEX usuario_cedula_tenant_uq
  ON usuario (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), cedula);
CREATE UNIQUE INDEX usuario_correo_tenant_uq
  ON usuario (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(correo))
  WHERE correo IS NOT NULL;
CREATE UNIQUE INDEX usuario_un_admin_activo_uq
  ON usuario (tenant_id) WHERE rol = 'admin_junta' AND estado = 'activo';
CREATE INDEX usuario_cedula_idx ON usuario (cedula);
CREATE INDEX usuario_correo_idx ON usuario (lower(correo));

CREATE TABLE sector (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES junta (id),
  nombre text NOT NULL,
  descripcion text
);

CREATE UNIQUE INDEX sector_nombre_tenant_uq ON sector (tenant_id, lower(nombre));

CREATE TABLE designacion_administrador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  junta_id uuid NOT NULL REFERENCES junta (id),
  usuario_id uuid NOT NULL REFERENCES usuario (id),
  acta_ruta text NOT NULL,
  motivo text,
  designado_por uuid NOT NULL REFERENCES usuario (id),
  vigente boolean NOT NULL DEFAULT true,
  creada_en timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX designacion_vigente_uq ON designacion_administrador (junta_id) WHERE vigente;

CREATE TABLE sesion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES junta (id),
  token_hash text NOT NULL UNIQUE,
  expira_en timestamptz NOT NULL,
  recordar boolean NOT NULL DEFAULT false,
  creada_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sesion_usuario_idx ON sesion (usuario_id);
CREATE INDEX sesion_tenant_idx ON sesion (tenant_id);

CREATE TABLE token_recuperacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expira_en timestamptz NOT NULL,
  usado_en timestamptz
);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  tenant_id uuid,
  accion text NOT NULL,
  entidad text NOT NULL,
  entidad_id uuid,
  antes jsonb,
  despues jsonb,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_tenant_idx ON audit_log (tenant_id, creado_en DESC);
