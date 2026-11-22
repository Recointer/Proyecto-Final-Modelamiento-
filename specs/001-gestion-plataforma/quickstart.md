# Quickstart: validar la Gestión de Plataforma

## Prerrequisitos

- Node.js 22 LTS y PostgreSQL 16 (local o contenedor).
- Variables de entorno (archivo `.env`, no versionado): `DATABASE_URL` (rol de la app, sin
  `BYPASSRLS`), `DATABASE_ADMIN_URL` (migraciones), `SESSION_SECRET`, `SMTP_URL` (Mailpit en
  desarrollo), `FILE_STORE_DIR`.

## Preparación

```powershell
npm install
npm run db:migrate    # crea tablas y políticas RLS
npm run db:seed       # crea el Super Administrador inicial y datos de ejemplo
npm run dev
```

## Escenarios de validación

1. **Login (HU1)**: abrir `/login`, ingresar con el Super Administrador del seed → llega al panel.
   Con contraseña errónea → mensaje genérico; tras 5 intentos → cuenta bloqueada 15 min.
2. **Alta de junta (HU2)**: en `/juntas` crear una junta; aparece activa en el listado; buscar y
   filtrar por provincia/cantón/parroquia; desactivar y comprobar que sus usuarios no entran.
3. **Administrador (HU3)**: asignar administrador con cédula válida y acta PDF; ingresar con esa
   cuenta y comprobar que cambia la contraseña inicial. Cambiar el administrador con motivo y
   verificar que el anterior pasa a socio.
4. **Panel (HU4)**: totales coinciden con los datos; descargar `plataforma.csv`.
5. **Configuración (HU5)**: como Administrador, editar datos y crear/editar sectores.
6. **Cuentas (HU6)**: crear, editar y desactivar una cuenta de socio; la cuenta desactivada no
   ingresa.
7. **Aislamiento (Principio I)**: con dos juntas, un Administrador de la junta A intenta listar o
   abrir recursos de la junta B → 403 / sin filas.

## Pruebas automatizadas

```powershell
npm run test              # unitarias (cédula, bloqueo, sectores)
npm run test:integration  # servicios + RLS contra PostgreSQL real
npm run test:e2e          # Playwright: login, alta de junta, asignar administrador
npm run typecheck; npm run lint
```

Resultado esperado: todo en verde; las pruebas de aislamiento deben demostrar que ninguna consulta
de la junta A devuelve datos de la junta B.

Contratos: [contracts/platform-actions.md](contracts/platform-actions.md). Modelo:
[data-model.md](data-model.md).
