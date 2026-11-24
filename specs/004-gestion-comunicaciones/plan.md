# Implementation Plan: Gestión de Comunicaciones

**Branch**: `004-gestion-comunicaciones` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

## Summary

Convocatorias, archivo y publicación de actas y resoluciones, registro de comunicaciones recibidas y
mensajería Socio–Administrador, sobre el mismo monolito Next.js + PostgreSQL con RLS. La
inmutabilidad (mensajes, documentos, convocatorias) se garantiza con permisos de columna del rol de
la aplicación, y la visibilidad para el Socio se aplica en la consulta y en las rutas de descarga.

## Technical Context

**Language/Version**: TypeScript estricto, Node 20+, Next.js 15 (App Router, Server Actions)
**Primary Dependencies**: Drizzle ORM, Zod, nodemailer (ya en uso); sin dependencias nuevas
**Storage**: PostgreSQL 16 con RLS; archivos en el FileStore existente (`documentos/<tenant>`, `comunicaciones/<tenant>`)
**Testing**: Vitest (unitarias + integración), Playwright + axe (E2E)
**Project Type**: Monolito web
**Constraints**: archivos PDF/PNG/JPEG ≤ 5 MB validados por firma; aviso por correo que nunca bloquea la publicación
**Scale/Scope**: cientos de socios por junta; miles de documentos y mensajes

## Constitution Check

| Principio | Cumplimiento |
|-----------|--------------|
| I. Aislamiento | Tablas con `tenant_id`, RLS forzada, claves foráneas compuestas; descargas con contexto de junta. |
| II. Roles | Solo `secretario` escribe convocatorias, documentos y comunicaciones; `admin_junta` y `tesorero` consultan; `admin_junta` y `socio` conversan; el Socio ve solo lo publicado. Validado en servidor y en rutas. |
| III. Trazabilidad | Historias y tareas citan RF-25 a RF-33. |
| IV. Seguridad y auditoría | Auditoría de emisiones, anulaciones, publicaciones y conversaciones; archivos validados por firma y tamaño; sin borrado físico. |
| V. Pruebas | Integración de visibilidad del Socio, aislamiento entre juntas, lectura de mensajes y correo. |
| VI. UI | Español, responsiva, axe en las pantallas nuevas. |
| VII. Simplicidad | Sin borradores ni edición posterior; la corrección es anular y reemitir; sin dependencias nuevas. |

## Project Structure

```text
drizzle/0010_comunicaciones.sql, 0011_comunicaciones_rls.sql
src/server/validation/comunicaciones.ts
src/server/services/{convocatoria-service, documento-service, comunicacion-service, mensajeria-service}.ts
src/app/(gestion)/{convocatorias, documentos, comunicaciones, mensajes}/
src/app/api/{documentos/[id], comunicaciones/[id]/adjunto}/route.ts
tests/{unit,integration,e2e}/
```

**Structure Decision**: mismas capas que los módulos anteriores (acciones → servicios → Drizzle con `withTenant`).

## Complexity Tracking

Sin violaciones de la constitución.
