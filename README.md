# Sistema Multi-Junta de Gestión Integral

Plataforma **multi-junta (multi-tenant)** para juntas parroquiales y comunitarias del Ecuador (juntas de
riego, de agua potable, comités barriales, etc.). Una sola instalación atiende a muchas juntas; cada una
administra su información de forma independiente y aislada.

Proyecto de *Modelamiento y Diseño de Software* (Universidad Técnica de Ambato, 3.º Software B),
desarrollado con **Spec-Driven Development** usando [GitHub Spec Kit](https://github.com/github/spec-kit).

## Estado

| Módulo | Estado |
|--------|--------|
| **Gestión de Plataforma** (inicio de sesión, juntas, administrador, panel, configuración, cuentas) | Implementado |
| Gestión Administrativa (socios, asistencia, predios, calendario) | Completo: nómina de socios, eventos y asistencia con quórum, predios con mapa de Google (con degradación a lista), servicios con turnos y calendario semanal, y consulta del Socio con historial de asistencia en PDF |
| Gestión Financiera (ingresos, egresos, multas, comprobantes, inventarios, reportes) | Completo: conceptos y cargos por año, pagos con comprobante consecutivo en PDF, multas por inasistencia, egresos con respaldo, resumen de caja, reportes en PDF y CSV, inventario, activos fijos y estado de cuenta del Socio |
| Gestión de Comunicaciones (convocatorias, actas, mensajería) | Pendiente |

Cubre los requerimientos RF-01, RF-02, RF-04 y RF-05 más el inicio de sesión y el panel de la plataforma.
El detalle está en [`specs/001-gestion-plataforma/`](specs/001-gestion-plataforma/).

## Roles

Super Administrador (plataforma) · Administrador de la Junta · Secretario/a · Tesorero/a · Miembro/Socio.
La autorización se valida siempre en el servidor.

## Tecnología

- **Next.js 15** (App Router, Server Actions) y **TypeScript** estricto, Tailwind CSS
- **PostgreSQL 16+** con **Row Level Security** por junta (`tenant_id`), Drizzle ORM, migraciones SQL propias
- Sesiones opacas en base de datos (cookie HttpOnly), contraseñas con **argon2id**
- Vitest (unitarias e integración), Playwright + axe-core (E2E y accesibilidad), Mailpit (correo en desarrollo)

## Puesta en marcha

Requisitos: Node.js 22 o superior, PostgreSQL 16+ (o Docker) y, opcionalmente, Docker para Mailpit.

```powershell
npm install
Copy-Item .env.example .env   # y ajuste las credenciales
```

1. **Base de datos.** Cree una base vacía llamada `multijunta` (en su PostgreSQL local, o con
   `docker compose up -d db`, que la expone en el puerto **5433**).
2. **Variables de entorno** (`.env`):
   - `DATABASE_ADMIN_URL`: usuario con permisos para migrar (propietario del esquema).
   - `DATABASE_URL`: rol de la aplicación. La migración lo crea sin `BYPASSRLS`, no es propietario de las tablas.
   - `SESSION_SECRET`, `SMTP_URL`, `FILE_STORE_DIR`, `APP_URL`.
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` y `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (opcionales): mapa de predios; sin clave se muestra la lista con coordenadas.
   - `SEED_SUPERADMIN_CEDULA`, `SEED_SUPERADMIN_CORREO`, `SEED_SUPERADMIN_PASSWORD`: Super Administrador inicial (cédula válida y contraseña de 10+ caracteres con letras y números).
3. **Migrar y sembrar:**

   ```powershell
   npm run db:migrate
   npm run db:seed
   ```

4. **Correo en desarrollo** (opcional): `docker compose up -d mailpit`; bandeja en <http://localhost:8025>.
5. **Arrancar:**

   ```powershell
   npm run dev
   ```

   Abra <http://localhost:3000> e ingrese con el Super Administrador del seed.

La guía de validación paso a paso está en [`specs/001-gestion-plataforma/quickstart.md`](specs/001-gestion-plataforma/quickstart.md).

## Pruebas

| Comando | Qué ejecuta |
|---------|-------------|
| `npm test` | Pruebas unitarias |
| `npm run test:integration` | Servicios contra PostgreSQL real, incluido el aislamiento RLS (usa `.env.test`) |
| `npm run test:e2e` | Playwright: flujos de usuario y auditoría de accesibilidad WCAG 2.1 AA. Compila la app en `.next-e2e` y la prueba como **producción** en el puerto 3100 (requiere `npx playwright install chromium`; `E2E_SKIP_BUILD=1` reutiliza la compilación anterior) |
| `npm run typecheck` · `npm run lint` | Tipos y estilo |
| `npm run db:limpiar-e2e` | Borra de la base de desarrollo las juntas que dejan las pruebas E2E |

Para las pruebas de integración cree `.env.test` con `TEST_DATABASE_URL` y `TEST_DATABASE_ADMIN_URL`
apuntando a una base cuyo nombre contenga `test` (por ejemplo `multijunta_test`; se crea sola).

## Seguridad y aislamiento

- **Aislamiento por junta (Principio I de la constitución):** todas las tablas de datos de una junta llevan
  `tenant_id` y RLS forzada; el rol de la aplicación no puede saltarse las políticas. Las pruebas de
  integración verifican que una junta nunca ve ni modifica datos de otra.
- **Funciones `SECURITY DEFINER` acotadas** (migraciones 0003 y 0004) para dos operaciones que las políticas
  no pueden expresar sin exponer datos: degradar al administrador saliente y cerrar sesiones de una cuenta.
- **Auditoría append-only:** el rol de la aplicación solo puede insertar y leer `audit_log`.
- Cédula ecuatoriana validada (dígito verificador); cuentas bloqueadas 15 min tras 5 intentos fallidos.
- Los logs no incluyen mensajes de error de la base de datos (traen parámetros SQL).
- Cabeceras de seguridad (CSP de frames y formularios, `nosniff`, Permissions-Policy, HSTS en producción).

## Estructura

```text
src/app/          Rutas: (auth), (platform) Super Administrador, (junta) Administrador, (miembro), api
src/server/       db (esquema, RLS, contexto de tenant), auth, services, validation, files, mail
src/components/   Componentes de interfaz reutilizables
drizzle/          Migraciones SQL (esquema, políticas RLS, índices, funciones)
tests/            unit · integration · e2e
specs/            Especificaciones Spec Kit (spec, plan, modelo de datos, contratos, tareas)
.specify/         Constitución del proyecto y plantillas de Spec Kit
```

## Flujo de trabajo (Spec Kit)

`/speckit-constitution` → `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` →
`/speckit-implement`. La constitución del proyecto está en [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
Los mensajes de commit se escriben en español.
