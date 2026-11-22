# Research: Gestión de Plataforma (multi-junta)

No quedaron marcadores NEEDS CLARIFICATION; este documento registra las decisiones técnicas.

## 1. Estrategia multi-tenant

- **Decision**: una base de datos, un esquema compartido, columna `tenant_id` (= `junta_id`) en las
  tablas de cada junta, protegida con RLS.
- **Rationale**: es lo más simple con cientos de juntas; RLS cumple el Principio I sin depender del
  código de aplicación.
- **Alternatives considered**: esquema por junta (migraciones y conexiones costosas a esta escala);
  base por junta (excesivo); solo filtros en código (viola la constitución).

## 2. Cómo se aplica RLS desde la aplicación

- **Decision**: la app se conecta con un rol sin `BYPASSRLS` ni propietario de tablas
  (`FORCE ROW LEVEL SECURITY`). Cada petición abre una transacción y fija
  `set_config('app.tenant_id', ..., true)` y `app.role`. Las políticas comparan `tenant_id` con
  `current_setting('app.tenant_id')`. El Super Administrador usa `app.role = 'super_admin'`, con
  políticas que solo le permiten tablas de plataforma (juntas, designaciones, auditoría) y nunca
  datos internos de las juntas.
- **Rationale**: aislamiento verificable en pruebas de integración contra PostgreSQL real.
- **Alternatives considered**: un rol de BD por junta (inmanejable); Supabase RLS con JWT (añade
  dependencia externa).

## 3. Acceso a datos

- **Decision**: Drizzle ORM con migraciones SQL versionadas; las políticas RLS se escriben en SQL
  dentro de las migraciones.
- **Rationale**: tipado estricto y SQL explícito; Prisma complica el uso de `set_config` por
  transacción y las políticas RLS.
- **Alternatives considered**: Prisma; SQL puro con `postgres` (menos tipado).

## 4. Autenticación y sesiones

- **Decision**: sesiones opacas guardadas en BD (token aleatorio, hash en tabla) con cookie
  HttpOnly, Secure y SameSite=Lax; "mantener sesión" = expiración de 30 días frente a 12 horas;
  contraseñas con argon2id; bloqueo de 15 minutos tras 5 intentos fallidos; recuperación mediante
  token de un solo uso (hash en BD) con vigencia de 1 hora enviado por correo.
- **Rationale**: permite terminar sesiones al desactivar una junta o cuenta (edge case de la
  especificación), lo cual los JWT sin estado dificultan.
- **Alternatives considered**: Auth.js (flujo con identificador de junta y cédula poco natural);
  JWT sin estado (no revocables).

## 5. Identificación de la junta al iniciar sesión

- **Decision**: el campo "identificador de junta" (slug) es opcional. Si se omite y el correo o la
  cédula corresponden a cuentas en más de una junta, se solicita elegir la junta. Cédula y correo
  son únicos por junta, no globales. El Super Administrador no tiene junta.
- **Rationale**: respeta la suposición de una cuenta por junta sin ambigüedad.
- **Alternatives considered**: identificador obligatorio (peor experiencia, contradice el mockup).

## 6. Validación de cédula ecuatoriana

- **Decision**: función pura (10 dígitos, provincia 01–24 o 30, tercer dígito < 6, dígito
  verificador módulo 10) con pruebas unitarias; reutilizada en cliente y servidor.
- **Rationale**: regla de negocio crítica (Principios IV y V).

## 7. Auditoría

- **Decision**: tabla `audit_log` append-only (sin `UPDATE`/`DELETE` permitidos al rol de la app),
  escrita en la misma transacción que la operación; guarda actor, junta, acción, entidad, valores
  previos y nuevos.
- **Rationale**: garantiza consistencia y cumple el Principio IV.

## 8. Archivos (actas de designación)

- **Decision**: solo PDF/imagen, máximo 5 MB, validados por tipo real y tamaño; guardados detrás de
  la interfaz `FileStore` (disco local en desarrollo, intercambiable por almacenamiento de objetos).
- **Rationale**: simple hoy sin atar la arquitectura.

## 9. Correo

- **Decision**: Nodemailer sobre SMTP configurable; Mailpit en desarrollo.
- **Rationale**: único servicio externo necesario; sin proveedor propietario.

## 10. Reporte del panel

- **Decision**: descarga en CSV con totales y listado de juntas (datos agregados).
- **Rationale**: suficiente para el RF; PDF/Excel pueden añadirse después.

## 11. Pruebas

- **Decision**: Vitest (unitarias e integración contra PostgreSQL de prueba) y Playwright (E2E de
  login, alta de junta y asignación de administrador). Las pruebas de aislamiento crean dos juntas y
  comprueban que ninguna consulta cruza datos.
