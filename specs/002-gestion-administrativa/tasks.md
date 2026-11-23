---

description: "Lista de tareas: Gestión Administrativa"
---

# Tasks: Gestión Administrativa

**Input**: Documentos de diseño en `/specs/002-gestion-administrativa/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/administrativo-actions.md](contracts/administrativo-actions.md)

**Tests**: Incluidos, porque la constitución (Principio V) exige pruebas automatizadas de reglas de negocio y de aislamiento multi-tenant.

**Organization**: Tareas agrupadas por historia de usuario para implementarlas y probarlas de forma independiente. Las restricciones de campos se citan desde `data-model.md` como `entidad.campo`.

## Format: `[ID] [P?] [Story] Descripción con ruta`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1…US5)

## Trazabilidad

| Historia | Prioridad | RF / Requisitos |
|----------|-----------|-----------------|
| US1 Nómina de socios | P1 | RF-07, FR-001 a FR-005 |
| US2 Eventos y asistencia | P1 | RF-08, RF-09, FR-006 a FR-011, FR-023 |
| US3 Predios y mapa | P2 | RF-10, RF-11, FR-012 a FR-015 |
| US4 Calendario de servicios | P2 | RF-12, FR-016 a FR-018 |
| US5 Consulta del Socio | P2 | FR-015, FR-019, FR-020 |
| Transversal | — | FR-021, FR-022, FR-024 |

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar dependencias y configuración

- [ ] T001 Instalar la dependencia `pdf-lib` en `package.json` (PDF en servidor, ver research.md §10)
- [ ] T002 [P] Documentar `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` y `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (opcionales, la clave debe restringirse por referente HTTP) en `.env.example` y en la sección de variables del `README.md`
- [ ] T003 [P] Ampliar `tests/integration/setup.ts` para que el `TRUNCATE` incluya `asistencia, turno, predio, servicio, evento, socio` antes de las tablas existentes
- [ ] T004 [P] Ampliar `src/server/db/limpiar-e2e.ts` para borrar, en orden de dependencias, `asistencia`, `turno`, `predio`, `servicio`, `evento` y `socio` de las juntas de prueba antes de `sector` y `junta`, y eliminar sus imágenes del `FileStore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Base de datos, permisos, navegación y utilidades que TODAS las historias necesitan

**⚠️ CRÍTICO**: ninguna historia puede empezar hasta terminar esta fase

- [ ] T005 Crear `drizzle/0005_administrativo.sql` con los enums y las tablas `socio`, `evento`, `asistencia`, `predio`, `servicio` y `turno` respetando enums, nulabilidad, longitudes, `CHECK` y unicidades de [data-model.md](data-model.md): `socio.cedula`, `socio.nombres`, `socio.sector_id`, `socio.telefono`, `socio.correo`, `socio.estado`, `socio.fecha_ingreso`, `evento.tipo`, `evento.titulo`, `evento.fecha`, `evento.lugar`, `evento.estado`, `evento.motivo_anulacion`, `asistencia.estado`, `asistencia.motivo`, `predio.codigo`, `predio.nombre`, `predio.superficie_ha`, `predio.latitud`, `predio.longitud`, `predio.imagen_ruta`, `predio.estado`, `servicio.nombre`, `servicio.tipo`, `servicio.estado`, `turno.dia_semana`, `turno.hora_inicio`, `turno.hora_fin`
- [ ] T006 En `drizzle/0005_administrativo.sql` añadir `UNIQUE (id, tenant_id)` a `sector`, las claves foráneas compuestas `(x_id, tenant_id)` (`asistencia.evento_id`, `asistencia.socio_id` y `turno.servicio_id`; y con `ON DELETE RESTRICT` `socio.sector_id`, `predio.sector_id`, `predio.socio_id` y `turno.sector_id`), la extensión `btree_gist`, la restricción de exclusión de `turno` sobre `turno.dia_semana`, `turno.hora_inicio` y `turno.hora_fin`, y los índices de la sección «Índices» de data-model.md
- [ ] T007 Crear `drizzle/0006_administrativo_rls.sql` con `ENABLE` y `FORCE ROW LEVEL SECURITY` y la política de aislamiento `app_role() = 'tenant' AND tenant_id = app_tenant()` para las seis tablas nuevas (sin acceso del `super_admin` ni de `auth`)
- [ ] T008 Crear `drizzle/0007_funciones_eventos.sql` con las funciones `SECURITY DEFINER` `total_eventos_plataforma()` y `eventos_plataforma_por_dia(anio, mes)` (solo `super_admin`, `search_path` fijo, hora de Ecuador, solo eventos con `evento.estado` activo, solo cifras)
- [ ] T009 Actualizar `src/server/db/migrate.ts` con los privilegios de [data-model.md](data-model.md) («Privilegios del rol de la aplicación»): `SELECT, INSERT, UPDATE` sobre `socio`, `evento`, `asistencia`, `predio` y `servicio` (sin `DELETE`), `SELECT, INSERT, UPDATE, DELETE` sobre `turno`, y `EXECUTE` sobre las dos funciones nuevas; aplicar las migraciones al esquema de desarrollo
- [ ] T010 Añadir las tablas nuevas a `src/server/db/schema.ts` (Drizzle) alineadas con `drizzle/0005_administrativo.sql` y exportar sus tipos
- [ ] T011 Ampliar la sesión con la cédula del usuario: `cedula` en `UsuarioSesion` y en la consulta de `validarToken` en `src/server/auth/session.ts` (ver research.md §1)
- [ ] T012 Crear `src/server/services/socio-sesion.ts` con `socioDeSesion(ctx, user)`: busca el `socio` con `tenant_id` y `cedula` iguales a los del usuario y devuelve `null` si no figura en el padrón (el socio nunca llega desde el cliente, ver research.md §2)
- [ ] T013 [P] Añadir a `src/lib/result.ts` los mensajes de error del módulo: `SOCIO_NO_ENCONTRADO`, `FECHA_FUTURA`, `EVENTO_NO_ENCONTRADO`, `EVENTO_ANULADO`, `EVENTO_FUTURO`, `SOCIO_NO_PERMITIDO`, `PREDIO_NO_ENCONTRADO`, `CODIGO_DUPLICADO`, `COORDENADAS_INVALIDAS`, `IMAGEN_INVALIDA`, `SERVICIO_NO_ENCONTRADO`, `SERVICIO_DUPLICADO`, `TURNO_NO_ENCONTRADO`, `TURNO_HORARIO_INVALIDO`, `TURNO_SOLAPADO`, `NO_EN_PADRON`
- [ ] T014 [P] Ampliar `src/server/files/file-store.ts`: subcarpetas anidadas validadas por segmento (`predios/<tenant_id>`), parámetro de tipos permitidos (solo PNG y JPEG para predios) y método `eliminar`; pruebas unitarias en `tests/unit/file-store.test.ts` (ruta fuera de la base, tipo no permitido, eliminar inexistente)
- [ ] T015 [P] Crear `src/lib/navegacion.ts` con `navegacionPara(rol)` (Secretario/a, Administrador, Tesorero/a y Socio con sus enlaces) y usarla en `src/app/(junta)/layout.tsx` y `src/app/(miembro)/inicio/page.tsx`
- [ ] T016 Crear `src/app/(gestion)/layout.tsx` que exige sesión de `secretario`, `admin_junta` o `tesorero` con `exigirSesion` y muestra el `AppShell` con la navegación de T015; añadir `contextoGestion(roles)` en `src/server/auth/page-guard.ts` que devuelve el contexto de tenant y el rol (redirige si no corresponde)
- [ ] T017 [P] Ampliar `tests/integration/helpers.ts` con ayudantes directos para crear `socio`, `evento`, `predio`, `servicio` y `turno` en una junta (conexión administradora)
- [ ] T018 Prueba de integración de aislamiento y restricciones en `tests/integration/rls-administrativo.test.ts`: un contexto de la junta A no ve ni modifica filas de B en las seis tablas; el `super_admin` y `auth` no ven nada; una clave foránea compuesta cruzada entre juntas falla; el rol de la aplicación no puede hacer `DELETE` en `socio`, `evento`, `asistencia`, `predio` ni `servicio` pero sí en `turno`; las funciones agregadas devuelven solo cifras y solo funcionan para `super_admin`

**Checkpoint**: base lista; las historias pueden comenzar

---

## Phase 3: User Story 1 - Mantener la nómina de socios (Priority: P1) 🎯 MVP

**Goal**: el Secretario/a registra, edita y da de baja lógica a socios, con búsqueda y filtros (RF-07).

**Independent Test**: registrar un socio, buscarlo por cédula, editarlo, marcarlo inactivo y comprobar que su ficha se conserva; la cédula inválida o repetida se rechaza.

### Tests for User Story 1

- [ ] T019 [P] [US1] Prueba unitaria de validación de socios (cédula normalizada y validada, nombres, teléfono, correo, fecha de ingreso no futura) en `tests/unit/socio.test.ts`
- [ ] T020 [P] [US1] Prueba de integración de `socio-service` (crear, duplicado de `socio.cedula` y `socio.correo`, editar sin cambiar la cédula, baja y reactivación, filtros por `socio.sector_id` y `socio.estado`, paginación, búsqueda con comodines literales, auditoría, aislamiento entre juntas, 1.000 socios en menos de 2 s) en `tests/integration/socios.test.ts`
- [ ] T021 [P] [US1] Prueba E2E de la nómina (alta, validaciones, búsqueda, edición, baja y un Tesorero/a que solo consulta) en `tests/e2e/socios.spec.ts`

### Implementation for User Story 1

- [ ] T022 [P] [US1] Crear `src/server/validation/socio.ts` con los esquemas Zod de alta, edición y filtros según `socio.cedula`, `socio.nombres`, `socio.sector_id`, `socio.telefono`, `socio.correo`, `socio.estado` y `socio.fecha_ingreso` de data-model.md
- [ ] T023 [P] [US1] Añadir `listarSectores(ctx)` a `src/server/services/configuracion-service.ts` para poblar los selectores de sector de todo el módulo
- [ ] T024 [US1] Implementar `src/server/services/socio-service.ts`: `listarSocios`, `obtenerSocio`, `crearSocio`, `editarSocio`, `desactivarSocio`, `reactivarSocio` con unicidad por junta (violaciones 23505 a `CEDULA_DUPLICADA` y `CORREO_DUPLICADO`), `fecha_ingreso` en hora de Ecuador y auditoría (`socio.crear|editar|desactivar|reactivar`)
- [ ] T025 [US1] Implementar las Server Actions de socios en `src/app/(gestion)/socios/actions.ts` (escritura solo `requireRole("secretario")`)
- [ ] T026 [US1] Construir el listado de la nómina con búsqueda, filtros y paginación en `src/app/(gestion)/socios/page.tsx` (el Administrador y el Tesorero/a no ven acciones de escritura)
- [ ] T027 [P] [US1] Construir `src/app/(gestion)/socios/SocioForm.tsx`, `nuevo/page.tsx` y `[id]/page.tsx` (ficha, edición, baja y reactivación con confirmación; la cédula se muestra sin poder editarse)

**Checkpoint**: US1 funcional y comprobable por sí sola (MVP)

---

## Phase 4: User Story 2 - Registrar eventos y asistencia (Priority: P1)

**Goal**: el Secretario/a registra asambleas y mingas, toma la asistencia con contadores y quórum, y el total de eventos alimenta el panel como cifra agregada (RF-08, RF-09).

**Independent Test**: crear una asamblea, marcar presentes, ausentes y un justificado, guardar y comprobar contadores, quórum y que se conserva al reabrir; el evento futuro no admite asistencia y el anulado no cuenta.

### Tests for User Story 2

- [ ] T028 [P] [US2] Prueba unitaria del cálculo de quórum y contadores (`presentes / total de la lista`, lista vacía, quórum del 100 %) en `tests/unit/quorum.test.ts`
- [ ] T029 [P] [US2] Prueba de integración de eventos y asistencia (`evento.tipo`, `evento.titulo`, `evento.fecha`, `evento.lugar`, anulación con `evento.motivo_anulacion`, `asistencia.estado`, `asistencia.motivo` obligatorio si es justificado, evento futuro y anulado rechazados, *upsert* en una transacción, lista con socios activos más quienes ya tienen fila, socios inactivos excluidos, auditoría, aislamiento) en `tests/integration/asistencia.test.ts`
- [ ] T030 [P] [US2] Prueba de integración de `listarInasistenciasInjustificadas` (solo `ausente` en eventos activos, filtros de fechas y socio) y del panel de plataforma con las funciones agregadas (total y por día, sin títulos) en `tests/integration/eventos-panel.test.ts`
- [ ] T031 [P] [US2] Prueba E2E de eventos y asistencia (crear evento, marcar todos, justificar con motivo, guardar, reabrir, anular y ver el total en el panel del Super Administrador) en `tests/e2e/asistencia.spec.ts`

### Implementation for User Story 2

- [ ] T032 [P] [US2] Crear `src/lib/quorum.ts` con el cálculo puro de contadores y quórum frente al parámetro `quorumPorcentaje` de la junta
- [ ] T033 [P] [US2] Crear `src/server/validation/evento.ts` y `src/server/validation/asistencia.ts` con los esquemas según `evento.tipo`, `evento.titulo`, `evento.fecha`, `evento.lugar`, `evento.estado`, `evento.motivo_anulacion`, `asistencia.estado` y `asistencia.motivo` de data-model.md
- [ ] T034 [US2] Implementar `src/server/services/evento-service.ts`: `listarEventos`, `obtenerEvento`, `crearEvento`, `editarEvento`, `anularEvento` (irreversible, con motivo y actor), con auditoría (`evento.crear|editar|anular`)
- [ ] T035 [US2] Implementar `src/server/services/asistencia-service.ts`: `obtenerListaAsistencia`, `guardarAsistencia` (una transacción, *upsert* por evento y socio, completa `evento.asistencia_registrada_en`, `registrado_*` y `modificado_*`) y `listarInasistenciasInjustificadas` (ver research.md §4 y §11)
- [ ] T036 [US2] Reemplazar `contarEventos` en `src/server/services/panel-service.ts` por las funciones `total_eventos_plataforma()` y `eventos_plataforma_por_dia()` y mostrar «N eventos» por día en el calendario del panel `src/app/(platform)/panel/page.tsx`
- [ ] T037 [US2] Implementar las Server Actions de eventos y asistencia en `src/app/(gestion)/eventos/actions.ts` (escritura solo `requireRole("secretario")`)
- [ ] T038 [US2] Construir el listado y el alta de eventos en `src/app/(gestion)/eventos/page.tsx` y `src/app/(gestion)/eventos/nuevo/page.tsx` con `EventoForm.tsx`
- [ ] T039 [US2] Construir el detalle de evento con anulación (diálogo de confirmación y motivo) en `src/app/(gestion)/eventos/[id]/page.tsx`
- [ ] T040 [US2] Construir la toma de asistencia en `src/app/(gestion)/eventos/[id]/asistencia/page.tsx` con el componente de cliente `ListaAsistencia.tsx` (búsqueda, «Marcar todos», justificación con motivo, contadores y quórum al instante, guardado de toda la lista)

**Checkpoint**: US1 y US2 funcionan de forma independiente; los datos de inasistencias ya están disponibles para Financiero

---

## Phase 5: User Story 3 - Registrar predios y verlos en el mapa (Priority: P2)

**Goal**: el Secretario/a registra predios con coordenadas e imagen y los ve en un mapa filtrando por sector; el Socio ve solo los suyos (RF-10, RF-11).

**Independent Test**: crear un predio con coordenadas e imagen, verlo en el mapa, filtrar por sector, y comprobar que su titular lo ve y otro socio no; sin clave de Maps se muestra la lista con coordenadas.

### Tests for User Story 3

- [ ] T041 [P] [US3] Prueba unitaria de validación de predios (`predio.latitud` y `predio.longitud` en rango y ambas o ninguna, `predio.superficie_ha`, `predio.codigo`) en `tests/unit/predio.test.ts`
- [ ] T042 [P] [US3] Prueba unitaria del cargador de Google Maps (sin clave falla de inmediato, un solo `<script>` por carga, tiempo máximo de 8 s, error de red) en `tests/unit/cargar-maps.test.ts`
- [ ] T043 [P] [US3] Prueba de integración de `predio-service` (`predio.codigo` único sin distinguir mayúsculas, `predio.sector_id` y `predio.socio_id` de la misma junta, sector con predios que no se puede eliminar, filtro por sector, el Socio solo ve los suyos, imagen guardada y reemplazada, datos del mapa mínimos, auditoría, aislamiento) en `tests/integration/predios.test.ts`
- [ ] T044 [P] [US3] Prueba E2E de predios (alta con imagen, mapa simulado con `addInitScript`, mapa sin clave con lista y aviso, código repetido y coordenadas inválidas rechazados, el Socio solo ve los suyos) en `tests/e2e/predios.spec.ts`

### Implementation for User Story 3

- [ ] T045 [P] [US3] Crear `src/server/validation/predio.ts` con los esquemas según `predio.codigo`, `predio.nombre`, `predio.superficie_ha`, `predio.sector_id`, `predio.socio_id`, `predio.latitud`, `predio.longitud`, `predio.imagen_ruta` y `predio.estado` de data-model.md; aviso (no error) si las coordenadas caen fuera de Ecuador
- [ ] T046 [P] [US3] Crear `src/lib/mapa/cargar-google-maps.ts`: carga del `<script>` de Google Maps una sola vez con tiempo máximo de 8 s y rechazo si no hay clave o hay error de red (ver research.md §8)
- [ ] T047 [US3] Implementar `src/server/services/predio-service.ts`: `listarPredios`, `datosMapaPredios`, `crearPredio`, `editarPredio`, `desactivarPredio`, `reactivarPredio`, `obtenerImagenPredio`; imagen guardada con `FileStore` en `predios/<tenant_id>` y la anterior eliminada al reemplazarla; el Socio se acota por `socioDeSesion`; auditoría (`predio.crear|editar|desactivar|reactivar|imagen`)
- [ ] T048 [US3] Implementar `src/app/api/predios/[id]/imagen/route.ts`: exige sesión, localiza el predio con la RLS del contexto, comprueba que un Socio pida solo los suyos y responde con `Cache-Control: private` (401, 403 genérico o 404)
- [ ] T049 [US3] Implementar las Server Actions de predios en `src/app/(gestion)/predios/actions.ts` (escritura solo `requireRole("secretario")`)
- [ ] T050 [P] [US3] Construir el componente de cliente `src/components/MapaPredios.tsx`: mapa con marcadores y ficha del predio seleccionado, y degradación a lista con coordenadas, enlace a Google Maps y aviso cuando no hay clave, falla la carga o no hay conexión
- [ ] T051 [US3] Construir las pantallas de predios en `src/app/(gestion)/predios/page.tsx` (mapa, lista y filtro por sector), `nuevo/page.tsx`, `[id]/page.tsx` y `PredioForm.tsx`

**Checkpoint**: US3 funcional; el mapa nunca bloquea el registro

---

## Phase 6: User Story 4 - Gestionar el calendario semanal de servicios (Priority: P2)

**Goal**: el Secretario/a gestiona servicios y turnos por sector sin solapamientos y el calendario semanal se consulta por sector (RF-12).

**Independent Test**: crear un servicio con dos turnos para un sector y ver la semana; un turno inválido o solapado se rechaza y uno contiguo es válido.

### Tests for User Story 4

- [ ] T052 [P] [US4] Prueba unitaria de validación de servicios y turnos (`turno.dia_semana`, `turno.hora_inicio` y `turno.hora_fin`, fin mayor que inicio, formato de hora) en `tests/unit/turno.test.ts`
- [ ] T053 [P] [US4] Prueba de integración de servicios y turnos (`servicio.nombre` único sin distinguir mayúsculas, `servicio.tipo`, `servicio.estado`, turno con fin menor o igual al inicio rechazado, solapamiento rechazado por la restricción incluso en dos guardados simultáneos, turnos contiguos válidos, mismo horario en otro sector o servicio válido, eliminar y editar, `turno.sector_id` de la misma junta, aislamiento) en `tests/integration/turnos.test.ts`
- [ ] T054 [P] [US4] Prueba E2E del calendario (crear servicio y turnos, rechazo de turno inválido y solapado, ver la semana por sector) en `tests/e2e/calendario.spec.ts`

### Implementation for User Story 4

- [ ] T055 [P] [US4] Crear `src/server/validation/servicio.ts` con los esquemas según `servicio.nombre`, `servicio.tipo`, `servicio.estado`, `turno.dia_semana`, `turno.hora_inicio` y `turno.hora_fin` de data-model.md
- [ ] T056 [US4] Implementar `src/server/services/servicio-service.ts`: servicios (`listar`, `crear`, `editar`, `desactivar`, `reactivar`) y turnos (`crear`, `editar`, `eliminar`) con traducción de los errores `23514` y `23P01` a `TURNO_HORARIO_INVALIDO` y `TURNO_SOLAPADO`, y auditoría (`servicio.*`, `turno.*`)
- [ ] T057 [US4] Implementar `src/server/services/calendario-service.ts` con `obtenerCalendarioSemanal(ctx, sectorId)` (turnos agrupados por día y próximos turnos)
- [ ] T058 [US4] Implementar las Server Actions de servicios y turnos en `src/app/(gestion)/servicios/actions.ts` (escritura solo `requireRole("secretario")`)
- [ ] T059 [P] [US4] Construir el componente `src/components/SemanaCalendario.tsx` (semana de lunes a domingo accesible, con estado vacío)
- [ ] T060 [US4] Construir las pantallas de servicios en `src/app/(gestion)/servicios/page.tsx`, `nuevo/page.tsx` y `[id]/page.tsx` (turnos con alta, edición y eliminación con confirmación) y el calendario en `src/app/(gestion)/calendario/page.tsx` con selector de sector

**Checkpoint**: US4 funcional (no depende de la nómina)

---

## Phase 7: User Story 5 - El Socio consulta su información e historial (Priority: P2)

**Goal**: el Socio ve su ficha, predios, el calendario de su sector y su historial con porcentaje de cumplimiento, y descarga el PDF (FR-015, FR-019, FR-020).

**Independent Test**: con un socio con asistencia registrada, iniciar sesión como ese socio, ver historial y porcentaje, descargar el PDF y comprobar que no accede a datos de otros socios; una cuenta sin registro en el padrón ve el aviso.

### Tests for User Story 5

- [ ] T061 [P] [US5] Prueba unitaria de `calcularCumplimiento` (presentes sobre presentes más ausentes, justificadas ni penalizan ni suman, sin eventos computables es «no aplica», redondeo, meta del 80 %) en `tests/unit/cumplimiento.test.ts`
- [ ] T062 [P] [US5] Prueba de integración de `mi-informacion-service` (solo cuenta con `socio.cedula` igual a la del usuario, `NO_EN_PADRON`, historial solo con eventos no anulados y de fecha igual o posterior a `socio.fecha_ingreso`, filtro por `evento.tipo`, un Socio no obtiene datos de otro socio, predios solo los suyos) en `tests/integration/mi-informacion.test.ts`
- [ ] T063 [P] [US5] Prueba de integración del PDF (respuesta `application/pdf` que empieza por `%PDF`, solo del propio socio, 401 sin sesión) en `tests/integration/historial-pdf.test.ts`
- [ ] T064 [P] [US5] Prueba E2E del Socio (ficha, predios, calendario de su sector, historial con porcentaje, descarga del PDF, aviso de cuenta sin padrón) en `tests/e2e/socio.spec.ts`

### Implementation for User Story 5

- [ ] T065 [P] [US5] Crear `src/lib/cumplimiento.ts` con `calcularCumplimiento` (research.md §5) y la meta de referencia del 80 %
- [ ] T066 [US5] Implementar `src/server/services/mi-informacion-service.ts`: `obtenerMiInformacion` (ficha, sector, predios) y `obtenerMiHistorial` (eventos con su estado, totales y cumplimiento), siempre acotados por `socioDeSesion`
- [ ] T067 [US5] Implementar `src/server/reportes/historial-pdf.ts` con `pdf-lib` (nombre, cédula, junta, fecha de emisión, detalle por evento, totales y porcentaje, fuente estándar con tildes) y la ruta `src/app/api/mi/asistencia.pdf/route.ts` (solo rol Socio, `Cache-Control: no-store`)
- [ ] T068 [P] [US5] Construir `src/components/TarjetaCumplimiento.tsx` (porcentaje, meta y totales presentes, justificadas e injustificadas)
- [ ] T069 [US5] Construir las pantallas del Socio en `src/app/(miembro)/mi/informacion/page.tsx` y `src/app/(miembro)/mi/asistencia/page.tsx` (filtro por tipo y botón de descarga) y actualizar `src/app/(miembro)/inicio/page.tsx` con el resumen y los accesos; los Socios acceden a `/predios` y `/calendario` en modo de solo lectura acotado

**Checkpoint**: todas las historias funcionan

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: calidad transversal

- [ ] T070 [P] Ampliar `tests/e2e/accesibilidad.spec.ts` para auditar con axe (escritorio y móvil) las pantallas nuevas de socios, eventos, asistencia, predios, servicios, calendario y del Socio, y los títulos descriptivos en cada una
- [ ] T071 [P] Revisar textos en español, la vista móvil y el foco del teclado de las pantallas nuevas en `src/app/(gestion)/` y `src/app/(miembro)/`
- [ ] T072 Revisión de seguridad: ninguna imagen ni ruta de archivo expuestas, el mapa y el PDF no registran datos personales en logs, `npm audit` sin vulnerabilidades y comprobar que ninguna consulta del Socio acepta un `socio_id` del cliente (FR-021)
- [ ] T073 [P] Actualizar `README.md` (estado del módulo, variables de Google Maps y pruebas nuevas) y `specs/001-gestion-plataforma/quickstart.md` si cambian comandos
- [ ] T074 Ejecutar la validación de [quickstart.md](quickstart.md) completa desde una base nueva y corregir lo que falle

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup; BLOQUEA todas las historias
- **US1 (P1)** y **US4 (P2)**: independientes entre sí tras Foundational
- **US2 (P1)**: requiere socios (US1) para tomar asistencia
- **US3 (P2)**: requiere socios (US1) para el titular y sectores del módulo 1
- **US5 (P2)**: requiere US1, US2 (historial), US3 (predios) y US4 (calendario del sector)
- **Polish**: depende de las historias deseadas

### Within Each User Story

- Las pruebas se escriben primero y deben fallar antes de implementar
- Validación → servicio → acciones o rutas → pantallas

### Parallel Opportunities

- Setup: T002, T003, T004
- Foundational: T013, T014, T015, T017 en paralelo tras T010
- Tras Foundational: US1 y US4 en paralelo; después US2 y US3 en paralelo; al final US5

## Parallel Example: User Story 1

```text
Task: "Validación de socios en tests/unit/socio.test.ts"
Task: "Servicio de socios en tests/integration/socios.test.ts"
Task: "Esquemas Zod en src/server/validation/socio.ts"
Task: "listarSectores en src/server/services/configuracion-service.ts"
```

## Implementation Strategy

### MVP primero (US1)

1. Setup → Foundational (migraciones, RLS, sesión con cédula, navegación) → US1 → validar la nómina.
2. Añadir US2 para tener asistencia y el total de eventos en el panel.

### Entrega incremental

1. Setup + Foundational → base lista
2. US1 → US2 (nómina y asistencia: lo más usado por la secretaría)
3. US3 y US4 en paralelo (predios y calendario)
4. US5 (consulta del Socio) y pulido final

## Notes

- Commits en español, uno por tarea o grupo lógico
- **[P]** = archivos distintos y sin dependencias pendientes
- Detenerse en cada checkpoint para validar la historia
- Las migraciones nuevas se aplican a la base de desarrollo y a la de pruebas; no se reescriben las anteriores
