# Quickstart: validar la Gestión de Plataforma

## Prerrequisitos

- Node.js 22 o superior y PostgreSQL 16+ (local, o `docker compose up -d db` en el puerto 5433).
- Docker (opcional) para Mailpit, que recibe los correos de desarrollo.
- Archivo `.env` creado desde `.env.example` (ver [README](../../README.md)).

## Preparación

```powershell
npm install
npm run db:migrate    # tablas, políticas RLS, índices y funciones; crea el rol de la aplicación
npm run db:seed       # Super Administrador inicial (variables SEED_SUPERADMIN_*) y 2 juntas de ejemplo
docker compose up -d mailpit
npm run dev           # http://localhost:3000 · correos en http://localhost:8025
```

La base de datos `multijunta` debe existir antes de migrar (vacía).

## Escenarios de validación

1. **Inicio de sesión (US1).** En `/login` entre con el Super Administrador del seed → llega a `/panel`.
   Una contraseña errónea muestra «Credenciales incorrectas.» (genérico); tras 5 intentos la cuenta
   se bloquea 15 minutos. «¿Olvidó su contraseña?» envía un enlace (Mailpit) válido 1 hora y de un solo uso.
2. **Juntas (US2).** En «Juntas y tenencias» cree una junta; el nombre repetido en la misma parroquia se rechaza.
   Busque y filtre por provincia, cantón, parroquia y estado. Desactívela con confirmación: sus usuarios
   dejan de entrar y las sesiones abiertas se cierran; al reactivarla todo vuelve intacto.
3. **Administrador (US3).** En el detalle de la junta pulse «Gestionar administrador»: ingrese una cédula
   válida y un acta PDF o imagen (máx. 5 MB). La contraseña inicial se muestra una vez y llega por correo
   (Mailpit). Ingrese como ese administrador (identificador de junta + cédula) y cree su contraseña.
   Luego cambie el administrador con un motivo: el anterior pasa a socio y pierde sus sesiones.
4. **Panel (US4).** `/panel` muestra totales de juntas y eventos, juntas nuevas del mes, activas sin
   administrador y un calendario navegable. «Descargar reporte» baja un CSV con cifras agregadas.
5. **Configuración (US5).** Como administrador, en `/configuracion` edite datos, contacto y parámetros
   (multas por inasistencia y quórum); cree, edite y elimine sectores. Un sector con socios o predios
   asociados no se puede eliminar.
6. **Cuentas (US6).** En `/usuarios` cree cuentas con rol de Secretario/a, Tesorero/a o Socio; la
   persona entra con la credencial inicial y debe cambiarla. Edite, desactive, reactive y restablezca
   contraseñas. El administrador no puede desactivar su propia cuenta.
7. **Aislamiento (Principio I).** Con dos juntas, un administrador de la junta A no ve ni modifica
   cuentas, sectores ni configuración de la junta B (lo verifican las pruebas de integración).

## Pruebas automatizadas

```powershell
npm test                    # unitarias
npm run test:integration    # servicios + RLS contra PostgreSQL real (requiere .env.test)
npx playwright install chromium   # una sola vez
npm run test:e2e            # flujos de usuario y auditoría de accesibilidad (axe, WCAG 2.1 AA, móvil)
npm run typecheck; npm run lint
npm run db:limpiar-e2e      # limpia las juntas que dejan las pruebas E2E en la base de desarrollo
```

Resultado esperado: todo en verde. Las pruebas de aislamiento demuestran que ninguna consulta de la
junta A devuelve datos de la junta B, y las de accesibilidad no deben reportar violaciones.

Contratos: [contracts/platform-actions.md](contracts/platform-actions.md). Modelo: [data-model.md](data-model.md).
