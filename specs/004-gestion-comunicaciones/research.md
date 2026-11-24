# Research: Gestión de Comunicaciones

## D1. Inmutabilidad por permisos de columna
- **Decisión**: el rol de la aplicación recibe `INSERT` y `UPDATE` solo sobre columnas concretas (`GRANT UPDATE (publicado, estado, …)`); `mensaje` solo `UPDATE (leido_en)`; ninguna tabla tiene `DELETE`.
- **Por qué**: la regla «no se editan ni se borran» se cumple aunque el código falle; no hacen falta disparadores.

## D2. Visibilidad del Socio
- **Decisión**: los servicios reciben un indicador de «solo publicado» y filtran por `publicado/publicada = true` y `estado = vigente`; las rutas de descarga reutilizan la misma consulta y responden 404 si el Socio no puede ver el registro.
- **Por qué**: una sola regla en el servicio evita que la ruta y la pantalla diverjan (SC-005).

## D3. Aviso por correo
- **Decisión**: al emitir, si se pide, se recorren los socios activos con correo y se envía con el `mailer()` existente; cada fallo se captura y se cuenta; `convocatoria.notificados` guarda los enviados. El envío ocurre después de confirmar la transacción.
- **Por qué**: un fallo de correo nunca debe impedir ni deshacer la publicación.

## D4. Mensajería
- **Decisión**: `hilo` por (socio con cuenta, asunto) con `ultimo_mensaje_en`; `mensaje` con `de_administracion` y `leido_en`. No leído = mensaje de la otra parte con `leido_en IS NULL`. Al abrir la conversación se marcan como leídos los de la otra parte. El Socio es el de la sesión; el Administrador ve todas las conversaciones de la junta.
- **Por qué**: modelo mínimo suficiente para bandeja, no leídos y respuesta bidireccional.

## D5. Vínculo con la cuenta del Socio
- **Decisión**: `hilo.usuario_id` referencia `usuario` con clave compuesta `(usuario_id, tenant_id)`; se agrega `UNIQUE (id, tenant_id)` a `usuario`. Solo se listan para iniciar conversación las cuentas con rol `socio` activas.
- **Por qué**: la base de datos impide asociar conversaciones a cuentas de otra junta.

## D6. Archivos
- **Decisión**: se reutiliza `fileStore()` y `validarArchivo` (por firma, PDF/PNG/JPEG, 5 MB). Las rutas `/api/documentos/[id]` y `/api/comunicaciones/[id]/adjunto` exigen sesión, contexto de junta y la regla D2; nunca se expone la ruta del archivo.
