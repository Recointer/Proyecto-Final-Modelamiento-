# Tasks: Gestión Financiera

**Input**: documentos de `specs/003-gestion-financiera/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rutas.md

Formato: `[ID] [P?] [Story] Descripción` — `[P]` = paralelizable (archivos distintos). Cada tarea cita los RF que cubre.

## Phase 1: Fundamentos (bloquea las historias)

- [ ] T001 Migración `drizzle/0008_financiero.sql`: enums, tablas (concepto_cobro, cargo, pago, contador_comprobante, egreso, material, movimiento_material, activo_fijo), vista `cargo_saldo`, disparadores de saldo, consecutivo, inmutabilidad y no borrado, función `total_pagos_plataforma` (RF-13..RF-22)
- [ ] T002 Migración `drizzle/0009_financiero_rls.sql`: RLS forzada y política por junta en todas las tablas nuevas (Principio I)
- [ ] T003 Registrar los permisos de las tablas nuevas y la función en `src/server/db/migrate.ts`
- [ ] T004 [P] Esquema Drizzle en `src/server/db/schema.ts` para las tablas nuevas
- [ ] T005 [P] `src/lib/dinero.ts`: parseo de texto a centavos, formato `$ 1.234,50`, suma exacta + prueba `tests/unit/dinero.test.ts`
- [ ] T006 [P] `src/server/validation/finanzas.ts`: esquemas Zod de concepto, emisión, pago, anulación, egreso, material, movimiento, activo + pruebas `tests/unit/finanzas-validacion.test.ts`
- [ ] T007 [P] Mensajes de error nuevos en `src/lib/result.ts`
- [ ] T008 [P] Navegación: entradas de finanzas por rol en `src/lib/navegacion.ts` y acceso del Tesorero/a y del Administrador al layout `(gestion)`
- [ ] T009 Utilidad de pruebas de integración para crear junta, socios y cargos (`tests/integration/helpers-finanzas.ts`)

## Phase 2: US1 — Cobros, pagos y comprobantes (P1) — RF-13, RF-14, RF-20

- [ ] T010 [P] [US1] Prueba de integración de saldo, pago parcial, exceso, anulación y consecutivo concurrente: `tests/integration/pagos.test.ts`
- [ ] T011 [P] [US1] `concepto-service.ts` (crear, editar, desactivar, reactivar, listar) + `tests/integration/conceptos.test.ts`
- [ ] T012 [US1] `cargo-service.ts`: emitir por año a todos/sector/socio sin duplicar, listar con filtros y paginación, obtener, anular
- [ ] T013 [US1] `pago-service.ts`: registrar, anular, listar por cargo; traducción de errores 23514
- [ ] T014 [P] [US1] `comprobante-pdf.ts` y ruta `GET /api/comprobantes/[id]`
- [ ] T015 [US1] Acciones y pantallas: `/finanzas/conceptos`, `/finanzas/cobros` (lista + emisión), `/finanzas/cobros/[id]` (pagos, anulaciones)
- [ ] T016 [US1] E2E `tests/e2e/finanzas.spec.ts` (concepto → emitir → pagar parcial → saldo → comprobante)

## Phase 3: US2 — Multas por inasistencia (P1) — RF-15

- [ ] T017 [P] [US2] Prueba de integración `tests/integration/multas.test.ts` (solo ausentes injustificados, sin duplicar, sin multa configurada, evento anulado/futuro/sin asistencia)
- [ ] T018 [US2] `multa-service.ts`: conceptos de multa automáticos, generación idempotente, anulación en cascada al anular un evento sin pagos
- [ ] T019 [US2] Pantalla `/finanzas/multas` y acción de generación; ampliar E2E

## Phase 4: US3 — Egresos (P2) — RF-16

- [ ] T020 [P] [US3] Prueba `tests/integration/egresos.test.ts` (alta, filtros, anulación, respaldo, inmutabilidad, aislamiento)
- [ ] T021 [US3] `egreso-service.ts` con respaldo en FileStore (PDF o imagen) y ruta `GET /api/egresos/[id]/respaldo`
- [ ] T022 [US3] Pantalla `/finanzas/egresos` (lista con filtros y total, formulario, anulación)

## Phase 5: US4 — Resumen y reportes (P2) — RF-24

- [ ] T023 [P] [US4] Prueba `tests/integration/reportes.test.ts` (totales cuadran, anulados excluidos, CSV y PDF)
- [ ] T024 [US4] `resumen-service.ts` y `reporte-service.ts` (ingresos, egresos, por cobrar, caja)
- [ ] T025 [P] [US4] `tabla-pdf.ts` genérico y ruta `GET /api/finanzas/reportes/[tipo]`
- [ ] T026 [US4] Pantallas `/finanzas` y `/finanzas/reportes` (Tesorero/a y Administrador)
- [ ] T027 [US4] Cifra agregada de pagos en el panel del Super Administrador (`panel-service.ts`) + prueba de aislamiento

## Phase 6: US5 — Estado de cuenta del Socio (P2) — RF-20

- [ ] T028 [P] [US5] Prueba `tests/integration/estado-cuenta.test.ts` (solo lo propio, sin padrón, comprobante ajeno denegado)
- [ ] T029 [US5] `estado-cuenta-service.ts` y ruta `GET /api/mi/comprobantes/[id]`
- [ ] T030 [US5] Pantalla `/mi/estado-de-cuenta` y enlace en el inicio del Socio; E2E `tests/e2e/estado-cuenta.spec.ts`

## Phase 7: US6 — Inventario y activos fijos (P3) — RF-21, RF-22

- [ ] T031 [P] [US6] Pruebas `tests/integration/inventario.test.ts` y `activos.test.ts` (stock no negativo, mínimo, código único, baja)
- [ ] T032 [US6] `inventario-service.ts` y pantalla `/finanzas/inventario`
- [ ] T033 [US6] `activo-service.ts` y pantalla `/finanzas/activos`

## Phase 8: Pulido

- [ ] T034 [P] Prueba de aislamiento entre juntas de todas las tablas nuevas (`tests/integration/aislamiento-finanzas.test.ts`)
- [ ] T035 [P] Accesibilidad: ampliar `tests/e2e/accesibilidad.spec.ts` con las pantallas de finanzas (escritorio y móvil)
- [ ] T036 Revisión: `tsc`, `eslint`, Vitest, E2E y `npm audit` sin errores
- [ ] T037 Actualizar `README.md` (estado del módulo 3) y marcar este archivo
