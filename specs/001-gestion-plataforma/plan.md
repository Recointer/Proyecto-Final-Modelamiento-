# Implementation Plan: Gestión de Plataforma (multi-junta)

**Branch**: `001-gestion-plataforma` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-gestion-plataforma/spec.md`

## Summary

Módulo base de la plataforma multi-junta: inicio de sesión para los 5 roles, panel del Super
Administrador, CRUD/desactivación de juntas (RF-01), asignación/cambio de Administrador (RF-04),
configuración de la junta y sus sectores (RF-02) y administración de cuentas de socios (RF-05).

Enfoque técnico: un único monolito Next.js (App Router, TypeScript estricto) con Server Actions y
Route Handlers, PostgreSQL con Row Level Security por `tenant_id` (la junta es el tenant), sesiones
opacas en base de datos con cookie HttpOnly, contraseñas con argon2id y auditoría en tabla
append-only. Detalles de decisiones en [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: Next.js 15 (App Router), React 19, Drizzle ORM + drizzle-kit, `postgres`
(driver), Zod (validación), `@node-rs/argon2`, Tailwind CSS, Nodemailer

**Storage**: PostgreSQL 16 con RLS; archivos (actas) en almacenamiento local abstraído tras una
interfaz simple (`FileStore`)

**Testing**: Vitest (unitarias e integración contra PostgreSQL real), Playwright (E2E de flujos P1)

**Target Platform**: Servidor Linux/Node; navegadores modernos en móvil y escritorio

**Project Type**: Aplicación web monolítica (un solo proyecto)

**Performance Goals**: listado de juntas con búsqueda/filtro < 2 s con 500 juntas (SC-006); login
< 30 s de punta a punta (SC-001)

**Constraints**: aislamiento por RLS obligatorio (Principio I); UI en español, responsiva, WCAG 2.1
AA básico; sin microservicios (Principio VII)

**Scale/Scope**: cientos de juntas, decenas a cientos de usuarios por junta; ~8 pantallas en este
módulo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento en el diseño | Estado |
|-----------|---------------------------|--------|
| I. Aislamiento estricto | `tenant_id` + RLS forzada en todas las tablas de junta; rol de BD de la app sin `BYPASSRLS`; pruebas de aislamiento | PASA |
| II. Roles | 5 roles en enum; autorización en servidor mediante `requireRole()` en cada acción | PASA |
| III. Spec-Driven | RF-01/02/04/05 trazados a historias y a tareas | PASA |
| IV. Seguridad y auditoría | argon2id, validación de cédula, `audit_log` append-only, secretos por entorno, desactivación lógica | PASA |
| V. Pruebas | Vitest para reglas (cédula, bloqueo, sectores) y aislamiento; Playwright para P1 | PASA |
| VI. UI en español/accesible | Next.js + Tailwind, textos en español, mockups como base | PASA |
| VII. Simplicidad | Monolito único; sin colas, sin servicios externos salvo SMTP | PASA |

**Post-diseño (Fase 1)**: se revisó el modelo de datos y los contratos; sin violaciones. Sin
entradas en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-gestion-plataforma/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── platform-actions.md
└── tasks.md             # lo genera /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (auth)/login/            # inicio de sesión y recuperación de contraseña
│   ├── (platform)/              # Super Administrador: panel, juntas, administradores
│   │   ├── panel/
│   │   └── juntas/
│   ├── (junta)/                 # Administrador de la Junta: configuración y cuentas
│   │   ├── configuracion/
│   │   └── usuarios/
│   └── api/                     # solo descarga de reporte y subida de actas
├── server/
│   ├── db/                      # esquema Drizzle, migraciones, contexto de tenant (RLS)
│   ├── auth/                    # sesiones, hash, bloqueo, requireRole
│   ├── services/                # juntas, administradores, usuarios, sectores, auditoría
│   └── validation/              # esquemas Zod, validación de cédula
├── components/                  # UI reutilizable (tabla, formularios, diálogos)
└── lib/                         # utilidades compartidas

drizzle/                         # migraciones SQL (incluye políticas RLS)
tests/
├── unit/                        # cédula, bloqueo, reglas de sectores
├── integration/                 # servicios + PostgreSQL real, pruebas de aislamiento RLS
└── e2e/                         # Playwright: login, alta de junta, asignar administrador
```

**Structure Decision**: proyecto único Next.js en la raíz del repositorio (sin separar frontend y
backend), con lógica de negocio en `src/server/` para que las pruebas de integración la ejerciten
sin pasar por la interfaz. Los módulos siguientes (administrativo, financiero, comunicaciones)
añadirán carpetas dentro de la misma estructura.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
