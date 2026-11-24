# Contratos: pantallas y rutas

| Ruta | Roles | Contenido |
|------|-------|-----------|
| `/convocatorias` | todos | Secretario/a: lista completa y emisión; resto: próximas y pasadas publicadas |
| `/documentos` | todos | Actas y resoluciones; el Socio solo lo publicado |
| `/comunicaciones` | secretario, admin_junta, tesorero, socio | Registro de comunicaciones recibidas; el Socio ve «Comunicados» publicados |
| `/mensajes` | admin_junta, socio | Bandeja y conversación (`?hilo=`) |

## Rutas de descarga
| Ruta | Respuesta |
|------|-----------|
| `GET /api/documentos/[id]` | Archivo del documento. 401 sin sesión; 404 si no existe, es de otra junta o el Socio no puede verlo |
| `GET /api/comunicaciones/[id]/adjunto` | Adjunto de la comunicación, mismas reglas |

Ambas con `Cache-Control: no-store` y `X-Content-Type-Options: nosniff`.

## Códigos de error nuevos
`CONVOCATORIA_NO_ENCONTRADA`, `CONVOCATORIA_ANULADA`, `FECHA_PASADA`, `EVENTO_NO_VALIDO`, `DOCUMENTO_NO_ENCONTRADO`, `DOCUMENTO_ANULADO`,
`DOCUMENTO_INVALIDO`, `COMUNICACION_NO_ENCONTRADA`, `COMUNICACION_ANULADA`, `ADJUNTO_INVALIDO`, `HILO_NO_ENCONTRADO`, `MENSAJE_INVALIDO`, `DESTINATARIO_NO_VALIDO`.
