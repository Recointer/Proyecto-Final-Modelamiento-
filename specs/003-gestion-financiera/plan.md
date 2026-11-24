# Implementation Plan: Gestión Financiera

**Branch**: `003-gestion-financiera` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/003-gestion-financiera/spec.md`

## Summary

Módulo de tesorería sobre la misma base del módulo Administrativo: conceptos y cargos por año,
pagos con comprobante consecutivo, multas generadas desde la asistencia, egresos con respaldo,
resumen y reportes (PDF/CSV), inventario, activos fijos y estado de cuenta del Socio. Monolito
Next.js + PostgreSQL con RLS; reglas de dinero (saldo, consecutivo, stock) garantizadas por la base
de datos con disparadores y restricciones, no solo por el código.

## Technical Context

**Language/Version**: TypeScript estricto, Node 20+, Next.js 15 (App Router, Server Actions)
**Primary Dependencies**: Drizzle ORM, Zod, pdf-lib (ya en uso), sin dependencias nuevas
**Storage**: PostgreSQL 16 con RLS; respaldos de egresos en el FileStore local existente
**Testing**: Vitest (unitarias + integración contra PostgreSQL), Playwright + axe (E2E)
**Target Platform**: Web responsiva (móvil y escritorio), español
**Project Type**: Monolito web (único proyecto)
**Performance Goals**: emisión masiva de 500 cargos < 2 min (SC-002); multas de 100 socios < 1 min
**Constraints**: importes en USD con 2 decimales exactos; registros financieros nunca se borran;
consecutivo de comprobantes sin saltos ni repeticiones con registros simultáneos
**Scale/Scope**: hasta ~1.000 socios por junta; decenas de miles de cargos y pagos

## Constitution Check

| Principio | Cumplimiento |
|-----------|--------------|
| I. Aislamiento | Todas las tablas nuevas con `tenant_id`, RLS forzada, claves foráneas compuestas `(x_id, tenant_id)`; el panel del Super Administrador solo recibe un conteo agregado mediante función `SECURITY DEFINER`. |
| II. Roles | Solo `tesorero` escribe; `admin_junta` consulta resumen y reportes; `secretario` sin acceso; `socio` solo lo suyo (derivado de la sesión, nunca del cliente). Validado en servidor en cada acción y ruta. |
| III. Trazabilidad | Historias y tareas citan RF-13 a RF-16, RF-20 a RF-22, RF-24. |
| IV. Seguridad y auditoría | Toda operación financiera audita antes/después en la misma transacción; disparador impide `DELETE` y cambios de importes en pagos y egresos; solo se anulan con motivo; respaldos validados por firma y tamaño. |
| V. Pruebas | Pruebas de integración de saldo, consecutivo concurrente, multas, stock y aislamiento entre juntas. |
| VI. UI | Español, responsiva, WCAG AA (axe en las pantallas nuevas), mismo sistema visual. |
| VII. Simplicidad | El comprobante ES el pago numerado (sin tabla aparte); saldo y estado del cargo se derivan en una vista (sin columnas que sincronizar); sin pasarela, intereses ni facturación SRI. |

Sin violaciones; no hay complejidad que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/003-gestion-financiera/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/rutas.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
drizzle/0008_financiero.sql          # tablas, vista cargo_saldo, disparadores, funciones
drizzle/0009_financiero_rls.sql      # RLS forzada + política por tenant
src/lib/dinero.ts                    # parseo/formato de USD en centavos enteros
src/server/validation/finanzas.ts    # esquemas Zod (concepto, emisión, pago, egreso, material, activo)
src/server/services/
├── concepto-service.ts  cargo-service.ts  pago-service.ts  multa-service.ts
├── egreso-service.ts    resumen-service.ts  reporte-service.ts
├── inventario-service.ts  activo-service.ts  estado-cuenta-service.ts
src/server/reportes/{comprobante-pdf.ts, tabla-pdf.ts}
src/app/(gestion)/finanzas/          # resumen, conceptos, cobros, multas, egresos, reportes, inventario, activos
src/app/(miembro)/mi/estado-de-cuenta/
src/app/api/{comprobantes/[id], egresos/[id]/respaldo, finanzas/reportes/[tipo], mi/comprobantes/[id]}/route.ts
tests/{unit,integration,e2e}/
```

**Structure Decision**: mismo monolito y mismas capas que el módulo Administrativo (acciones →
servicios → Drizzle con `withTenant`), sin directorios ni dependencias nuevas.

## Complexity Tracking

Sin violaciones de la constitución.
