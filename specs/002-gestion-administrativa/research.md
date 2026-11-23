# Research: Gestión Administrativa

No quedaron marcadores NEEDS CLARIFICATION; este documento registra las decisiones técnicas.

## 1. Vínculo entre padrón (socio) y cuenta de acceso

- **Decision**: relación blanda por **cédula dentro de la misma junta**. `socio` y `usuario` ya tienen la
  cédula única por `tenant_id`; la sesión se amplía con la cédula del usuario y el servicio
  `socioDeSesion(ctx, user)` busca `socio` con `tenant_id` y `cedula` iguales. No hay clave foránea
  entre ambos.
- **Rationale**: el padrón no requiere cuenta y una cuenta puede existir antes de que el socio figure
  en el padrón (el Socio ve «aún no figura en el padrón»). Ambas cédulas son inmutables, así que el
  vínculo es estable.
- **Alternatives considered**: columna `socio.usuario_id` (acopla ciclos de vida y obliga a mantener dos
  sentidos de la relación); crear la cuenta al registrar al socio (cambia el alcance del módulo 1).

## 2. Cómo ve el Socio solo lo suyo

- **Decision**: las consultas del Socio nunca reciben un `socio_id` del cliente: el servicio lo deriva de
  la sesión (decisión 1) y lo aplica como condición `WHERE`. RLS garantiza el aislamiento entre juntas;
  la separación entre socios de la misma junta se hace en el servicio y se prueba con pruebas de
  integración por consulta.
- **Rationale**: es el mismo patrón que el módulo 1 (RLS por junta; permisos por rol en servidor). Añadir
  políticas por rol dentro de la junta exigiría pasar el rol y la cédula a la base de datos en cada
  transacción y complicaría todos los servicios (Principio VII).
- **Alternatives considered**: políticas RLS por usuario (más defensa en profundidad, pero mucho más
  mantenimiento); vistas por rol.

## 3. Integridad entre tablas y junta

- **Decision**: cada tabla referenciada lleva `UNIQUE (id, tenant_id)` y las referencias son **claves
  foráneas compuestas** `(x_id, tenant_id) → (id, tenant_id)`. Los sectores se referencian con
  `ON DELETE RESTRICT`, lo que además hace efectiva la regla del módulo 1: un sector con socios,
  predios o turnos no se puede eliminar (el servicio ya traduce el error 23503 a `SECTOR_CON_ASOCIADOS`).
- **Rationale**: aunque un error de aplicación mezclara identificadores de dos juntas, la base de datos lo
  rechaza. Cumple el Principio I con defensa en profundidad barata.
- **Alternatives considered**: solo claves simples + filtros en código.

## 4. Eventos, anulación y asistencia

- **Decision**: los eventos **no se eliminan**: pasan a `anulado` con motivo, actor y fecha. La asistencia
  se guarda por evento en una sola transacción mediante *upsert* por `(evento_id, socio_id)`. Un evento
  con fecha futura no admite asistencia (fecha comparada en hora de Ecuador). La lista de asistencia
  contiene a los socios **activos** más quienes ya tengan fila en ese evento. Cada guardado deja una
  entrada de auditoría con los cambios, y cada fila conserva `registrado_*` y `modificado_*`.
- **Rationale**: conserva el historial y las multas ya calculadas; la transacción única evita
  asistencias parciales.
- **Alternatives considered**: borrado de eventos (rompe historial); una fila de historial por cambio
  (más tablas sin necesidad: `audit_log` ya es append-only).

## 5. Cálculo del porcentaje de cumplimiento

- **Decision**: función pura `calcularCumplimiento({ presentes, ausentes, justificados })` =
  `presentes / (presentes + ausentes)`; las justificaciones **no penalizan ni suman**. Cuentan solo
  eventos **no anulados**, con asistencia guardada, de fecha igual o posterior a la fecha de ingreso del
  socio. Sin eventos computables el resultado es «no aplica». La meta de referencia es 80 %.
- **Rationale**: es consistente con FR-020 y con el significado de «justificado»; al ser pura se prueba
  de forma exhaustiva. El quórum de un evento es distinto: `presentes / total de la lista`.
- **Alternatives considered**: contar justificadas como asistencia (infla el cumplimiento); calcularlo en
  una vista SQL (más difícil de probar).

## 6. Turnos sin solapamiento

- **Decision**: restricción `EXCLUDE USING gist` sobre `(servicio_id, sector_id, dia_semana,
  rango de horas)` con la extensión `btree_gist`, más `CHECK (hora_fin > hora_inicio)`. Los errores
  `23P01` y `23514` se traducen a `TURNO_SOLAPADO` y `TURNO_HORARIO_INVALIDO`.
- **Rationale**: correcta incluso con dos guardados simultáneos. `btree_gist` es una extensión estándar
  y de confianza de PostgreSQL.
- **Alternatives considered**: comprobar en la aplicación con una consulta previa (carrera posible).

## 7. Conteo de eventos para el panel de plataforma

- **Decision**: dos funciones `SECURITY DEFINER` con `search_path` fijo que exigen
  `app_role() = 'super_admin'`: `total_eventos_plataforma()` (eventos no anulados) y
  `eventos_plataforma_por_dia(anio, mes)` (día y cantidad). Reemplazan `contarEventos` en
  `panel-service.ts`. El calendario del panel muestra «N eventos» por día, **sin títulos** ni la junta.
- **Rationale**: mismo patrón que `degradar_administrador` y `revocar_sesiones_usuario`. El Super
  Administrador sigue sin poder leer filas de las juntas.
- **Alternatives considered**: política de lectura sobre `evento` (expone títulos y lugares); duplicar un
  contador en `junta` (se desincroniza).

## 8. Google Maps

- **Decision**: la **JavaScript API** se carga solo en el navegador con la clave
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (pública por diseño y **restringida por referente HTTP** en Google
  Cloud) y un identificador de mapa opcional `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`. Un cargador propio
  (sin dependencia) inyecta el `<script>` una vez y resuelve o falla en un tiempo máximo de 8 s. Si no
  hay clave, falla la carga o el usuario está sin conexión, el componente muestra la **lista de
  predios con coordenadas** y un enlace a Google Maps (`maps.google.com/?q=lat,lng`, que no requiere
  clave) más un aviso claro. Al navegador solo viajan los campos necesarios de los predios que el
  usuario puede ver.
- **Rationale**: cumple el requisito de usar Google Maps sin añadir paquetes ni exponer secretos de
  servidor; la degradación garantiza que el mapa nunca bloquee el trabajo (FR-014, SC-007).
- **Alternatives considered**: paquete `@googlemaps/js-api-loader` (una dependencia más para una tarea de
  20 líneas); Leaflet/OpenStreetMap (no es lo que pidió el equipo); mapas estáticos del lado del servidor
  (clave secreta y más costo).

## 9. Imágenes de predios

- **Decision**: se reutiliza el `FileStore`, ampliado con subcarpetas anidadas
  (`predios/<tenant_id>`), una lista de tipos permitidos (aquí solo imágenes PNG o JPEG, validadas por
  firma) y un método `eliminar`. La ruta se guarda en `predio.imagen_ruta` y **nunca** se expone;
  la imagen se sirve por `GET /api/predios/[id]/imagen`, que exige sesión, localiza el predio con la RLS
  del contexto (si es de otra junta no existe) y comprueba que el Socio solo pida sus predios. Al
  reemplazar la imagen se borra la anterior.
- **Rationale**: mantiene un único mecanismo de archivos, aislado por junta y sin URLs públicas.
- **Alternatives considered**: archivos estáticos públicos (cualquiera con la URL los vería); base de
  datos (`bytea`, infla las copias de seguridad).

## 10. PDF del historial

- **Decision**: `pdf-lib` en el servidor, con fuente estándar (admite las letras acentuadas del español
  en codificación WinAnsi). Ruta `GET /api/mi/asistencia.pdf` (rol Socio, acotada a su propio
  registro): nombre, cédula, junta, fecha de emisión, detalle por evento, totales y porcentaje.
- **Rationale**: JavaScript puro, sin binarios ni navegador sin cabeza; basta para un documento tabular.
- **Alternatives considered**: Puppeteer/Chromium (pesado y difícil de desplegar); generar en el cliente
  (los datos pasarían por el navegador sin necesidad); `pdfkit` (necesita registrar fuentes).

## 11. Inasistencias injustificadas para Financiero

- **Decision**: función de servicio `listarInasistenciasInjustificadas(ctx, { desde?, hasta?, socioId? })`
  que devuelve `{ socioId, cedula, nombres, eventoId, tipo, fecha }` de eventos no anulados con
  asistencia `ausente`. Disponible para los roles Secretario/a, Administrador y Tesorero/a. El módulo
  Financiero la consumirá sin acceder a las tablas.
- **Rationale**: contrato claro y probado entre módulos sin calcular multas aquí (FR-011).

## 12. Rangos y validaciones geográficas

- **Decision**: latitud −90…90 y longitud −180…180 con `CHECK` en la base de datos y validación en Zod;
  se almacenan como `numeric(9,6)` (≈0,1 m). Si las coordenadas caen fuera de Ecuador se acepta pero se
  avisa en pantalla (los predios podrían estar cerca de la frontera); código de predio único por junta.
- **Rationale**: cumple FR-013 sin bloquear casos legítimos.

## 13. Autorización por rol y navegación

- **Decision**: un helper `contextoGestion(roles)` en `page-guard.ts` por analogía con los existentes, y
  `navegacionPara(rol)` en `src/lib/navegacion.ts`. Modifican solo `secretario`; `admin_junta` y
  `tesorero` consultan; `socio` accede a «mi información», sus predios, su historial y el calendario de
  su sector. Las Server Actions de escritura llaman a `requireRole("secretario")`.
- **Rationale**: Principio II: el rol se valida en el servidor, nunca solo en la interfaz.

## 14. Pruebas

- **Decision**: Vitest unitarias (cumplimiento, validaciones, coordenadas, cargador del mapa) e
  integración contra PostgreSQL real (servicios, RLS, FK compuestas, exclusión de turnos, funciones
  agregadas, aislamiento entre socios). Playwright con y sin clave de Maps (para el caso con mapa se
  inyecta un `google` simulado con `addInitScript`), y la auditoría axe se amplía a las pantallas nuevas.
