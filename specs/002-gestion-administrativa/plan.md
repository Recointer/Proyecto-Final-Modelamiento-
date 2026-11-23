# Implementation Plan: Gestión Administrativa

**Branch**: `002-gestion-administrativa` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-gestion-administrativa/spec.md`

## Summary

Segundo módulo de la plataforma: nómina de socios (RF-07), eventos y asistencia a asambleas y mingas
(RF-08, RF-09), predios con localización en mapa (RF-10, RF-11), calendario semanal de servicios
(RF-12) y consulta del Socio de su ficha, predios e historial de asistencia con PDF.

Enfoque técnico: misma arquitectura del módulo 1 (monolito Next.js 15, PostgreSQL con RLS por
`tenant_id`, servicios en `src/server/services/`, Server Actions). Novedades de diseño, detalladas en
[research.md](research.md):

- Seis tablas nuevas con **claves foráneas compuestas** `(id, tenant_id)` que hacen imposible, a nivel
  de base de datos, referenciar un registro de otra junta.
- Vínculo padrón–cuenta **por cédula** dentro de la junta; el Socio solo ve lo suyo porque cada
  consulta se acota con el `socio_id` derivado de su sesión.
- Conteo de eventos del panel de plataforma mediante **funciones `SECURITY DEFINER`** que solo devuelven
  cifras agregadas.
- Mapa con la API de Google Maps cargada en el navegador y **degradación a lista con coordenadas**.
- Imágenes de predios en el `FileStore` existente, servidas por una ruta autenticada y aislada.
- PDF del historial generado en el servidor con `pdf-lib` (única dependencia nueva).
- Turnos sin solapamiento garantizados por una **restricción de exclusión** (`btree_gist`).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS

**Primary Dependencies**: las del módulo 1 (Next.js 15, React 19, Drizzle ORM, `postgres`, Zod, Tailwind)
más `pdf-lib` (PDF en servidor). Google Maps JavaScript API se carga en el navegador desde Google, sin
paquete npm.

**Storage**: PostgreSQL 16+ con RLS (extensión `btree_gist` para turnos); imágenes de predios en el
`FileStore` (disco local detrás de una interfaz)

**Testing**: Vitest (unitarias e integración contra PostgreSQL real), Playwright + axe-core (E2E y
accesibilidad)

**Target Platform**: servidor Node; navegadores modernos en móvil y escritorio

**Project Type**: aplicación web monolítica (un solo proyecto, el mismo del módulo 1)

**Performance Goals**: búsqueda en nómina de 1.000 socios < 2 s (SC-004); mapa con 500 predios fluido
(SC-007); asistencia de 100 socios guardada en una sola transacción (SC-002)

**Constraints**: aislamiento por RLS (Principio I); sin dependencias de servicios nuevos; el mapa nunca
bloquea el registro; imágenes ≤ 5 MB; UI en español y WCAG 2.1 AA

**Scale/Scope**: cientos de juntas; hasta ~1.000 socios, ~500 predios y decenas de eventos por año por
junta; ~14 pantallas nuevas

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento en el diseño | Estado |
|-----------|---------------------------|--------|
| I. Aislamiento estricto | Todas las tablas con `tenant_id`, RLS forzada y FK compuestas `(id, tenant_id)`; imágenes bajo una carpeta por junta y descarga validada contra RLS; el Super Administrador solo accede a cifras agregadas mediante funciones acotadas | PASA |
| II. Roles | Secretario/a modifica; Administrador de la Junta y Tesorero/a consultan; el Socio solo lo suyo. Autorización en servidor con `requireRole` y filtro por `socio_id` de la sesión | PASA |
| III. Spec-Driven | RF-07 a RF-12 trazados a historias y tareas | PASA |
| IV. Seguridad y auditoría | Cédula validada; auditoría de altas, cambios, anulaciones y asistencia; bajas lógicas (sin `DELETE` en socio, evento, predio, servicio); imágenes validadas por firma; clave de Maps restringida por dominio | PASA |
| V. Pruebas | Cumplimiento, rangos geográficos, solapamiento de turnos, aislamiento (incluida la FK compuesta) y reglas de asistencia con pruebas automatizadas | PASA |
| VI. UI en español/accesible | Misma base de componentes; auditoría axe ampliada a las pantallas nuevas | PASA |
| VII. Simplicidad | Sin servicios nuevos; una dependencia npm (`pdf-lib`); degradación sin mapa en vez de un proveedor alternativo | PASA con justificación |

**Post-diseño (Fase 1)**: el modelo de datos y los contratos no introducen violaciones. Dos decisiones
requieren justificación y están en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-gestion-administrativa/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── administrativo-actions.md
└── tasks.md             # lo genera /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (gestion)/                   # Secretario/a (modifica), Administrador y Tesorero/a (consulta)
│   │   ├── socios/                  # nómina: listado, alta, ficha
│   │   ├── eventos/                 # eventos y asistencia: listado, alta, detalle, [id]/asistencia
│   │   ├── predios/                 # listado + mapa, alta, ficha
│   │   └── servicios/               # servicios y turnos; calendario semanal en /calendario
│   ├── (miembro)/                   # Socio (y vista inicial): inicio, mi/informacion, mi/asistencia
│   └── api/
│       ├── predios/[id]/imagen/     # descarga autenticada de la imagen
│       └── mi/asistencia.pdf/       # PDF del historial del propio socio
├── server/
│   ├── db/                          # esquema (tablas nuevas) y migración 0005
│   ├── services/                    # socio, evento, asistencia, predio, servicio, calendario, mi-informacion
│   ├── validation/                  # socio, evento, asistencia, predio (coordenadas), servicio/turno
│   ├── reportes/                    # generación del PDF (pdf-lib) y cálculo de cumplimiento
│   └── files/                       # FileStore ampliado: subcarpetas anidadas, tipos permitidos, eliminar
├── components/                      # MapaPredios (cliente), TarjetaCumplimiento, SemanaCalendario, ListaAsistencia
└── lib/                             # navegacion por rol, cumplimiento (cálculo puro), cargador de Google Maps

drizzle/0005_administrativo.sql      # tablas, índices, RLS, btree_gist, funciones agregadas
tests/
├── unit/                            # cumplimiento, coordenadas, validaciones, cargador de mapas
├── integration/                     # servicios + RLS + restricciones + funciones agregadas
└── e2e/                             # nómina, asistencia, predios y mapa (con y sin clave), turnos, socio
```

**Structure Decision**: se extiende el proyecto único existente. Un layout `(gestion)` agrupa las
pantallas de operación con una navegación calculada por rol (`src/lib/navegacion.ts`), que también
usan los layouts existentes para no duplicar menús. La lógica de negocio vive en `src/server/services/`
para probarla sin pasar por la interfaz.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Extensión `btree_gist` para la restricción de exclusión de turnos | Impedir solapamientos de horario en la base de datos, también ante dos guardados simultáneos | Validar solo en la aplicación deja una ventana de carrera y exigiría bloqueos explícitos; es una extensión estándar de PostgreSQL |
| Dos funciones `SECURITY DEFINER` (`total_eventos_plataforma`, `eventos_plataforma_por_dia`) | El Super Administrador necesita el total de eventos sin poder leer filas de las juntas | Una política RLS de lectura para el Super Administrador expondría los eventos completos, violando el Principio I |
