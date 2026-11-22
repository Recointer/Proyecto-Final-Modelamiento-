import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Debe mantenerse alineado con drizzle/0000_init.sql y specs/001-gestion-plataforma/data-model.md

export const tipoJunta = pgEnum("tipo_junta", [
  "riego",
  "agua_potable",
  "parroquial",
  "barrial",
  "otra",
]);
export const estadoJunta = pgEnum("estado_junta", ["activa", "desactivada"]);
export const rolUsuario = pgEnum("rol_usuario", [
  "super_admin",
  "admin_junta",
  "secretario",
  "tesorero",
  "socio",
]);
export const estadoUsuario = pgEnum("estado_usuario", ["activo", "desactivado"]);

export const junta = pgTable("junta", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  nombre: text("nombre").notNull(),
  tipo: tipoJunta("tipo").notNull(),
  provincia: text("provincia").notNull(),
  canton: text("canton").notNull(),
  parroquia: text("parroquia").notNull(),
  contactoNombre: text("contacto_nombre"),
  contactoTelefono: text("contacto_telefono"),
  contactoCorreo: text("contacto_correo"),
  parametros: jsonb("parametros").$type<Record<string, unknown>>().notNull().default({}),
  estado: estadoJunta("estado").notNull().default("activa"),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
  actualizadaEn: timestamp("actualizada_en", { withTimezone: true }).notNull().defaultNow(),
});

export const usuario = pgTable("usuario", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => junta.id),
  cedula: text("cedula").notNull(),
  nombres: text("nombres").notNull(),
  correo: text("correo"),
  telefono: text("telefono"),
  rol: rolUsuario("rol").notNull(),
  estado: estadoUsuario("estado").notNull().default("activo"),
  passwordHash: text("password_hash").notNull(),
  debeCambiarPassword: boolean("debe_cambiar_password").notNull().default(false),
  intentosFallidos: integer("intentos_fallidos").notNull().default(0),
  bloqueadoHasta: timestamp("bloqueado_hasta", { withTimezone: true }),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const sector = pgTable("sector", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => junta.id),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion"),
});

export const designacionAdministrador = pgTable("designacion_administrador", {
  id: uuid("id").primaryKey().defaultRandom(),
  juntaId: uuid("junta_id")
    .notNull()
    .references(() => junta.id),
  usuarioId: uuid("usuario_id")
    .notNull()
    .references(() => usuario.id),
  actaRuta: text("acta_ruta").notNull(),
  motivo: text("motivo"),
  designadoPor: uuid("designado_por")
    .notNull()
    .references(() => usuario.id),
  vigente: boolean("vigente").notNull().default(true),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
});

export const sesion = pgTable("sesion", {
  id: uuid("id").primaryKey().defaultRandom(),
  usuarioId: uuid("usuario_id")
    .notNull()
    .references(() => usuario.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").references(() => junta.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiraEn: timestamp("expira_en", { withTimezone: true }).notNull(),
  recordar: boolean("recordar").notNull().default(false),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
});

export const tokenRecuperacion = pgTable("token_recuperacion", {
  id: uuid("id").primaryKey().defaultRandom(),
  usuarioId: uuid("usuario_id")
    .notNull()
    .references(() => usuario.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiraEn: timestamp("expira_en", { withTimezone: true }).notNull(),
  usadoEn: timestamp("usado_en", { withTimezone: true }),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id"),
  tenantId: uuid("tenant_id"),
  accion: text("accion").notNull(),
  entidad: text("entidad").notNull(),
  entidadId: uuid("entidad_id"),
  antes: jsonb("antes"),
  despues: jsonb("despues"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export type Rol = (typeof rolUsuario.enumValues)[number];
export type Usuario = typeof usuario.$inferSelect;
export type Junta = typeof junta.$inferSelect;
