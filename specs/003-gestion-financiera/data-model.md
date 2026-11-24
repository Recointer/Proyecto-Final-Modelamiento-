# Data Model: Gestión Financiera

Todas las tablas llevan `tenant_id` con RLS forzada (política `app_role() = 'tenant' AND tenant_id = app_tenant()`),
declaran `UNIQUE (id, tenant_id)` y se referencian con claves foráneas compuestas `(x_id, tenant_id)`.
Importes: `numeric(12,2)`. Migraciones: `drizzle/0008_financiero.sql` y `0009_financiero_rls.sql`.

## Enumeraciones
`tipo_concepto` (cuota, servicio, multa) · `forma_pago` (efectivo, transferencia, deposito) ·
`categoria_egreso` (compras, trabajos, honorarios, tasas, otros) · `tipo_movimiento` (entrada, salida) ·
`estado_activo` (vigente, baja) · `estado_concepto` (activo, inactivo).

## Tablas

### concepto_cobro
`id`, `tenant_id`, `nombre` (1–100, único por junta sin distinguir mayúsculas), `tipo`, `monto_defecto numeric ≥ 0`, `estado`, `creado_en`.

### cargo
`id`, `tenant_id`, `concepto_id` → concepto_cobro, `socio_id` → socio, `anio smallint (2000–2100)`, `monto > 0`,
`vence date NULL`, `evento_id` → evento (solo multas), `anulado_en`, `anulado_por`, `motivo_anulacion`, `creado_por`, `creado_en`.
- Único `(tenant_id, concepto_id, socio_id, anio)` cuando no es multa y no está anulado.
- Único `(evento_id, socio_id)` cuando es multa y no está anulado.
- CHECK de anulación coherente (los tres campos juntos).

### pago (el comprobante es el pago numerado)
`id`, `tenant_id`, `cargo_id` → cargo, `numero int` (consecutivo por junta), `monto > 0`, `fecha date`,
`forma`, `referencia text NULL (≤ 80)`, `anulado_en/por/motivo`, `creado_por`, `creado_en`.
- `UNIQUE (tenant_id, numero)`.
- Disparador `BEFORE INSERT`: bloquea el cargo, verifica que no esté anulado y que Σ pagos vigentes + monto ≤ monto del cargo; asigna `numero`.
- Disparadores `BEFORE UPDATE` (solo se pueden fijar los campos de anulación) y `BEFORE DELETE` (prohibido).

### contador_comprobante
`tenant_id PK`, `ultimo int`.

### egreso
`id`, `tenant_id`, `fecha date`, `categoria`, `descripcion (3–300)`, `beneficiario (2–120)`, `monto > 0`,
`respaldo_ruta NULL`, `anulado_en/por/motivo`, `creado_por`, `creado_en`. Mismos disparadores de inmutabilidad y no borrado.

### material / movimiento_material
`material`: `id`, `tenant_id`, `nombre` (único por junta), `unidad (1–20)`, `stock numeric(12,2) CHECK ≥ 0`, `minimo ≥ 0`, `estado`, `creado_en`.
`movimiento_material`: `id`, `tenant_id`, `material_id`, `tipo`, `cantidad > 0`, `motivo (3–200)`, `creado_por`, `creado_en`. Sin UPDATE ni DELETE.

### activo_fijo
`id`, `tenant_id`, `codigo (2–20, único por junta)`, `nombre`, `fecha_adquisicion date`, `valor ≥ 0`, `ubicacion`,
`estado (vigente|baja)`, `motivo_baja`, `baja_en`. No se borra; la baja exige motivo.

## Vista
`cargo_saldo` (`security_invoker = true`): cargo + `pagado`, `saldo = monto − pagado`, `estado` ∈ {anulado, pagado, parcial, pendiente}, `vencido = (estado ∈ {pendiente, parcial} AND vence < hoy de Ecuador)`.

## Funciones
`total_pagos_plataforma()` — `SECURITY DEFINER`, solo `super_admin`, devuelve el conteo de pagos vigentes.

## Auditoría
Se reutiliza `audit_log`: acciones `concepto.*`, `cargo.emitir|anular`, `pago.registrar|anular`, `multa.generar`,
`egreso.registrar|anular`, `material.*`, `movimiento.registrar`, `activo.*`.
