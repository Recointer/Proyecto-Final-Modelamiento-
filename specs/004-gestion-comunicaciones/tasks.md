# Tasks: Gestión de Comunicaciones

**Input**: documentos de `specs/004-gestion-comunicaciones/`. Cada tarea cita los RF que cubre.

## Phase 1: Fundamentos

- [X] T001 Migración `drizzle/0010_comunicaciones.sql`: enums, tablas convocatoria, documento, comunicacion_recibida, hilo, mensaje; `UNIQUE (id, tenant_id)` en `usuario` (RF-25..RF-33)
- [X] T002 Migración `drizzle/0011_comunicaciones_rls.sql`: RLS forzada y política por junta (Principio I)
- [X] T003 Permisos de columna en `src/server/db/migrate.ts` (inmutabilidad, sin DELETE)
- [X] T004 [P] Esquema Drizzle en `src/server/db/schema.ts`
- [X] T005 [P] `src/server/validation/comunicaciones.ts` + pruebas `tests/unit/comunicaciones-validacion.test.ts`
- [X] T006 [P] Mensajes de error en `src/lib/result.ts` y navegación en `src/lib/navegacion.ts`
- [X] T007 Ayudantes de prueba `tests/integration/helpers-comunicaciones.ts`

## Phase 2: US1 — Convocatorias (P1) — RF-25, RF-26, RF-31

- [X] T008 [P] [US1] Prueba `tests/integration/comunicaciones.test.ts` (emitir, fecha pasada, evento ajeno, correo con fallo, visibilidad del Socio, anular, aislamiento)
- [X] T009 [US1] `convocatoria-service.ts` (emitir con aviso, listar, anular, vista del Socio)
- [X] T010 [US1] Acciones y pantalla `/convocatorias`

## Phase 3: US2 — Actas y resoluciones (P1) — RF-27, RF-28, RF-31

- [X] T011 [P] [US2] Prueba `tests/integration/comunicaciones.test.ts` (archivar, tipos, publicar/retirar, anular, visibilidad y descarga del Socio, aislamiento)
- [X] T012 [US2] `documento-service.ts` y ruta `GET /api/documentos/[id]`
- [X] T013 [US2] Acciones y pantalla `/documentos`

## Phase 4: US3 — Comunicaciones recibidas (P2) — RF-29, RF-30, RF-31

- [X] T014 [P] [US3] Prueba `tests/integration/comunicaciones.test.ts`
- [X] T015 [US3] `comunicacion-service.ts` y ruta `GET /api/comunicaciones/[id]/adjunto`
- [X] T016 [US3] Acciones y pantalla `/comunicaciones`

## Phase 5: US4 — Mensajería (P2) — RF-32, RF-33

- [X] T017 [P] [US4] Prueba `tests/integration/mensajeria.test.ts` (iniciar, responder, no leídos, privacidad, inmutabilidad)
- [X] T018 [US4] `mensajeria-service.ts`
- [X] T019 [US4] Acciones y pantalla `/mensajes`

## Phase 6: Pulido

- [X] T020 [P] Prueba de aislamiento de las tablas nuevas `tests/integration/rls-comunicaciones.test.ts`
- [X] T021 E2E `tests/e2e/comunicaciones.spec.ts` y accesibilidad de las pantallas nuevas
- [X] T022 Verificación: `tsc`, `eslint`, Vitest, E2E y `npm audit`; README y marcar este archivo
