# Data Model: Gestión de Comunicaciones

Todas las tablas llevan `tenant_id`, RLS forzada (política `app_role() = 'tenant' AND tenant_id = app_tenant()`),
`UNIQUE (id, tenant_id)` y claves foráneas compuestas. Migraciones `0010_comunicaciones.sql` y `0011_comunicaciones_rls.sql`.

## Enumeraciones
`tipo_documento` (acta_asamblea, acta_directiva, resolucion) · `estado_registro` (vigente, anulado) · reutiliza `tipo_evento`.

## Tablas

### convocatoria
`id`, `tenant_id`, `tipo tipo_evento`, `titulo (3–150)`, `fecha date`, `hora time`, `lugar (1–150)`, `orden_dia text (≤ 2000)`,
`evento_id` → evento (opcional), `estado estado_registro`, `anulado_por/en`, `motivo_anulacion`, `notificados int`, `creado_por`, `creado_en`.
CHECK de anulación coherente. Permisos de columna: `UPDATE (estado, anulado_por, anulado_en, motivo_anulacion, notificados)`.

### documento
`id`, `tenant_id`, `tipo tipo_documento`, `titulo (3–150)`, `fecha date`, `descripcion (≤ 500)`, `archivo_ruta NOT NULL`,
`publicado boolean`, `estado`, `anulado_por/en`, `motivo_anulacion`, `creado_por`, `creado_en`.
`UPDATE (publicado, estado, anulado_por, anulado_en, motivo_anulacion)`.

### comunicacion_recibida
`id`, `tenant_id`, `institucion (2–120)`, `asunto (3–200)`, `referencia (≤ 60)`, `fecha_recepcion date`, `resumen (≤ 2000)`,
`archivo_ruta NULL`, `publicada boolean`, `estado`, `anulado_por/en`, `motivo_anulacion`, `creado_por`, `creado_en`.
`UPDATE (publicada, estado, anulado_por, anulado_en, motivo_anulacion)`.

### hilo
`id`, `tenant_id`, `usuario_id` → usuario `(usuario_id, tenant_id)`, `asunto (3–150)`, `iniciado_por_admin boolean`, `creado_en`, `ultimo_mensaje_en`.
`UPDATE (ultimo_mensaje_en)`.

### mensaje
`id`, `tenant_id`, `hilo_id` → hilo, `autor_id` → usuario, `de_administracion boolean`, `texto (1–2000)`, `creado_en`, `leido_en NULL`.
`UPDATE (leido_en)`; sin `DELETE`.

## Auditoría
Acciones `convocatoria.emitir|anular`, `documento.archivar|publicar|retirar|anular`, `comunicacion.registrar|publicar|retirar|anular`, `hilo.iniciar`.
