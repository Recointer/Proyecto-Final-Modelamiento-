# Contratos de interfaz: Gestión de Plataforma

La aplicación expone Server Actions (para formularios) y dos Route Handlers (descarga y subida).
Todas validan entrada con Zod, comprueban el rol en el servidor y devuelven
`{ ok: true, data }` o `{ ok: false, error: { codigo, mensaje } }` (mensajes en español).

## Autenticación (público)

| Acción | Entrada | Resultado / errores |
|--------|---------|---------------------|
| `iniciarSesion` | `junta?` (slug), `identificador` (correo o cédula), `password`, `recordar` | Crea sesión y redirige según rol. Errores: `CREDENCIALES_INVALIDAS` (genérico), `CUENTA_BLOQUEADA`, `CUENTA_DESACTIVADA`, `JUNTA_DESACTIVADA`, `ELEGIR_JUNTA` (con lista de juntas) |
| `cerrarSesion` | — | Elimina la sesión |
| `solicitarRecuperacion` | `identificador`, `junta?` | Siempre responde éxito genérico; envía correo si existe |
| `restablecerPassword` | `token`, `passwordNueva` | Errores: `TOKEN_INVALIDO`, `PASSWORD_DEBIL` |
| `cambiarPasswordInicial` | `passwordNueva` | Obligatoria si `debe_cambiar_password` |

## Juntas — rol `super_admin` (RF-01)

| Acción | Entrada | Notas |
|--------|---------|-------|
| `listarJuntas` | `busqueda?`, `provincia?`, `canton?`, `parroquia?`, `pagina` | Paginado |
| `crearJunta` | `nombre`, `tipo`, `provincia`, `canton`, `parroquia`, contacto? | Error `JUNTA_DUPLICADA` |
| `editarJunta` | `id`, campos editables | Auditada |
| `desactivarJunta` | `id`, `confirmar: true` | Cierra sesiones de la junta |
| `reactivarJunta` | `id` | |

## Administrador de la junta — rol `super_admin` (RF-04)

| Acción | Entrada | Errores |
|--------|---------|---------|
| `asignarAdministrador` | `juntaId`, `cedula`, `nombres`, `correo`, `acta` (archivo) | `CEDULA_INVALIDA`, `ACTA_INVALIDA`, `JUNTA_YA_TIENE_ADMIN` |
| `cambiarAdministrador` | `juntaId`, `cedula`, `nombres`, `correo`, `motivo`, `acta` | `CEDULA_INVALIDA`, `MOTIVO_REQUERIDO`, `ACTA_INVALIDA` |

## Panel — rol `super_admin`

| Interfaz | Resultado |
|----------|-----------|
| `obtenerPanel` | `{ totalJuntas, totalEventos, eventosPorFecha[] }` (solo agregados) |
| `GET /api/reportes/plataforma.csv` | CSV con totales y listado de juntas; requiere `super_admin` |

## Configuración de la junta — rol `admin_junta` (RF-02)

| Acción | Entrada | Errores |
|--------|---------|---------|
| `obtenerConfiguracion` | — | Solo su junta |
| `actualizarConfiguracion` | `nombre`, `tipo`, ubicación, `parametros` | |
| `crearSector` / `editarSector` | `nombre`, `descripcion?` | `SECTOR_DUPLICADO` |
| `eliminarSector` | `id` | `SECTOR_CON_ASOCIADOS` |

## Cuentas de la junta — rol `admin_junta` (RF-05)

| Acción | Entrada | Errores |
|--------|---------|---------|
| `listarUsuarios` | `busqueda?`, `rol?`, `estado?`, `pagina` | |
| `crearUsuario` | `cedula`, `nombres`, `correo`, `telefono?`, `rol` (`secretario`/`tesorero`/`socio`) | `CEDULA_INVALIDA`, `CEDULA_DUPLICADA`, `CORREO_DUPLICADO`; devuelve credencial inicial una sola vez |
| `editarUsuario` | `id`, campos editables, `rol?` | |
| `desactivarUsuario` / `reactivarUsuario` | `id` | `NO_PUEDE_DESACTIVARSE_A_SI_MISMO` |
| `restablecerCredencialInicial` | `id` | Fuerza cambio en el próximo ingreso |

## Subida de actas

`POST /api/actas` (multipart, solo `super_admin`): acepta PDF o imagen ≤ 5 MB; valida tipo real y
tamaño; devuelve la ruta interna usada por `asignarAdministrador` / `cambiarAdministrador`.

## Reglas transversales

- Un `403` genérico para cualquier intento de acceso a otra junta (sin revelar si existe).
- Toda acción que modifica datos escribe en `audit_log` en la misma transacción.
- Respuestas y mensajes en español; campos con error se identifican por nombre para la interfaz.
