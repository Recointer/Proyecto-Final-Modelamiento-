# Feature Specification: Gestión de Comunicaciones

**Feature Branch**: `004-gestion-comunicaciones`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "Módulo de Gestión de Comunicaciones: convocatorias a Asamblea General y Mingas (RF-25, RF-26), archivo y publicación de actas y resoluciones (RF-27, RF-28), registro de comunicaciones recibidas de otras instituciones (RF-29, RF-30), consulta del Socio de lo publicado por la Directiva (RF-31) y mensajería entre el Administrador de la Junta y los socios (RF-32, RF-33). Actor principal: Secretario/a. Datos aislados por junta."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Emitir convocatorias (Priority: P1)

El/la Secretario/a emite la convocatoria a una asamblea general o a una minga con título, fecha, hora, lugar y orden del día, y puede vincularla a un evento ya registrado. Al emitirla queda publicada para todos los socios y, si lo desea, se les avisa por correo a quienes lo tengan registrado. Los socios consultan las convocatorias vigentes y las próximas (RF-25, RF-26, RF-31).

**Why this priority**: Convocar es la primera obligación de la secretaría y la que más urge a los socios conocer.

**Independent Test**: Emitir una convocatoria con aviso por correo, comprobar que el Socio la ve entre las próximas, anularla con motivo y comprobar que deja de aparecer para el Socio pero se conserva para la secretaría.

**Acceptance Scenarios**:

1. **Given** un Secretario/a, **When** emite una convocatoria con tipo, título, fecha, hora, lugar y orden del día, **Then** queda publicada y aparece en la lista de convocatorias.
2. **Given** una convocatoria con fecha pasada, **When** intenta emitirla, **Then** el sistema la rechaza indicando que la fecha ya pasó.
3. **Given** un evento ya registrado, **When** emite la convocatoria vinculándolo, **Then** la convocatoria muestra el evento y no admite vincular uno de otra junta ni uno anulado.
4. **Given** la opción «avisar por correo», **When** emite la convocatoria, **Then** se envía un correo a cada socio activo con correo registrado y se informa cuántos se avisaron; un fallo de envío no impide publicar.
5. **Given** convocatorias publicadas, **When** un Socio abre «Convocatorias», **Then** ve las próximas en orden de fecha y las pasadas aparte, nunca las anuladas.
6. **Given** una convocatoria emitida con un error, **When** el Secretario/a la anula con motivo, **Then** deja de ser visible para los socios y queda en el historial de la secretaría con su motivo.

---

### User Story 2 - Archivar y publicar actas y resoluciones (Priority: P1)

El/la Secretario/a archiva las actas de la Asamblea General, las actas de la Directiva y las resoluciones, adjuntando el documento (PDF o imagen), y decide si se publican para los socios. Puede retirarlas de la publicación sin perderlas y anularlas con motivo. Los socios consultan y descargan lo publicado (RF-27, RF-28, RF-31).

**Why this priority**: El archivo documental de la junta es su memoria oficial y respalda las decisiones.

**Independent Test**: Archivar un acta sin publicar (el Socio no la ve), publicarla (el Socio la descarga), retirarla de publicación y comprobar que el Socio ya no accede ni siquiera con la dirección directa.

**Acceptance Scenarios**:

1. **Given** un Secretario/a, **When** archiva un documento con tipo (acta de asamblea, acta de directiva o resolución), título, fecha y archivo, **Then** queda archivado y no publicado por defecto.
2. **Given** un archivo de tipo no permitido o mayor a 5 MB, **When** intenta archivarlo, **Then** el sistema lo rechaza con un mensaje claro.
3. **Given** un documento archivado, **When** el Secretario/a lo publica, **Then** los socios de la junta lo ven y lo descargan.
4. **Given** un documento publicado, **When** el Secretario/a lo retira de la publicación, **Then** los socios dejan de verlo y de poder descargarlo, y el documento se conserva.
5. **Given** la lista de documentos, **When** filtra por tipo, año o texto, **Then** ve solo lo que coincide, paginado.
6. **Given** un documento, **When** el Secretario/a lo anula con motivo, **Then** deja de ser visible para los socios y queda en el historial.
7. **Given** un documento de otra junta, **When** un usuario intenta descargarlo, **Then** el acceso se deniega sin revelar si existe.

---

### User Story 3 - Registrar comunicaciones de otras instituciones (Priority: P2)

El/la Secretario/a registra los oficios y comunicaciones que la junta recibe de otras instituciones (Ministerio del Ambiente, GAD, Alcaldía, etc.) con institución, asunto, referencia, fecha de recepción, resumen y el documento adjunto opcional. Puede publicar una comunicación como comunicado para que los socios la conozcan (RF-29, RF-30, RF-31).

**Why this priority**: Deja constancia de lo recibido, pero la junta puede operar sin él.

**Independent Test**: Registrar un oficio con adjunto, buscarlo por institución, publicarlo como comunicado y comprobar que el Socio lo ve y que los no publicados quedan solo para la directiva.

**Acceptance Scenarios**:

1. **Given** un Secretario/a, **When** registra una comunicación con institución, asunto, fecha de recepción y resumen, **Then** queda en el registro, no publicada.
2. **Given** un adjunto PDF o imagen válido, **When** lo adjunta, **Then** queda asociado y solo lo descargan roles autorizados de la misma junta.
3. **Given** una fecha de recepción futura, **When** intenta guardar, **Then** el sistema la rechaza.
4. **Given** el registro, **When** busca por institución, asunto o referencia y filtra por año, **Then** ve solo lo que coincide.
5. **Given** una comunicación, **When** el Secretario/a la publica como comunicado, **Then** los socios la ven con su resumen y adjunto; al retirarla vuelve a ser interna.
6. **Given** una comunicación registrada por error, **When** se anula con motivo, **Then** deja de figurar como vigente y de ser visible para los socios.

---

### User Story 4 - Mensajes entre el Administrador y los socios (Priority: P2)

Un Socio con cuenta escribe un mensaje al Administrador de la Junta (asunto y texto) y recibe respuesta en la misma conversación; el Administrador también puede iniciar una conversación con un socio que tenga cuenta. Cada parte ve sus conversaciones ordenadas por la última actividad, con indicación de mensajes no leídos (RF-32, RF-33).

**Why this priority**: Es el canal bidireccional entre la directiva y sus miembros, útil pero que no bloquea los demás módulos.

**Independent Test**: Un Socio envía un mensaje; el Administrador lo ve como no leído, lo abre, responde; el Socio ve la respuesta como no leída; otro Socio no ve nada de esa conversación.

**Acceptance Scenarios**:

1. **Given** un Socio, **When** envía un mensaje con asunto y texto, **Then** se crea una conversación visible solo para él y para el Administrador de la Junta.
2. **Given** una conversación, **When** cualquiera de las dos partes responde, **Then** el mensaje se agrega al final con su autor y hora.
3. **Given** mensajes recibidos sin abrir, **When** la parte receptora abre la bandeja, **Then** ve la cantidad de no leídos por conversación y el total; al abrir la conversación se marcan como leídos.
4. **Given** el Administrador, **When** inicia una conversación eligiendo a un socio con cuenta, **Then** el Socio la ve en su bandeja.
5. **Given** un texto vacío o mayor a 2.000 caracteres, **When** intenta enviar, **Then** el sistema lo rechaza indicando el motivo.
6. **Given** otro Socio u otro rol, **When** intenta abrir una conversación ajena, **Then** el acceso se deniega sin revelar si existe.
7. **Given** un mensaje enviado, **When** se consulta su historial, **Then** no puede editarse ni borrarse.

---

### Edge Cases

- Convocatoria cuya fecha es hoy con hora ya pasada: se rechaza como fecha pasada; con hora futura, se acepta.
- Evento vinculado que luego se anula: la convocatoria no cambia sola; la secretaría decide si la anula.
- Socio sin correo registrado: no se le envía aviso y no cuenta como fallo.
- Servidor de correo caído: la convocatoria se publica igual y se informa que el aviso no pudo enviarse.
- Documento publicado y luego anulado: deja de ser visible y descargable de inmediato.
- Descarga con la dirección directa de un documento no publicado por un Socio: denegada igual que si no existiera.
- Dos conversaciones con el mismo asunto: se distinguen por fecha; no se fusionan.
- Administrador que inicia conversación con un socio sin cuenta: no es posible, solo aparecen socios con cuenta.
- Conversaciones de un socio cuya cuenta se desactiva: se conservan para el Administrador; el Socio no puede entrar.
- Cambio de Administrador de la Junta: el nuevo Administrador ve todas las conversaciones de la junta.
- Un usuario de una junta intenta abrir convocatorias, documentos, comunicaciones o conversaciones de otra junta: acceso denegado sin revelar si existen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El Secretario/a MUST poder emitir convocatorias a asamblea general o minga con título, fecha, hora, lugar, orden del día y evento vinculado opcional (RF-25, RF-26).
- **FR-002**: El sistema MUST rechazar convocatorias con fecha y hora ya pasadas y eventos vinculados de otra junta o anulados.
- **FR-003**: El sistema MUST publicar la convocatoria al emitirla y, a elección del Secretario/a, avisar por correo a los socios activos con correo, sin que un fallo de envío impida la publicación, e informar cuántos avisos se enviaron.
- **FR-004**: El Secretario/a MUST poder anular una convocatoria con motivo; la anulada deja de ser visible para los socios y se conserva.
- **FR-005**: El Socio MUST poder consultar las convocatorias publicadas, separando próximas y pasadas (RF-31).
- **FR-006**: El Secretario/a MUST poder archivar actas de asamblea, actas de directiva y resoluciones con título, fecha, descripción opcional y archivo PDF o imagen de hasta 5 MB (RF-27, RF-28).
- **FR-007**: El Secretario/a MUST poder publicar y retirar de publicación un documento, y anularlo con motivo; nunca se borra.
- **FR-008**: Los socios MUST ver y descargar únicamente los documentos publicados y no anulados de su junta; el acceso por dirección directa MUST aplicar la misma regla (RF-31).
- **FR-009**: El sistema MUST validar los archivos por su tipo real y tamaño y servirlos solo con sesión y de la misma junta.
- **FR-010**: El Secretario/a MUST poder registrar comunicaciones recibidas con institución, asunto, referencia opcional, fecha de recepción no futura, resumen y adjunto opcional, y anularlas con motivo (RF-29, RF-30).
- **FR-011**: El Secretario/a MUST poder publicar una comunicación como comunicado para los socios y retirarla de publicación; los socios ven solo los comunicados publicados y no anulados (RF-31).
- **FR-012**: El sistema MUST ofrecer búsqueda por texto y filtros por tipo y año en documentos y comunicaciones, con paginación.
- **FR-013**: Un Socio con cuenta MUST poder iniciar una conversación con el Administrador de la Junta con asunto y texto, y el Administrador MUST poder iniciar conversaciones con socios que tengan cuenta (RF-32, RF-33).
- **FR-014**: Las dos partes MUST poder responder en la conversación; los mensajes no se editan ni se borran; el texto va de 1 a 2.000 caracteres.
- **FR-015**: El sistema MUST indicar los mensajes no leídos por conversación y en total para quien recibe, y marcarlos como leídos al abrir la conversación.
- **FR-016**: Cada conversación MUST ser visible solo para el Socio participante y para el Administrador de la junta; ningún otro socio ni rol accede a ella.
- **FR-017**: El sistema MUST aplicar permisos por rol: el Secretario/a emite, archiva y registra; el Administrador de la Junta y el Tesorero/a consultan convocatorias, documentos y comunicaciones; el Administrador además conversa; el Socio ve solo lo publicado y sus conversaciones.
- **FR-018**: El sistema MUST aislar completamente los datos de cada junta, de modo que ningún usuario acceda a convocatorias, documentos, comunicaciones ni conversaciones de otra.
- **FR-019**: El sistema MUST registrar auditoría de emisiones, anulaciones, archivos, publicaciones, registros y apertura de conversaciones (quién, cuándo, qué).
- **FR-020**: La interfaz MUST estar en español, ser responsiva y cumplir las pautas de accesibilidad del proyecto.

### Key Entities *(include if feature involves data)*

- **Convocatoria**: aviso de asamblea o minga; tipo, título, fecha, hora, lugar, orden del día, evento vinculado opcional, estado (publicada o anulada), motivo, cantidad de avisos por correo.
- **Documento**: acta de asamblea, acta de directiva o resolución; título, fecha, descripción, archivo, publicado (sí/no), estado (vigente o anulado) y motivo.
- **Comunicación recibida**: oficio de otra institución; institución, asunto, referencia, fecha de recepción, resumen, adjunto opcional, publicada como comunicado (sí/no), estado y motivo.
- **Conversación**: hilo entre un Socio con cuenta y el Administrador; asunto, socio participante, quién la inició, fecha de última actividad.
- **Mensaje**: texto de una conversación; autor, si es de la administración, fecha y fecha de lectura.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un Secretario/a emite una convocatoria en menos de 2 minutos.
- **SC-002**: Un Secretario/a archiva y publica un acta en menos de 2 minutos.
- **SC-003**: Un Socio encuentra la próxima convocatoria o descarga un acta publicada en menos de 1 minuto desde que inicia sesión.
- **SC-004**: El 100 % de las convocatorias con fecha pasada y de los archivos de tipo o tamaño no permitidos es rechazado.
- **SC-005**: En el 100 % de las pruebas, un Socio no accede a documentos no publicados ni a conversaciones ajenas, ni siquiera con la dirección directa.
- **SC-006**: En el 100 % de las pruebas, un usuario de una junta no accede a convocatorias, documentos, comunicaciones ni conversaciones de otra junta.
- **SC-007**: Un mensaje enviado aparece como no leído para quien lo recibe en menos de 5 segundos y deja de serlo al abrir la conversación.
- **SC-008**: El 100 % de las emisiones, anulaciones, publicaciones y registros queda auditado.

## Assumptions

- Este módulo cubre RF-25 a RF-33 (convocatorias, actas y resoluciones, comunicaciones recibidas, consulta del Socio y mensajería); los códigos concretos de cada línea del documento del proyecto se agruparon por tema.
- El Secretario/a es el único rol que emite, archiva y registra; el Administrador de la Junta y el Tesorero/a consultan.
- «Administradores de la página» es el Administrador de la Junta de cada junta; el Secretario/a no participa en la mensajería.
- Solo los socios con cuenta de acceso pueden usar la mensajería; el padrón por sí solo no basta.
- El aviso por correo usa el servicio de correo ya configurado; no hay mensajes SMS ni notificaciones push.
- Las convocatorias se publican al emitirse; los errores se corrigen anulando y emitiendo una nueva.
- Los documentos y comunicaciones no se editan tras archivarse, solo se publican, retiran o anulan; las correcciones se hacen anulando y registrando de nuevo.
- Los archivos admiten PDF, PNG y JPEG de hasta 5 MB y se guardan en el almacén de archivos existente.
- Los mensajes son solo texto, sin adjuntos, y no se editan ni se borran.
- No hay cierre de conversaciones ni grupos de destinatarios en esta versión.
- La interfaz sigue el estilo de los módulos anteriores y los mockups del equipo.
