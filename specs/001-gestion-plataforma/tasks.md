---

description: "Lista de tareas: Gestión de Plataforma (multi-junta)"
---

# Tasks: Gestión de Plataforma (multi-junta)

**Input**: Documentos de diseño en `/specs/001-gestion-plataforma/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/platform-actions.md](contracts/platform-actions.md)

**Tests**: Incluidos, porque la constitución (Principio V) exige pruebas automatizadas de reglas de negocio y de aislamiento multi-tenant.

**Organization**: Tareas agrupadas por historia de usuario para implementarlas y probarlas de forma independiente.

## Format: `[ID] [P?] [Story] Descripción con ruta`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1…US6)
- Las restricciones de campos se citan desde `data-model.md` como `Entidad.campo`

## Trazabilidad

| Historia | Prioridad | RF / Requisitos |
|----------|-----------|-----------------|
| US1 Iniciar sesión | P1 | FR-001 a FR-004, FR-017 |
| US2 Administrar juntas | P1 | RF-01, FR-005 a FR-008 |
| US3 Administrador de la junta | P2 | RF-04, FR-009 a FR-011 |
| US4 Panel del Super Administrador | P2 | FR-012 |
| US5 Configuración de la junta | P2 | RF-02, FR-013, FR-014 |
| US6 Cuentas de socios | P2 | RF-05, FR-015 a FR-017 |
| Transversal | — | FR-018 a FR-021 |

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicializar el proyecto según el plan

- [ ] T001 Crear proyecto Next.js 15 (App Router, TypeScript estricto, Tailwind) en la raíz con la estructura de `src/`, `tests/` y `drizzle/` definida en plan.md
- [ ] T002 Instalar dependencias (drizzle-orm, drizzle-kit, postgres, zod, @node-rs/argon2, nodemailer, vitest, @playwright/test) en `package.json` y añadir scripts `db:migrate`, `db:seed`, `test`, `test:integration`, `test:e2e`, `typecheck`, `lint`
- [ ] T003 [P] Configurar ESLint y Prettier en `eslint.config.mjs` y `.prettierrc`
- [ ] T004 [P] Crear `.env.example` con `DATABASE_URL`, `DATABASE_ADMIN_URL`, `SESSION_SECRET`, `SMTP_URL`, `FILE_STORE_DIR` y un `docker-compose.yml` con PostgreSQL 16 y Mailpit para desarrollo
- [ ] T005 [P] Configurar Vitest en `vitest.config.ts` (proyectos unit e integration) y Playwright en `playwright.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura que TODAS las historias necesitan

**⚠️ CRÍTICO**: ninguna historia puede empezar hasta terminar esta fase

- [ ] T006 Definir el esquema Drizzle de `junta`, `usuario`, `sector`, `designacion_administrador`, `sesion`, `token_recuperacion` y `audit_log` en `src/server/db/schema.ts` respetando enums, unicidades y nulabilidad de [data-model.md](data-model.md) (`usuario.rol`, `usuario.estado`, `usuario.tenant_id`, `junta.estado`, `junta.tipo`)
- [ ] T007 Generar la migración inicial en `drizzle/0000_init.sql` y crear el rol de la aplicación sin `BYPASSRLS`, con `INSERT`/`SELECT` solamente sobre `audit_log` (ver `audit_log` en data-model.md)
- [ ] T008 Escribir las políticas RLS con `FORCE ROW LEVEL SECURITY` en `drizzle/0001_rls.sql` según la sección "Políticas RLS" de data-model.md (tablas con `tenant_id` y reglas del `super_admin`)
- [ ] T009 Implementar el contexto de tenant en `src/server/db/context.ts`: función `withTenant(ctx, fn)` que abre transacción y fija `app.tenant_id` y `app.role` con `set_config(..., true)`
- [ ] T010 [P] Implementar la validación de cédula ecuatoriana en `src/server/validation/cedula.ts` (10 dígitos, provincia, tercer dígito, módulo 10) para `usuario.cedula`
- [ ] T011 [P] Prueba unitaria de cédula (válidas, dígito verificador incorrecto, longitud, provincia) en `tests/unit/cedula.test.ts`
- [ ] T012 [P] Implementar hash y verificación de contraseñas con argon2id y validación de fortaleza en `src/server/auth/password.ts`
- [ ] T013 Implementar sesiones opacas en `src/server/auth/session.ts` (crear, validar, revocar por usuario y por junta; cookie HttpOnly/Secure/SameSite=Lax; expiración según `sesion.expira_en` y `sesion.recordar`)
- [ ] T014 Implementar `requireRole()` y obtención del contexto actual en `src/server/auth/guard.ts` (autorización siempre en servidor, Principio II)
- [ ] T015 [P] Implementar el servicio de auditoría en `src/server/services/audit.ts` que escribe en `audit_log` dentro de la misma transacción (`audit_log.accion`, `antes`, `despues`)
- [ ] T016 [P] Implementar el formato de resultado `{ ok, data | error }` y el catálogo de errores en español en `src/lib/result.ts` según contracts/platform-actions.md
- [ ] T017 [P] Implementar la interfaz `FileStore` con almacenamiento en disco en `src/server/files/file-store.ts` (validación de tipo real PDF/imagen y máximo 5 MB para `designacion_administrador.acta_ruta`)
- [ ] T018 [P] Implementar el envío de correo con Nodemailer en `src/server/mail/mailer.ts`
- [ ] T019 Crear el seed del Super Administrador inicial y dos juntas de ejemplo en `src/server/db/seed.ts`
- [ ] T020 Prueba de integración de aislamiento RLS en `tests/integration/rls-isolation.test.ts`: dos juntas, un usuario de A no obtiene filas de `usuario` ni `sector` de B, y sin `app.tenant_id` no se obtienen filas
- [ ] T021 [P] Crear el layout base en español, responsivo, con navegación por rol, en `src/app/layout.tsx` y `src/components/AppShell.tsx` (basado en los mockups)
- [ ] T022 [P] Crear componentes reutilizables (tabla paginada, campo de formulario con error, diálogo de confirmación, estado vacío) en `src/components/`

**Checkpoint**: base lista; las historias pueden comenzar

---

## Phase 3: User Story 1 - Iniciar sesión en el portal (Priority: P1) 🎯 MVP

**Goal**: cualquier rol inicia sesión con correo o cédula, mantiene sesión y recupera contraseña.

**Independent Test**: con una cuenta del seed, iniciar sesión y llegar al espacio del rol; credenciales erróneas se rechazan; 5 fallos bloquean la cuenta.

### Tests for User Story 1

- [ ] T023 [P] [US1] Prueba unitaria del bloqueo por intentos fallidos (`usuario.intentos_fallidos`, `usuario.bloqueado_hasta`) en `tests/unit/lockout.test.ts`
- [ ] T024 [P] [US1] Prueba de integración de `iniciarSesion` (válido, genérico en error, cuenta o junta desactivada, junta equivocada, elegir junta) en `tests/integration/login.test.ts`
- [ ] T025 [P] [US1] Prueba de integración de recuperación de contraseña (token de un solo uso, vigencia 1 h: `token_recuperacion.expira_en`, `token_recuperacion.usado_en`) en `tests/integration/password-reset.test.ts`
- [ ] T026 [P] [US1] Prueba E2E de inicio de sesión en `tests/e2e/login.spec.ts`

### Implementation for User Story 1

- [ ] T027 [US1] Implementar el servicio de autenticación en `src/server/services/auth-service.ts`: búsqueda por correo/cédula con `junta` opcional, bloqueo de 15 min tras 5 fallos, rechazo por `usuario.estado` o `junta.estado` desactivados, redirección por `usuario.rol`
- [ ] T028 [US1] Implementar el servicio de recuperación y cambio de contraseña (incluye `usuario.debe_cambiar_password`) en `src/server/services/password-service.ts`
- [ ] T029 [US1] Implementar las Server Actions `iniciarSesion`, `cerrarSesion`, `solicitarRecuperacion`, `restablecerPassword`, `cambiarPasswordInicial` en `src/app/(auth)/actions.ts`
- [ ] T030 [US1] Construir la pantalla "Portal de Acceso Comunal" (identificador de junta opcional, correo o cédula, contraseña, mantener sesión, ¿Olvidó su contraseña?) en `src/app/(auth)/login/page.tsx`
- [ ] T031 [P] [US1] Construir las pantallas de recuperación y cambio de contraseña inicial en `src/app/(auth)/recuperar/page.tsx` y `src/app/(auth)/cambiar-password/page.tsx`
- [ ] T032 [US1] Implementar el middleware que protege rutas y fuerza el cambio de contraseña inicial en `src/middleware.ts`

**Checkpoint**: US1 funcional y comprobable por sí sola (MVP)

---

## Phase 4: User Story 2 - Registrar y administrar juntas (Priority: P1)

**Goal**: el Super Administrador lista, busca, filtra, crea, edita, desactiva y reactiva juntas (RF-01).

**Independent Test**: crear una junta, verla en el listado, editarla, desactivarla y comprobar que sus usuarios no ingresan.

### Tests for User Story 2

- [ ] T033 [P] [US2] Prueba de integración del servicio de juntas (crear, duplicado, editar, desactivar con cierre de sesiones, reactivar, auditoría) en `tests/integration/juntas.test.ts`
- [ ] T034 [P] [US2] Prueba de integración de búsqueda y filtros por provincia, cantón y parroquia, y rendimiento con 500 juntas (SC-006) en `tests/integration/juntas-listado.test.ts`
- [ ] T035 [P] [US2] Prueba E2E de alta y desactivación de junta en `tests/e2e/juntas.spec.ts`

### Implementation for User Story 2

- [ ] T036 [US2] Implementar el servicio de juntas en `src/server/services/junta-service.ts`: validar `junta.slug`, `junta.tipo`, unicidad (`junta.nombre`, `junta.parroquia`), transición de `junta.estado`, revocar sesiones al desactivar y auditar
- [ ] T037 [US2] Implementar listado con búsqueda, filtros y paginación en `src/server/services/junta-service.ts` (función `listarJuntas`) con índices en la migración `drizzle/0002_indices.sql`
- [ ] T038 [US2] Implementar las Server Actions `listarJuntas`, `crearJunta`, `editarJunta`, `desactivarJunta`, `reactivarJunta` en `src/app/(platform)/juntas/actions.ts` con `requireRole('super_admin')`
- [ ] T039 [US2] Construir la pantalla "Listado de Organizaciones Comunitarias" con búsqueda, filtros y botón "Agregar Nueva Junta" en `src/app/(platform)/juntas/page.tsx`
- [ ] T040 [P] [US2] Construir el formulario de alta/edición de junta y el diálogo de confirmación de desactivación en `src/app/(platform)/juntas/JuntaForm.tsx`

**Checkpoint**: US1 y US2 funcionan de forma independiente

---

## Phase 5: User Story 3 - Asignar y cambiar el Administrador de una junta (Priority: P2)

**Goal**: el Super Administrador asigna y cambia al Administrador con cédula y acta validadas (RF-04).

**Independent Test**: asignar administrador a una junta nueva, comprobar que ingresa y solo ve su junta; cambiarlo y verificar que el anterior pasa a socio.

### Tests for User Story 3

- [ ] T041 [P] [US3] Prueba de integración de asignación y cambio (cédula inválida, acta inválida, motivo obligatorio, un solo administrador vigente, auditoría) en `tests/integration/administrador.test.ts`
- [ ] T042 [P] [US3] Prueba E2E de asignar administrador y primer ingreso con cambio de contraseña en `tests/e2e/administrador.spec.ts`

### Implementation for User Story 3

- [ ] T043 [US3] Implementar el servicio de designación en `src/server/services/administrador-service.ts`: transacción que actualiza `designacion_administrador.vigente`, `designacion_administrador.motivo`, `usuario.rol` y credencial inicial (`usuario.debe_cambiar_password`), con validación de `usuario.cedula`
- [ ] T044 [US3] Implementar el Route Handler `POST /api/actas` en `src/app/api/actas/route.ts` usando `FileStore` (`designacion_administrador.acta_ruta`) y `requireRole('super_admin')`
- [ ] T045 [US3] Implementar las Server Actions `asignarAdministrador` y `cambiarAdministrador` en `src/app/(platform)/juntas/[id]/administrador/actions.ts`
- [ ] T046 [US3] Construir la pantalla "Gestión de Super Administradores" (tarjetas Asignar y Cambiar, con administrador actual) en `src/app/(platform)/juntas/[id]/administrador/page.tsx`
- [ ] T047 [US3] Enviar al nuevo administrador su credencial inicial por correo mediante `src/server/mail/mailer.ts` desde `administrador-service.ts`

**Checkpoint**: US3 funcional; las juntas ya se pueden habilitar de punta a punta

---

## Phase 6: User Story 4 - Panel de control del Super Administrador (Priority: P2)

**Goal**: panel con totales, calendario y descarga de reporte (solo agregados).

**Independent Test**: con varias juntas y eventos, los totales coinciden y el CSV se descarga.

### Tests for User Story 4

- [ ] T048 [P] [US4] Prueba de integración de `obtenerPanel` (totales, evento = 0 si no hay módulo de eventos, sin acceso a datos internos) en `tests/integration/panel.test.ts`

### Implementation for User Story 4

- [ ] T049 [US4] Implementar el servicio del panel en `src/server/services/panel-service.ts` (totales de juntas y eventos agregados)
- [ ] T050 [US4] Implementar `GET /api/reportes/plataforma.csv` en `src/app/api/reportes/plataforma.csv/route.ts` con `requireRole('super_admin')`
- [ ] T051 [US4] Construir la pantalla "Panel de Control Territorial" (tarjetas, calendario, descargar reporte) en `src/app/(platform)/panel/page.tsx`

**Checkpoint**: US4 funcional

---

## Phase 7: User Story 5 - Configurar los datos generales de la junta (Priority: P2)

**Goal**: el Administrador edita datos, parámetros y sectores de su junta (RF-02).

**Independent Test**: editar datos y sectores; los cambios se guardan y no son visibles desde otra junta.

### Tests for User Story 5

- [ ] T052 [P] [US5] Prueba de integración de configuración y sectores (unicidad `sector.nombre` por junta, bloqueo de eliminación con asociados, acceso a otra junta denegado) en `tests/integration/configuracion.test.ts`

### Implementation for User Story 5

- [ ] T053 [US5] Implementar el servicio de configuración y sectores en `src/server/services/configuracion-service.ts` (incluye `junta.parametros`, `sector.nombre`, verificación de asociados)
- [ ] T054 [US5] Implementar las Server Actions `obtenerConfiguracion`, `actualizarConfiguracion`, `crearSector`, `editarSector`, `eliminarSector` en `src/app/(junta)/configuracion/actions.ts` con `requireRole('admin_junta')`
- [ ] T055 [US5] Construir la pantalla de configuración de la junta y gestión de sectores en `src/app/(junta)/configuracion/page.tsx`

**Checkpoint**: US5 funcional

---

## Phase 8: User Story 6 - Administrar cuentas de socios (Priority: P2)

**Goal**: el Administrador crea, edita y desactiva cuentas y asigna roles internos (RF-05).

**Independent Test**: crear una cuenta, iniciar sesión con ella, desactivarla y verificar que ya no ingresa.

### Tests for User Story 6

- [ ] T056 [P] [US6] Prueba de integración del servicio de usuarios (cédula y correo únicos por junta, roles permitidos, no desactivarse a sí mismo, cierre de sesiones al desactivar, auditoría) en `tests/integration/usuarios.test.ts`
- [ ] T057 [P] [US6] Prueba E2E de crear cuenta, primer ingreso y desactivación en `tests/e2e/usuarios.spec.ts`

### Implementation for User Story 6

- [ ] T058 [US6] Implementar el servicio de usuarios en `src/server/services/usuario-service.ts`: unicidad de `usuario.cedula` y `usuario.correo` por `usuario.tenant_id`, `usuario.rol` limitado a secretario/tesorero/socio, `usuario.estado`, credencial inicial con `usuario.debe_cambiar_password`
- [ ] T059 [US6] Implementar las Server Actions `listarUsuarios`, `crearUsuario`, `editarUsuario`, `desactivarUsuario`, `reactivarUsuario`, `restablecerCredencialInicial` en `src/app/(junta)/usuarios/actions.ts` con `requireRole('admin_junta')`
- [ ] T060 [US6] Construir la pantalla de listado de cuentas con búsqueda y filtros en `src/app/(junta)/usuarios/page.tsx`
- [ ] T061 [P] [US6] Construir el formulario de alta/edición de cuenta (con mostrar credencial inicial una sola vez) en `src/app/(junta)/usuarios/UsuarioForm.tsx`

**Checkpoint**: todas las historias funcionan

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: calidad transversal

- [ ] T062 [P] Revisión de accesibilidad WCAG 2.1 AA básica (contraste, etiquetas, teclado) en todas las pantallas de `src/app/`
- [ ] T063 [P] Revisión de textos en español y de adaptación móvil de las pantallas de `src/app/`
- [ ] T064 Revisión de seguridad: ningún secreto en logs, cabeceras de seguridad en `next.config.ts`, 403 genérico para acceso entre juntas (FR-018)
- [ ] T065 Ejecutar la validación de [quickstart.md](quickstart.md) completa y corregir lo que falle
- [ ] T066 [P] Escribir el `README.md` con instalación, variables de entorno y comandos del proyecto

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup; BLOQUEA todas las historias
- **US1 y US2 (P1)**: tras Foundational; independientes entre sí, pero US2 usa la sesión de US1 para probarse de punta a punta
- **US3**: requiere US2 (junta existente) y US1 (primer ingreso del administrador)
- **US4**: requiere US2 (juntas a contar)
- **US5 y US6**: requieren US3 (existe un Administrador de la Junta) y US1
- **Polish**: depende de las historias deseadas

### Within Each User Story

- Las pruebas se escriben primero y deben fallar antes de implementar
- Esquema → servicio → acciones → pantallas

### Parallel Opportunities

- Setup: T003, T004, T005
- Foundational: T010–T012, T015–T018, T021, T022
- Tras Foundational: US1 y US2 en paralelo por distintos desarrolladores; después US4, US5 y US6 en paralelo

## Parallel Example: User Story 1

```text
Task: "Prueba unitaria de bloqueo en tests/unit/lockout.test.ts"
Task: "Prueba de integración de login en tests/integration/login.test.ts"
Task: "Prueba de integración de recuperación en tests/integration/password-reset.test.ts"
Task: "Pantallas de recuperación en src/app/(auth)/recuperar/page.tsx"
```

## Implementation Strategy

### MVP primero (US1)

1. Setup → Foundational → US1 → validar el login con el Super Administrador del seed.
2. Añadir US2 (juntas) para tener el primer valor de negocio demostrable.

### Entrega incremental

1. Setup + Foundational → base lista
2. US1 → US2 → US3 (plataforma habilitada de punta a punta)
3. US4, US5, US6 en paralelo
4. Polish y validación del quickstart

## Notes

- Commits en español, uno por tarea o grupo lógico
- [P] = archivos distintos y sin dependencias pendientes
- Detenerse en cada checkpoint para validar la historia
