# Data Model: Gestión Administrativa

Convención: identificadores UUID; fechas `timestamptz` salvo que se indique `date`/`time`. Todas las
tablas llevan `tenant_id` (= `junta.id`) con **RLS forzada**: política única
`USING / WITH CHECK (app_role() = 'tenant' AND tenant_id = app_tenant())`. El Super Administrador y el
contexto de autenticación **no** tienen acceso a estas tablas. Cada tabla referenciada declara
`UNIQUE (id, tenant_id)` y las referencias son claves foráneas compuestas `(x_id, tenant_id)`, de modo
que ningún registro puede apuntar a otro de una junta distinta.

Tablas ya existentes que se reutilizan: `junta` (parámetros de quórum), `sector`, `usuario`, `audit_log`.
La migración 0005 añade `UNIQUE (id, tenant_id)` a `sector` para poder referenciarlo con claves compuestas.

## socio

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | PK; `UNIQUE (id, tenant_id)` |
| tenant_id | uuid | FK `junta` |
| cedula | text | 10 dígitos validados (dígito verificador); único por `tenant_id`; inmutable |
| nombres | text | obligatorio, 3–120 caracteres |
| sector_id | uuid | obligatorio; FK compuesta `sector` `ON DELETE RESTRICT` |
| telefono | text | opcional, formato de teléfono |
| correo | text | opcional, correo válido; único por junta (sin distinguir mayúsculas) cuando existe |
| estado | enum | `activo` / `inactivo` |
| fecha_ingreso | date | obligatoria; no posterior a hoy (hora de Ecuador) |
| creado_en, actualizado_en | timestamptz | |

Transiciones: `activo ⇄ inactivo` (baja lógica; no hay `DELETE`). Un socio inactivo no aparece en
listas de asistencia nuevas, pero conserva historial y predios.
Vínculo con la cuenta: por igualdad de `cedula` y `tenant_id` con `usuario` (sin FK).

## evento

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | PK; `UNIQUE (id, tenant_id)` |
| tenant_id | uuid | FK `junta` |
| tipo | enum | `asamblea` / `minga` |
| titulo | text | 3–150 caracteres |
| fecha | date | obligatoria |
| lugar | text | obligatorio, hasta 150 |
| estado | enum | `activo` / `anulado` |
| motivo_anulacion | text | obligatorio si `anulado` (`CHECK`) |
| anulado_por | uuid | FK `usuario`; con `anulado_en` |
| asistencia_registrada_en | timestamptz | nulo hasta el primer guardado de asistencia |
| creado_por | uuid | FK `usuario` |

Transiciones: `activo → anulado` (irreversible, con motivo). No hay `DELETE`. Un evento con `fecha`
posterior a hoy no admite asistencia. Un evento anulado deja de contar en porcentajes y en el panel.

## asistencia

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | PK |
| tenant_id | uuid | FK `junta` |
| evento_id | uuid | FK compuesta `evento` |
| socio_id | uuid | FK compuesta `socio` |
| estado | enum | `presente` / `ausente` / `justificado` |
| motivo | text | obligatorio si `justificado` (`CHECK`), hasta 300 |
| registrado_por, registrado_en | uuid, timestamptz | |
| modificado_por, modificado_en | uuid, timestamptz | actualizados en cada cambio |

Unicidad: `(evento_id, socio_id)`. Se guarda por *upsert* en una sola transacción por evento. No hay
`DELETE` (se corrige el estado). Inasistencia injustificada = `estado = 'ausente'` en evento `activo`.

## predio

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | PK; `UNIQUE (id, tenant_id)` |
| tenant_id | uuid | FK `junta` |
| codigo | text | obligatorio, 2–20; único por junta (sin distinguir mayúsculas) |
| nombre | text | obligatorio, hasta 120 |
| superficie_ha | numeric(10,4) | `CHECK > 0` |
| sector_id | uuid | FK compuesta `sector` `ON DELETE RESTRICT` |
| socio_id | uuid | titular; FK compuesta `socio` `ON DELETE RESTRICT` |
| latitud | numeric(9,6) | opcional; `CHECK -90…90` |
| longitud | numeric(9,6) | opcional; `CHECK -180…180`; ambas o ninguna (`CHECK`) |
| imagen_ruta | text | opcional; ruta interna en el `FileStore` (`predios/<tenant_id>/…`); nunca se expone |
| estado | enum | `activo` / `inactivo` |
| creado_en, actualizado_en | timestamptz | |

Transiciones: `activo ⇄ inactivo`; no hay `DELETE`. Las imágenes son PNG o JPEG de hasta 5 MB.

## servicio

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | PK; `UNIQUE (id, tenant_id)` |
| tenant_id | uuid | FK `junta` |
| nombre | text | obligatorio, hasta 100; único por junta (sin distinguir mayúsculas) |
| tipo | enum | `agua_riego`, `agua_potable`, `espacio_comunal`, `maquinaria`, `otro` |
| estado | enum | `activo` / `inactivo` |

## turno

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | PK |
| tenant_id | uuid | FK `junta` |
| servicio_id | uuid | FK compuesta `servicio` |
| sector_id | uuid | FK compuesta `sector` `ON DELETE RESTRICT` |
| dia_semana | smallint | 1 (lunes) a 7 (domingo) |
| hora_inicio, hora_fin | time | `CHECK hora_fin > hora_inicio` |

Restricción de exclusión: no pueden solaparse turnos con el mismo `(servicio_id, sector_id, dia_semana)`
(rangos de horas semiabiertos `[inicio, fin)`; turnos contiguos son válidos). Los turnos sí se
eliminan (`DELETE`), a diferencia del resto de tablas.

## Índices

- `socio`: `(tenant_id, lower(nombres))`, `(tenant_id, estado, sector_id)`, único `(tenant_id, cedula)`.
- `evento`: `(tenant_id, fecha DESC)`.
- `asistencia`: `(socio_id)`, `(evento_id)`.
- `predio`: `(tenant_id, sector_id)`, `(socio_id)`, único `(tenant_id, lower(codigo))`.
- `turno`: `(tenant_id, servicio_id)` y el índice GiST de la exclusión.

## Funciones agregadas (`SECURITY DEFINER`, solo `super_admin`)

- `total_eventos_plataforma() → integer`: eventos `activo` de todas las juntas.
- `eventos_plataforma_por_dia(anio int, mes int) → (dia int, total int)`: cantidad por día (hora de
  Ecuador), sin títulos ni identificar la junta.

Ambas fijan `search_path`, verifican `app_role() = 'super_admin'` y se otorgan solo al rol de la
aplicación.

## Privilegios del rol de la aplicación

`SELECT, INSERT, UPDATE` sobre `socio`, `evento`, `asistencia`, `predio` y `servicio` (sin `DELETE`);
`SELECT, INSERT, UPDATE, DELETE` sobre `turno`.

## Auditoría (`audit_log.accion`)

`socio.crear|editar|desactivar|reactivar`, `evento.crear|editar|anular`, `asistencia.guardar`
(resumen de cambios), `predio.crear|editar|desactivar|reactivar|imagen`, `servicio.crear|editar|
desactivar|reactivar`, `turno.crear|editar|eliminar`.
