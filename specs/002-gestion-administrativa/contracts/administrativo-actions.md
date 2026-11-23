# Contratos de interfaz: Gestión Administrativa

Server Actions y Route Handlers. Todas validan la entrada con Zod, comprueban el rol en el servidor y
devuelven `{ ok: true, data }` o `{ ok: false, error: { codigo, mensaje, campo? } }` (mensajes en
español). Roles: **S** = Secretario/a (modifica), **A** = Administrador de la Junta y **T** = Tesorero/a
(solo consulta), **M** = Socio (solo lo suyo). Un acceso a un recurso de otra junta es siempre «no
encontrado» o 403 genérico.

## Socios (RF-07)

| Interfaz | Rol | Entrada | Errores |
|----------|-----|---------|---------|
| `listarSocios` | S, A, T | `busqueda?`, `sectorId?`, `estado?`, `pagina` | — |
| `crearSocio` | S | `cedula`, `nombres`, `sectorId`, `telefono?`, `correo?`, `fechaIngreso` | `CEDULA_INVALIDA`, `CEDULA_DUPLICADA`, `CORREO_DUPLICADO`, `SECTOR_NO_ENCONTRADO`, `FECHA_FUTURA` |
| `editarSocio` | S | `id`, `nombres`, `sectorId`, `telefono?`, `correo?`, `fechaIngreso` (la cédula no cambia) | idem |
| `desactivarSocio` / `reactivarSocio` | S | `id` | `SOCIO_NO_ENCONTRADO` |

## Eventos y asistencia (RF-08, RF-09)

| Interfaz | Rol | Entrada | Errores |
|----------|-----|---------|---------|
| `listarEventos` | S, A, T | `tipo?`, `desde?`, `hasta?`, `estado?`, `pagina` | — |
| `crearEvento` / `editarEvento` | S | `tipo`, `titulo`, `fecha`, `lugar` | `DATOS_INVALIDOS` |
| `anularEvento` | S | `id`, `motivo` | `MOTIVO_REQUERIDO`, `EVENTO_NO_ENCONTRADO` |
| `obtenerListaAsistencia` | S, A, T | `eventoId`, `busqueda?` | `EVENTO_NO_ENCONTRADO` |
| `guardarAsistencia` | S | `eventoId`, `registros: [{ socioId, estado, motivo? }]` | `EVENTO_ANULADO`, `EVENTO_FUTURO`, `MOTIVO_REQUERIDO` (justificado sin motivo), `SOCIO_NO_PERMITIDO` |
| `listarInasistenciasInjustificadas` | S, A, T (consumo de Financiero) | `desde?`, `hasta?`, `socioId?` | — |

`obtenerListaAsistencia` devuelve los socios activos más quienes ya tienen fila en el evento, con su
estado actual, los contadores, el porcentaje frente al quórum de la junta y si se alcanza.
`guardarAsistencia` reemplaza el estado de todos los socios enviados en **una transacción** y audita.

## Predios y mapa (RF-10, RF-11)

| Interfaz | Rol | Entrada | Errores |
|----------|-----|---------|---------|
| `listarPredios` | S, A, T; M (solo los suyos) | `sectorId?`, `socioId?` (ignorado para M), `busqueda?`, `pagina` | — |
| `datosMapaPredios` | S, A, T; M (solo los suyos) | `sectorId?` | — (devuelve solo `id, codigo, nombre, lat, lng, sector, superficie`) |
| `crearPredio` / `editarPredio` | S | `codigo`, `nombre`, `superficieHa`, `sectorId`, `socioId`, `latitud?`, `longitud?`, `imagen?` (archivo) | `CODIGO_DUPLICADO`, `COORDENADAS_INVALIDAS`, `IMAGEN_INVALIDA`, `SECTOR_NO_ENCONTRADO`, `SOCIO_NO_ENCONTRADO` |
| `desactivarPredio` / `reactivarPredio` | S | `id` | `PREDIO_NO_ENCONTRADO` |
| `GET /api/predios/[id]/imagen` | S, A, T; M (si es suyo) | — | 401, 403 genérico, 404; `Cache-Control: private` |

## Servicios y calendario (RF-12)

| Interfaz | Rol | Entrada | Errores |
|----------|-----|---------|---------|
| `listarServicios` | S, A, T | `estado?` | — |
| `crearServicio` / `editarServicio` | S | `nombre`, `tipo` | `SERVICIO_DUPLICADO` |
| `desactivarServicio` / `reactivarServicio` | S | `id` | `SERVICIO_NO_ENCONTRADO` |
| `crearTurno` / `editarTurno` | S | `servicioId`, `sectorId`, `diaSemana`, `horaInicio`, `horaFin` | `TURNO_HORARIO_INVALIDO`, `TURNO_SOLAPADO` |
| `eliminarTurno` | S | `id` | `TURNO_NO_ENCONTRADO` |
| `obtenerCalendarioSemanal` | S, A, T (elige sector); M (su sector) | `sectorId?` | — |

## Consulta del Socio

| Interfaz | Rol | Entrada | Resultado |
|----------|-----|---------|-----------|
| `obtenerMiInformacion` | M | — | ficha, sector y predios; `NO_EN_PADRON` si la cédula no figura |
| `obtenerMiHistorial` | M | `tipo?` | eventos con su estado, totales y porcentaje de cumplimiento (o «no aplica») |
| `GET /api/mi/asistencia.pdf` | M | `tipo?` | PDF con nombre, cédula, junta, fecha de emisión, detalle y porcentaje |

## Panel de plataforma (cambio al módulo 1)

`obtenerPanel` usa `total_eventos_plataforma()` y `eventos_plataforma_por_dia(anio, mes)` en lugar de
devolver 0. El calendario del panel muestra «N eventos» por día, sin títulos.

## Reglas transversales

- Toda acción que modifica datos escribe en `audit_log` en la misma transacción.
- Las cédulas se normalizan (espacios y guiones) antes de validar.
- Ningún identificador de socio llega del cliente en las consultas del Socio: se deriva de la sesión.
- Mensajes y etiquetas en español; los errores con campo se muestran junto al campo.
