# Research: Gestión Financiera

## D1. Representación del dinero
- **Decisión**: `numeric(12,2)` en PostgreSQL; en TypeScript, centavos enteros (`src/lib/dinero.ts`) para sumar, comparar y formatear. Los importes viajan como texto.
- **Por qué**: `numeric` es exacto; evita `float`. Los centavos enteros eliminan errores de redondeo en la capa de aplicación.
- **Descartado**: `float` (redondeo), librería de decimales (dependencia innecesaria, Principio VII).

## D2. Saldo y estado del cargo
- **Decisión**: vista `cargo_saldo` (`security_invoker = true`) que calcula `pagado`, `saldo` y `estado` (anulado, pagado, parcial, pendiente) y `vencido`. No se guardan columnas derivadas.
- **Por qué**: nada que sincronizar; el RLS de las tablas base aplica al invocador.
- **Descartado**: columna `saldo` mantenida por código (riesgo de desfase).

## D3. Pago que no excede el saldo, con registros simultáneos
- **Decisión**: disparador `BEFORE INSERT` en `pago` que bloquea la fila del cargo (`FOR UPDATE`), verifica cargo vigente y suma de pagos vigentes + nuevo ≤ monto; error SQLSTATE `23514`.
- **Por qué**: la regla vale aunque se inserte por otra vía; el bloqueo serializa pagos sobre el mismo cargo.

## D4. Comprobante consecutivo sin saltos
- **Decisión**: tabla `contador_comprobante (tenant_id, ultimo)`; el mismo disparador hace `INSERT … ON CONFLICT DO UPDATE SET ultimo = ultimo + 1 RETURNING` y asigna `pago.numero`; `UNIQUE (tenant_id, numero)`. El comprobante es el pago numerado.
- **Por qué**: el `UPDATE` bloquea la fila del contador, serializa por junta y, al ser transaccional, un rechazo revierte el número (sin saltos). Una secuencia nativa deja saltos tras un rollback.
- **Descartado**: `max(numero)+1` (condición de carrera), secuencia por junta (saltos, objetos dinámicos).

## D5. Inmutabilidad y no borrado
- **Decisión**: disparadores `BEFORE DELETE` que lanzan error en todas las tablas financieras, y `BEFORE UPDATE` que impiden cambiar importes, fechas y referencias de pagos y egresos; solo se permite completar los campos de anulación. Sin permiso `DELETE` para el rol de la aplicación.
- **Por qué**: Principio IV (los registros financieros no se borran físicamente).

## D6. Multas desde la asistencia
- **Decisión**: el Tesorero/a las genera a petición. Se leen las asistencias `ausente` del evento (el servicio de asistencia ya expone esa lista) y se inserta un cargo por socio con el monto de `configuracion` (`multaAsamblea` / `multaMinga`). Índice único parcial `(evento_id, socio_id)` entre cargos de multa no anulados + `ON CONFLICT DO NOTHING` hace idempotente la generación. Los conceptos «Multa por inasistencia a asamblea/minga» se crean al primer uso (tipo `multa`, protegidos).
- **Por qué**: cumple RF-15 sin automatismos ocultos (supuesto de la spec).

## D7. Stock de inventario
- **Decisión**: `material.stock` con `CHECK (stock >= 0)`; cada movimiento se aplica con `UPDATE … SET stock = stock ± x` en la misma transacción que inserta `movimiento_material`. Una salida excesiva viola el CHECK (`23514`) y se traduce a «stock insuficiente».
- **Por qué**: atómico y sin lecturas previas.

## D8. Reportes
- **Decisión**: un servicio de reportes devuelve filas y totales; el CSV usa `lib/csv.ts` (BOM, neutraliza fórmulas) y el PDF un generador de tablas genérico (`tabla-pdf.ts`) basado en pdf-lib, con la misma limpieza de caracteres que el historial.
- **Por qué**: reutiliza lo existente (Principio VII); los totales provienen de la misma consulta que el detalle (SC-005).

## D9. Agregado para el Super Administrador
- **Decisión**: función `SECURITY DEFINER` `total_pagos_plataforma()` que devuelve solo el conteo de pagos vigentes, concedida al rol de la aplicación y verificando `app_role() = 'super_admin'`.
- **Por qué**: mismo patrón que `total_eventos_plataforma()` (Principio I).

## D10. Acceso por rol
- **Decisión**: acciones y páginas con `requireRole("tesorero")` para escribir; `admin_junta` solo en resumen y reportes; el Socio solo mediante `socioDeSesion` (cédula de la sesión), nunca un `socioId` del cliente. Las rutas `/api` repiten la verificación y responden 401/403/404 sin revelar existencia.
