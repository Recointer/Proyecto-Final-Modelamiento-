# Data Model: Gestión de Plataforma (multi-junta)

Convención: todos los identificadores son UUID; las fechas son `timestamptz`. Las tablas marcadas
**[RLS]** llevan `tenant_id` (= `junta.id`) y política de aislamiento forzada.

## junta *(tabla de plataforma)*

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | PK |
| slug | text | único, minúsculas y guiones; es el "identificador de junta" |
| nombre | text | obligatorio |
| tipo | enum | `riego`, `agua_potable`, `parroquial`, `barrial`, `otra` |
| provincia, canton, parroquia | text | obligatorios |
| contacto_nombre, contacto_telefono, contacto_correo | text | opcionales |
| parametros | jsonb | parámetros propios de la junta (RF-02) |
| estado | enum | `activa` / `desactivada` |
| creada_en, actualizada_en | timestamptz | |

Restricción: único (`lower(nombre)`, `parroquia`) → evita duplicados (FR-008).
Transiciones: `activa ⇄ desactivada` (lógica, confirmada, auditada).

## usuario **[RLS]** (el Super Administrador tiene `tenant_id` nulo)

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | PK |
| tenant_id | uuid | FK `junta`, nulo solo para `super_admin` |
| cedula | text | validada con dígito verificador; única por `tenant_id` |
| nombres | text | obligatorio |
| correo | text | único por `tenant_id`; obligatorio para recuperar contraseña |
| telefono | text | opcional |
| rol | enum | `super_admin`, `admin_junta`, `secretario`, `tesorero`, `socio` |
| estado | enum | `activo` / `desactivado` |
| password_hash | text | argon2id |
| debe_cambiar_password | boolean | verdadero con credenciales iniciales (FR-017) |
| intentos_fallidos | int | se reinicia al ingresar correctamente |
| bloqueado_hasta | timestamptz | nulo si no está bloqueada |

Reglas: un `admin_junta` por junta (índice único parcial sobre `tenant_id` donde
`rol = 'admin_junta'` y `estado = 'activo'`); el Administrador no puede desactivar su propia cuenta.

## sector **[RLS]**

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | PK |
| tenant_id | uuid | FK `junta` |
| nombre | text | único por junta |
| descripcion | text | opcional |

Regla: no se elimina si tiene socios o predios asociados (FR-014; esas asociaciones llegan en el
módulo administrativo, y el servicio de sectores expone ya la verificación).

## designacion_administrador *(plataforma)*

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | PK |
| junta_id | uuid | FK `junta` |
| usuario_id | uuid | FK `usuario` (administrador designado) |
| acta_ruta | text | archivo PDF/imagen, máx. 5 MB |
| motivo | text | obligatorio al cambiar |
| designado_por | uuid | FK `usuario` (Super Administrador) |
| vigente | boolean | una sola vigente por junta |
| creada_en | timestamptz | |

Transición: al cambiar administrador, la designación anterior pasa a `vigente = false`, el usuario
anterior pasa a `socio` y el nuevo a `admin_junta`, todo en una transacción.

## sesion

| Campo | Tipo |
|-------|------|
| id | uuid |
| usuario_id | uuid |
| token_hash | text |
| expira_en | timestamptz |
| recordar | boolean |
| creada_en | timestamptz |

Se eliminan las sesiones de un usuario al desactivarlo y las de todos los usuarios de una junta al
desactivar la junta.

## token_recuperacion

`usuario_id`, `token_hash`, `expira_en` (1 h), `usado_en` (un solo uso).

## audit_log *(append-only)*

| Campo | Tipo |
|-------|------|
| id | uuid |
| actor_id | uuid |
| tenant_id | uuid (nulo en operaciones de plataforma) |
| accion | text (p. ej. `junta.crear`, `junta.desactivar`, `admin.cambiar`, `usuario.crear`) |
| entidad, entidad_id | text, uuid |
| antes, despues | jsonb |
| creado_en | timestamptz |

El rol de la aplicación solo tiene permiso `INSERT` y `SELECT`.

## evento *(consulta agregada)*

Definido por el módulo administrativo; en este módulo solo se cuenta para el panel. Mientras no
exista, el total es 0.

## Políticas RLS (resumen)

- Tablas **[RLS]**: `USING (tenant_id = current_setting('app.tenant_id')::uuid)`.
- `super_admin`: acceso solo a `junta`, `designacion_administrador`, `audit_log` y a la fila de
  `usuario` de administradores de junta (para asignar/cambiar); nunca a sectores, socios u otros
  datos internos.
- Sin `app.tenant_id` fijado, las consultas a tablas **[RLS]** no devuelven filas.
