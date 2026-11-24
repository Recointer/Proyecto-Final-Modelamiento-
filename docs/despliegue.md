# Guía de despliegue

Despliegue de producción con Docker: **PostgreSQL + migraciones + aplicación**, y HTTPS automático opcional.
Sirve en cualquier servidor con Docker 24+ y Docker Compose v2 (VPS, máquina de la junta o la nube).

## 1. Requisitos

- Docker y Docker Compose instalados.
- Un dominio apuntando al servidor (solo si quiere HTTPS automático) y los puertos 80 y 443 abiertos.
- Un servidor de correo SMTP (opcional, para avisos de convocatorias y recuperación de contraseña).

## 2. Configuración

```powershell
Copy-Item deploy/env.prod.example .env.prod
```

Edite `.env.prod` y defina como mínimo:

| Variable | Qué es |
|----------|--------|
| `POSTGRES_PASSWORD` | Contraseña del superusuario de PostgreSQL (solo migraciones). |
| `APP_DB_PASSWORD` | Contraseña del rol de la aplicación (sin `BYPASSRLS`). Debe ser distinta de la anterior. |
| `APP_URL` | Dirección pública, con `https://` en producción. |
| `DOMINIO` | Solo con HTTPS automático (`--profile https`). |
| `SMTP_URL`, `MAIL_FROM` | Correo saliente. Sin `SMTP_URL` los correos no se envían (el sistema sigue funcionando). |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Opcional. Clave restringida por dominio; sin ella el mapa se muestra como lista con coordenadas. |

`.env.prod` está ignorado por git: **no lo suba al repositorio**.

## 3. Primera puesta en marcha

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Con HTTPS automático (Caddy obtiene el certificado solo):

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml --profile https up -d --build
```

El servicio `migrar` aplica las migraciones y crea el rol de la aplicación antes de que arranque `app`.
La aplicación escucha en el puerto `APP_PORT` (3000 por defecto). Detrás de HTTPS, publique solo 80 y 443.

> Las cookies de sesión son `Secure` en producción: para usar el sistema fuera de `localhost` necesita HTTPS
> (Caddy o su propio proxy inverso).

## 4. Crear el Super Administrador

Una sola vez, con una cédula válida, un correo y una contraseña fuerte (mínimo 10 caracteres, con letras y números):

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm --no-deps `
  -e SEED_SOLO_SUPERADMIN=1 -e SEED_SUPERADMIN_CEDULA=1710034065 `
  -e SEED_SUPERADMIN_CORREO=admin@su-dominio.ec -e SEED_SUPERADMIN_PASSWORD=ContraseñaSegura2026 `
  app npm run db:seed:prod
```

Con `SEED_SOLO_SUPERADMIN=1` no se crean las juntas de ejemplo. Después ingrese en `/login` con ese correo, cree las
juntas y asigne a cada Administrador de la Junta.

## 5. Actualizar a una versión nueva

```powershell
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Las migraciones nuevas se aplican solas; las ya aplicadas se omiten. Los datos y los archivos viven en los volúmenes
`dbdata` y `storage` y no se pierden al reconstruir.

## 6. Respaldos

Base de datos (programe esto a diario con el programador de tareas o `cron`):

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db pg_dump -U postgres -Fc multijunta > respaldo-$(Get-Date -Format yyyyMMdd).dump
```

Restaurar en una base vacía:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T db pg_restore -U postgres -d multijunta --clean --if-exists < respaldo.dump
```

Archivos (actas, respaldos de egresos, imágenes de predios): respalde el volumen `multijunta_storage`.

## 7. Comprobaciones

- Estado: `docker compose --env-file .env.prod -f docker-compose.prod.yml ps` (la aplicación debe figurar como `healthy`).
- Registros: `docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f app`.
- La aplicación responde en `APP_URL/login`.

## 8. Seguridad

- No publique el puerto 5432: la base de datos solo es accesible dentro de la red de Docker.
- Use contraseñas distintas y largas para `POSTGRES_PASSWORD` y `APP_DB_PASSWORD`.
- Mantenga actualizados el sistema operativo, Docker y las imágenes (`docker compose pull` y `up -d --build`).
- Restrinja la clave de Google Maps por dominio (referente HTTP) en Google Cloud.
