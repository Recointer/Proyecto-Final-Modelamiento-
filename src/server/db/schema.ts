import {
  boolean,
  date,
  numeric,
  smallint,
  time,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  pgView,
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

// ---------------------------------------------------------------------------------------------
// Módulo de Gestión Administrativa (drizzle/0005_administrativo.sql)
// Las claves foráneas compuestas (x_id, tenant_id) viven en la migración SQL.
// ---------------------------------------------------------------------------------------------

export const estadoSocio = pgEnum("estado_socio", ["activo", "inactivo"]);
export const tipoEvento = pgEnum("tipo_evento", ["asamblea", "minga"]);
export const estadoEvento = pgEnum("estado_evento", ["activo", "anulado"]);
export const estadoAsistencia = pgEnum("estado_asistencia", ["presente", "ausente", "justificado"]);
export const estadoPredio = pgEnum("estado_predio", ["activo", "inactivo"]);
export const tipoServicio = pgEnum("tipo_servicio", [
  "agua_riego",
  "agua_potable",
  "espacio_comunal",
  "maquinaria",
  "otro",
]);
export const estadoServicio = pgEnum("estado_servicio", ["activo", "inactivo"]);

export const socio = pgTable("socio", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => junta.id),
  cedula: text("cedula").notNull(),
  nombres: text("nombres").notNull(),
  sectorId: uuid("sector_id").notNull(),
  telefono: text("telefono"),
  correo: text("correo"),
  estado: estadoSocio("estado").notNull().default("activo"),
  /** Fecha de calendario (AAAA-MM-DD). */
  fechaIngreso: date("fecha_ingreso", { mode: "string" }).notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const evento = pgTable("evento", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => junta.id),
  tipo: tipoEvento("tipo").notNull(),
  titulo: text("titulo").notNull(),
  fecha: date("fecha", { mode: "string" }).notNull(),
  lugar: text("lugar").notNull(),
  estado: estadoEvento("estado").notNull().default("activo"),
  motivoAnulacion: text("motivo_anulacion"),
  anuladoPor: uuid("anulado_por").references(() => usuario.id),
  anuladoEn: timestamp("anulado_en", { withTimezone: true }),
  asistenciaRegistradaEn: timestamp("asistencia_registrada_en", { withTimezone: true }),
  creadoPor: uuid("creado_por")
    .notNull()
    .references(() => usuario.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const asistencia = pgTable("asistencia", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => junta.id),
  eventoId: uuid("evento_id").notNull(),
  socioId: uuid("socio_id").notNull(),
  estado: estadoAsistencia("estado").notNull(),
  motivo: text("motivo"),
  registradoPor: uuid("registrado_por")
    .notNull()
    .references(() => usuario.id),
  registradoEn: timestamp("registrado_en", { withTimezone: true }).notNull().defaultNow(),
  modificadoPor: uuid("modificado_por")
    .notNull()
    .references(() => usuario.id),
  modificadoEn: timestamp("modificado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const predio = pgTable("predio", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => junta.id),
  codigo: text("codigo").notNull(),
  nombre: text("nombre").notNull(),
  /** numeric llega como texto desde PostgreSQL. */
  superficieHa: numeric("superficie_ha", { precision: 10, scale: 4 }).notNull(),
  sectorId: uuid("sector_id").notNull(),
  socioId: uuid("socio_id").notNull(),
  latitud: numeric("latitud", { precision: 9, scale: 6 }),
  longitud: numeric("longitud", { precision: 9, scale: 6 }),
  imagenRuta: text("imagen_ruta"),
  estado: estadoPredio("estado").notNull().default("activo"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const servicio = pgTable("servicio", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => junta.id),
  nombre: text("nombre").notNull(),
  tipo: tipoServicio("tipo").notNull(),
  estado: estadoServicio("estado").notNull().default("activo"),
});

export const turno = pgTable("turno", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => junta.id),
  servicioId: uuid("servicio_id").notNull(),
  sectorId: uuid("sector_id").notNull(),
  /** 1 = lunes … 7 = domingo */
  diaSemana: smallint("dia_semana").notNull(),
  horaInicio: time("hora_inicio").notNull(),
  horaFin: time("hora_fin").notNull(),
});

export type Socio = typeof socio.$inferSelect;
export type Evento = typeof evento.$inferSelect;
export type Predio = typeof predio.$inferSelect;

// ---------------------------------------------------------------------------------------------
// Módulo de Gestión Financiera (drizzle/0008_financiero.sql)
// Importes: numeric(12,2) llega como texto; los cálculos se hacen en centavos (src/lib/dinero.ts).
// ---------------------------------------------------------------------------------------------

export const tipoConcepto = pgEnum("tipo_concepto", ["cuota", "servicio", "multa"]);
export const estadoConcepto = pgEnum("estado_concepto", ["activo", "inactivo"]);
export const formaPago = pgEnum("forma_pago", ["efectivo", "transferencia", "deposito"]);
export const categoriaEgreso = pgEnum("categoria_egreso", ["compras", "trabajos", "honorarios", "tasas", "otros"]);
export const tipoMovimiento = pgEnum("tipo_movimiento", ["entrada", "salida"]);
export const estadoMaterial = pgEnum("estado_material", ["activo", "inactivo"]);
export const estadoActivo = pgEnum("estado_activo", ["vigente", "baja"]);

export const conceptoCobro = pgTable("concepto_cobro", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => junta.id),
  nombre: text("nombre").notNull(),
  tipo: tipoConcepto("tipo").notNull(),
  montoDefecto: numeric("monto_defecto", { precision: 12, scale: 2 }).notNull().default("0"),
  estado: estadoConcepto("estado").notNull().default("activo"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const cargo = pgTable("cargo", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => junta.id),
  conceptoId: uuid("concepto_id").notNull(),
  socioId: uuid("socio_id").notNull(),
  anio: smallint("anio").notNull(),
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
  vence: date("vence", { mode: "string" }),
  eventoId: uuid("evento_id"),
  anuladoEn: timestamp("anulado_en", { withTimezone: true }),
  anuladoPor: uuid("anulado_por").references(() => usuario.id),
  motivoAnulacion: text("motivo_anulacion"),
  creadoPor: uuid("creado_por").notNull().references(() => usuario.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const pago = pgTable("pago", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => junta.id),
  cargoId: uuid("cargo_id").notNull(),
  /** Lo asigna el disparador de la base de datos (consecutivo por junta); el valor enviado se ignora. */
  numero: integer("numero").notNull().default(0),
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
  fecha: date("fecha", { mode: "string" }).notNull(),
  forma: formaPago("forma").notNull(),
  referencia: text("referencia"),
  anuladoEn: timestamp("anulado_en", { withTimezone: true }),
  anuladoPor: uuid("anulado_por").references(() => usuario.id),
  motivoAnulacion: text("motivo_anulacion"),
  creadoPor: uuid("creado_por").notNull().references(() => usuario.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const egreso = pgTable("egreso", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => junta.id),
  fecha: date("fecha", { mode: "string" }).notNull(),
  categoria: categoriaEgreso("categoria").notNull(),
  descripcion: text("descripcion").notNull(),
  beneficiario: text("beneficiario").notNull(),
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
  respaldoRuta: text("respaldo_ruta"),
  anuladoEn: timestamp("anulado_en", { withTimezone: true }),
  anuladoPor: uuid("anulado_por").references(() => usuario.id),
  motivoAnulacion: text("motivo_anulacion"),
  creadoPor: uuid("creado_por").notNull().references(() => usuario.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const material = pgTable("material", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => junta.id),
  nombre: text("nombre").notNull(),
  unidad: text("unidad").notNull(),
  stock: numeric("stock", { precision: 12, scale: 2 }).notNull().default("0"),
  minimo: numeric("minimo", { precision: 12, scale: 2 }).notNull().default("0"),
  estado: estadoMaterial("estado").notNull().default("activo"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const movimientoMaterial = pgTable("movimiento_material", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => junta.id),
  materialId: uuid("material_id").notNull(),
  tipo: tipoMovimiento("tipo").notNull(),
  cantidad: numeric("cantidad", { precision: 12, scale: 2 }).notNull(),
  motivo: text("motivo").notNull(),
  creadoPor: uuid("creado_por").notNull().references(() => usuario.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const activoFijo = pgTable("activo_fijo", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => junta.id),
  codigo: text("codigo").notNull(),
  nombre: text("nombre").notNull(),
  fechaAdquisicion: date("fecha_adquisicion", { mode: "string" }).notNull(),
  valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
  ubicacion: text("ubicacion").notNull(),
  estado: estadoActivo("estado").notNull().default("vigente"),
  motivoBaja: text("motivo_baja"),
  bajaEn: timestamp("baja_en", { withTimezone: true }),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export type ConceptoCobro = typeof conceptoCobro.$inferSelect;

/** Vista `cargo_saldo`: cargo con pagado, saldo, estado derivado y marca de vencido (security_invoker). */
export const cargoSaldo = pgView("cargo_saldo", {
  id: uuid("id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  conceptoId: uuid("concepto_id").notNull(),
  socioId: uuid("socio_id").notNull(),
  anio: smallint("anio").notNull(),
  monto: numeric("monto", { precision: 12, scale: 2 }).notNull(),
  vence: date("vence", { mode: "string" }),
  eventoId: uuid("evento_id"),
  anuladoEn: timestamp("anulado_en", { withTimezone: true }),
  anuladoPor: uuid("anulado_por"),
  motivoAnulacion: text("motivo_anulacion"),
  creadoPor: uuid("creado_por").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull(),
  pagado: numeric("pagado", { precision: 12, scale: 2 }).notNull(),
  saldo: numeric("saldo", { precision: 12, scale: 2 }).notNull(),
  estado: text("estado").notNull(),
  vencido: boolean("vencido").notNull(),
}).existing();

// ---------------------------------------------------------------------------------------------
// Módulo de Gestión de Comunicaciones (drizzle/0010_comunicaciones.sql)
// ---------------------------------------------------------------------------------------------

export const tipoDocumento = pgEnum("tipo_documento", ["acta_asamblea", "acta_directiva", "resolucion"]);
export const estadoRegistro = pgEnum("estado_registro", ["vigente", "anulado"]);

export const convocatoria = pgTable("convocatoria", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => junta.id),
  tipo: tipoEvento("tipo").notNull(),
  titulo: text("titulo").notNull(),
  fecha: date("fecha", { mode: "string" }).notNull(),
  hora: time("hora").notNull(),
  lugar: text("lugar").notNull(),
  ordenDia: text("orden_dia"),
  eventoId: uuid("evento_id"),
  estado: estadoRegistro("estado").notNull().default("vigente"),
  anuladoPor: uuid("anulado_por").references(() => usuario.id),
  anuladoEn: timestamp("anulado_en", { withTimezone: true }),
  motivoAnulacion: text("motivo_anulacion"),
  notificados: integer("notificados").notNull().default(0),
  creadoPor: uuid("creado_por").notNull().references(() => usuario.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const documento = pgTable("documento", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => junta.id),
  tipo: tipoDocumento("tipo").notNull(),
  titulo: text("titulo").notNull(),
  fecha: date("fecha", { mode: "string" }).notNull(),
  descripcion: text("descripcion"),
  archivoRuta: text("archivo_ruta").notNull(),
  publicado: boolean("publicado").notNull().default(false),
  estado: estadoRegistro("estado").notNull().default("vigente"),
  anuladoPor: uuid("anulado_por").references(() => usuario.id),
  anuladoEn: timestamp("anulado_en", { withTimezone: true }),
  motivoAnulacion: text("motivo_anulacion"),
  creadoPor: uuid("creado_por").notNull().references(() => usuario.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const comunicacionRecibida = pgTable("comunicacion_recibida", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => junta.id),
  institucion: text("institucion").notNull(),
  asunto: text("asunto").notNull(),
  referencia: text("referencia"),
  fechaRecepcion: date("fecha_recepcion", { mode: "string" }).notNull(),
  resumen: text("resumen").notNull(),
  archivoRuta: text("archivo_ruta"),
  publicada: boolean("publicada").notNull().default(false),
  estado: estadoRegistro("estado").notNull().default("vigente"),
  anuladoPor: uuid("anulado_por").references(() => usuario.id),
  anuladoEn: timestamp("anulado_en", { withTimezone: true }),
  motivoAnulacion: text("motivo_anulacion"),
  creadoPor: uuid("creado_por").notNull().references(() => usuario.id),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export const hilo = pgTable("hilo", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => junta.id),
  usuarioId: uuid("usuario_id").notNull(),
  asunto: text("asunto").notNull(),
  iniciadoPorAdmin: boolean("iniciado_por_admin").notNull().default(false),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  ultimoMensajeEn: timestamp("ultimo_mensaje_en", { withTimezone: true }).notNull().defaultNow(),
});

export const mensaje = pgTable("mensaje", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => junta.id),
  hiloId: uuid("hilo_id").notNull(),
  autorId: uuid("autor_id").notNull().references(() => usuario.id),
  deAdministracion: boolean("de_administracion").notNull(),
  texto: text("texto").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  leidoEn: timestamp("leido_en", { withTimezone: true }),
});
