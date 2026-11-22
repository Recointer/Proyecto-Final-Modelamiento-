# Feature Specification: Gestión Administrativa

**Feature Branch**: `002-gestion-administrativa`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "Módulo de Gestión Administrativa: nómina de socios (RF-07), eventos y asistencia a asambleas y mingas (RF-08, RF-09), predios y recursos con localización en mapa (RF-10, RF-11), calendario semanal y horarios de uso de servicios (RF-12), y consulta del Socio de su propia información e historial de asistencia. Actor principal: Secretario/a. Datos aislados por junta."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mantener la nómina de socios (Priority: P1)

El/la Secretario/a registra a los miembros de la junta (cédula, nombres, sector, teléfono, correo, fecha de ingreso), los edita cuando cambian sus datos y los marca como activos o inactivos. Puede buscar y filtrar la nómina por nombre, cédula, sector y estado (RF-07).

**Why this priority**: La nómina es la base de todo el módulo: la asistencia, los predios y los turnos dependen de que los socios existan.

**Independent Test**: Registrar un socio, encontrarlo por cédula, editarlo, marcarlo inactivo y comprobar que su ficha y su historial se conservan.

**Acceptance Scenarios**:

1. **Given** un Secretario/a en la nómina, **When** registra un socio con cédula válida, nombres, sector y fecha de ingreso, **Then** el socio aparece en la nómina como activo.
2. **Given** una cédula con dígito verificador incorrecto, **When** intenta guardar, **Then** el sistema lo rechaza indicando el error y no crea el registro.
3. **Given** una cédula ya registrada en la misma junta, **When** intenta registrar otro socio con ella, **Then** el sistema lo impide sin revelar datos del socio existente más allá de su nombre.
4. **Given** una nómina con muchos socios, **When** busca por nombre o cédula y filtra por sector o estado, **Then** ve solo los socios que coinciden, paginados.
5. **Given** un socio activo, **When** el Secretario/a lo marca inactivo, **Then** deja de aparecer en las listas de asistencia nuevas pero su historial y sus predios se conservan; al reactivarlo vuelve a participar.
6. **Given** un socio con una cuenta de acceso creada por el Administrador de la Junta con la misma cédula, **When** inicia sesión, **Then** el sistema lo reconoce como ese socio y le muestra su información.

---

### User Story 2 - Registrar eventos y asistencia (Priority: P1)

El/la Secretario/a registra las asambleas y mingas de la junta (tipo, título, fecha, lugar) y toma la asistencia de cada socio: presente, ausente o ausente justificado con motivo. Ve contadores de presentes y ausentes y el porcentaje de asistencia frente al quórum mínimo que configuró la junta (RF-08, RF-09).

**Why this priority**: La asistencia es la función más usada de la secretaría y alimenta las multas del módulo Financiero.

**Independent Test**: Crear una asamblea, marcar presentes y ausentes (uno justificado), guardar y verificar contadores, porcentaje y estado de quórum; reabrir y comprobar que se conserva.

**Acceptance Scenarios**:

1. **Given** un Secretario/a, **When** registra una asamblea o minga con título, fecha y lugar, **Then** el evento queda disponible para tomar asistencia.
2. **Given** un evento y la lista de socios activos, **When** busca un socio por nombre o cédula, **Then** la lista se reduce a los que coinciden.
3. **Given** la lista de asistencia, **When** pulsa «Marcar todos» como presentes, **Then** todos los socios visibles quedan presentes y puede corregir uno por uno.
4. **Given** un socio ausente, **When** el Secretario/a indica un motivo, **Then** queda como ausente justificado y no cuenta como inasistencia injustificada.
5. **Given** marcas de asistencia, **When** las modifica, **Then** los contadores de presentes y ausentes y el porcentaje se actualizan al instante y se indica si se alcanza o no el quórum configurado.
6. **Given** una asistencia incompleta, **When** pulsa «Guardar asistencia», **Then** queda registrada y puede reabrirla después para corregirla, con constancia de quién y cuándo la modificó.
7. **Given** inasistencias injustificadas registradas, **When** el módulo Financiero las consulte, **Then** dispone de la lista por socio y evento sin que este módulo calcule multas.

---

### User Story 3 - Registrar predios y verlos en el mapa (Priority: P2)

El/la Secretario/a registra los predios o recursos asignados a cada socio (código, nombre, superficie, sector, socio titular), les asocia su localización con coordenadas y una imagen, y los visualiza en un mapa filtrando por sector. El Socio ve en el mapa solo sus propios predios (RF-10, RF-11).

**Why this priority**: Es el segundo gran registro administrativo, pero la junta puede operar la asistencia sin él.

**Independent Test**: Crear un predio de un socio con coordenadas e imagen, verlo en el mapa, filtrar por sector, y comprobar que el socio titular lo ve y otro socio no.

**Acceptance Scenarios**:

1. **Given** un socio y sectores configurados, **When** el Secretario/a registra un predio con código, nombre, superficie, sector y titular, **Then** el predio queda asociado al socio.
2. **Given** un código de predio ya usado en la junta, **When** intenta repetirlo, **Then** el sistema lo rechaza.
3. **Given** un predio, **When** registra coordenadas fuera del rango geográfico válido, **Then** se rechazan; con coordenadas válidas el predio aparece ubicado en el mapa.
4. **Given** una imagen del predio, **When** la sube, **Then** solo se aceptan imágenes de los tipos y tamaño permitidos y se muestra en su ficha.
5. **Given** el mapa de predios, **When** el Secretario/a filtra por sector, **Then** ve solo los predios de ese sector y, al elegir uno, su ficha (titular, sector, superficie, coordenadas).
6. **Given** un Socio con predios, **When** abre el mapa, **Then** ve únicamente los suyos.
7. **Given** que el mapa no está disponible (sin conexión o sin acceso al servicio de mapas), **When** abre la pantalla, **Then** ve igualmente la lista de predios con sus coordenadas y un aviso claro.
8. **Given** un sector con predios asociados, **When** el Administrador intenta eliminarlo, **Then** se rechaza (regla ya definida en la configuración de la junta).

---

### User Story 4 - Gestionar el calendario semanal de servicios (Priority: P2)

El/la Secretario/a define los servicios que administra la junta (agua de riego o potable, espacios comunales, maquinaria, según su tipo) y sus turnos semanales por sector (día, hora de inicio y fin). El Socio consulta el calendario que corresponde a su sector (RF-12).

**Why this priority**: Organiza el uso de recursos compartidos; es valioso pero no bloquea el resto.

**Independent Test**: Crear un servicio con dos turnos para un sector, ver la semana, y comprobar que un socio de ese sector los ve y uno de otro sector no.

**Acceptance Scenarios**:

1. **Given** un Secretario/a, **When** crea un servicio con nombre y tipo, **Then** queda disponible para asignarle turnos.
2. **Given** un servicio, **When** agrega un turno con sector, día de la semana y horas de inicio y fin, **Then** aparece en el calendario semanal.
3. **Given** un turno con hora de fin anterior o igual a la de inicio, **When** intenta guardarlo, **Then** el sistema lo rechaza.
4. **Given** dos turnos del mismo servicio y sector que se solapan en el mismo día, **When** intenta guardar el segundo, **Then** el sistema lo rechaza indicando el conflicto.
5. **Given** un turno existente, **When** lo edita o lo elimina, **Then** el calendario se actualiza.
6. **Given** un Socio de un sector, **When** consulta el calendario, **Then** ve los turnos de su sector, con próximos turnos destacados.
7. **Given** un servicio sin turnos, **When** se consulta, **Then** se muestra un estado vacío informativo.

---

### User Story 5 - El Socio consulta su información e historial (Priority: P2)

El Socio, con su cuenta, consulta su ficha, sus predios y su historial de asistencia con el porcentaje de cumplimiento comunitario, y descarga el historial en PDF.

**Why this priority**: Da transparencia a los miembros y reduce consultas a la secretaría.

**Independent Test**: Con un socio con asistencia registrada, iniciar sesión como ese socio, ver su historial y porcentaje, descargar el PDF y comprobar que no accede a datos de otros socios.

**Acceptance Scenarios**:

1. **Given** un Socio con cuenta vinculada a su registro por cédula, **When** abre «Mi información», **Then** ve sus datos, su sector y sus predios.
2. **Given** eventos con asistencia registrada, **When** abre su historial, **Then** ve cada evento con su estado (presente, ausente, justificado), el porcentaje de cumplimiento y los totales.
3. **Given** el historial, **When** filtra por asambleas o mingas, **Then** ve solo ese tipo.
4. **Given** el historial, **When** pulsa descargar, **Then** obtiene un PDF con su nombre, cédula, junta, fecha de emisión, el detalle y el porcentaje.
5. **Given** un Socio, **When** intenta ver la información o el historial de otro socio, **Then** el acceso es denegado.
6. **Given** una cuenta de Socio cuya cédula no está en la nómina, **When** abre «Mi información», **Then** ve un mensaje indicando que aún no figura en el padrón y que contacte a la secretaría.

---

### Edge Cases

- Socio dado de baja con asistencia previa: su historial se conserva y sigue contando en reportes pasados.
- Socio registrado después de un evento: no aparece en la asistencia de eventos anteriores; el porcentaje de cada socio se calcula solo sobre los eventos posteriores a su fecha de ingreso.
- Cambiar a un socio de sector: sus predios conservan su propio sector; el calendario del socio sigue su sector actual.
- Evento con asistencia guardada que se quiere eliminar: no se elimina, se anula con motivo, y deja de contar en porcentajes.
- Evento en fecha futura: se puede crear y no admite asistencia hasta que llegue su fecha.
- Cédula de socio con espacios o guiones: se normaliza antes de validar.
- Imagen de predio corrupta, de tipo no permitido o demasiado pesada: se rechaza con mensaje claro sin afectar el resto del formulario.
- Quórum configurado con valor 100 % y un solo socio activo: el cálculo no falla.
- Junta con cero socios activos: la asistencia muestra estado vacío y porcentaje no aplicable.
- Un Secretario/a de una junta intenta abrir un recurso de otra junta: acceso denegado sin revelar si existe.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El Secretario/a MUST poder registrar socios con cédula, nombres completos, sector, teléfono, correo (opcional), estado y fecha de ingreso (RF-07).
- **FR-002**: El sistema MUST validar el formato y el dígito verificador de la cédula y rechazar cédulas duplicadas dentro de la misma junta.
- **FR-003**: El Secretario/a MUST poder editar los datos de un socio y marcarlo activo o inactivo sin perder su historial ni sus predios.
- **FR-004**: El sistema MUST ofrecer búsqueda por nombre o cédula y filtros por sector y estado, con paginación.
- **FR-005**: El sistema MUST vincular el padrón con la cuenta de acceso por la misma cédula dentro de la junta, sin que el padrón requiera una cuenta.
- **FR-006**: El Secretario/a MUST poder registrar eventos de la junta de tipo asamblea o minga con título, fecha y lugar, y anularlos con motivo (RF-08, RF-09).
- **FR-007**: El Secretario/a MUST poder registrar la asistencia de cada socio activo a un evento como presente, ausente o ausente justificado (con motivo obligatorio).
- **FR-008**: El sistema MUST mostrar contadores de presentes, ausentes y justificados, y el porcentaje de asistencia comparado con el quórum mínimo configurado por la junta.
- **FR-009**: El sistema MUST permitir buscar socios en la lista de asistencia y marcar todos como presentes.
- **FR-010**: El sistema MUST permitir reabrir y corregir una asistencia guardada, dejando constancia de quién la modificó y cuándo.
- **FR-011**: El sistema MUST dejar disponible para el módulo Financiero la lista de inasistencias injustificadas por socio y evento, sin calcular multas aquí.
- **FR-012**: El Secretario/a MUST poder registrar y mantener predios o recursos con código único por junta, nombre, superficie, sector, socio titular, coordenadas e imagen (RF-10, RF-11).
- **FR-013**: El sistema MUST validar que las coordenadas estén en un rango geográfico válido y que la imagen sea de un tipo y tamaño permitidos.
- **FR-014**: El sistema MUST mostrar los predios en un mapa con filtro por sector y ficha del predio seleccionado, y MUST seguir mostrando la lista con coordenadas si el mapa no está disponible.
- **FR-015**: El Socio MUST ver únicamente sus propios predios, su ficha y su historial.
- **FR-016**: El Secretario/a MUST poder gestionar servicios de la junta y sus turnos semanales por sector con día, hora de inicio y hora de fin (RF-12).
- **FR-017**: El sistema MUST rechazar turnos con fin menor o igual al inicio y turnos que se solapen para el mismo servicio, sector y día.
- **FR-018**: El Socio MUST poder consultar el calendario semanal correspondiente a su sector.
- **FR-019**: El Socio MUST poder consultar su historial de asistencia con porcentaje de cumplimiento, filtrarlo por tipo de evento y descargarlo en PDF.
- **FR-020**: El sistema MUST calcular el porcentaje de cumplimiento de cada socio solo sobre los eventos no anulados posteriores a su fecha de ingreso en los que estaba activo.
- **FR-021**: El sistema MUST aislar completamente los datos de cada junta y aplicar permisos por rol: el Secretario/a gestiona; el Administrador de la Junta y el Tesorero/a consultan; el Socio ve solo lo suyo.
- **FR-022**: El sistema MUST registrar auditoría de altas, cambios, bajas lógicas, anulaciones y modificaciones de asistencia (quién, cuándo, qué).
- **FR-023**: El sistema MUST aportar el total de eventos de cada junta al panel del Super Administrador únicamente como cifra agregada, sin exponer datos internos.
- **FR-024**: La interfaz MUST estar en español, ser responsiva y cumplir las pautas de accesibilidad del proyecto.

### Key Entities *(include if feature involves data)*

- **Socio (padrón)**: miembro de la junta; cédula, nombres, sector, teléfono, correo, estado (activo/inactivo), fecha de ingreso. Pertenece a una junta y puede estar vinculado a una cuenta por la cédula.
- **Evento**: asamblea o minga; tipo, título, fecha, lugar, estado (programado, realizado, anulado) y motivo de anulación.
- **Asistencia**: relación socio–evento con estado (presente, ausente, justificado), motivo, y quién y cuándo la registró o modificó.
- **Predio / Recurso**: código, nombre, superficie, sector, socio titular, coordenadas, imagen y estado.
- **Servicio**: recurso o instalación que administra la junta (agua de riego o potable, espacio comunal, maquinaria); nombre, tipo, estado.
- **Turno**: horario semanal de un servicio para un sector; día de la semana, hora de inicio, hora de fin.
- **Sector**: división de la junta definida en su configuración; ya existente, ahora referenciada por socios, predios y turnos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un Secretario/a registra un socio nuevo en menos de 2 minutos.
- **SC-002**: Un Secretario/a toma la asistencia de una asamblea de 100 socios en menos de 5 minutos.
- **SC-003**: El 100 % de las cédulas inválidas y duplicadas es rechazado, y el 100 % de las modificaciones de asistencia queda auditado.
- **SC-004**: La búsqueda en una nómina de 1.000 socios devuelve resultados en menos de 2 segundos.
- **SC-005**: Un Socio localiza su porcentaje de cumplimiento y descarga su historial en PDF en menos de 1 minuto desde que inicia sesión.
- **SC-006**: En el 100 % de las pruebas, un usuario de una junta no accede a socios, eventos, predios ni turnos de otra junta, y un Socio no accede a datos de otro socio.
- **SC-007**: El mapa muestra hasta 500 predios de una junta sin que el usuario perciba demoras, y sin mapa disponible la lista de predios sigue siendo utilizable.
- **SC-008**: Al menos el 90 % de los Secretarios/as de prueba completa su primera tarea (registrar socio, tomar asistencia o crear un turno) sin ayuda.

## Assumptions

- Este módulo cubre RF-07 a RF-12 y la consulta del Socio; las convocatorias, actas y mensajería son del módulo de Comunicaciones, y los pagos y multas del Financiero. Aquí solo se registran los eventos necesarios para tomar asistencia; publicar convocatorias sobre ellos llegará con Comunicaciones.
- El Secretario/a es el único rol que modifica los datos del módulo. El Administrador de la Junta y el Tesorero/a tienen acceso de solo consulta (el Tesorero/a necesita la asistencia para las multas).
- Los sectores son los definidos por el Administrador de la Junta en su configuración; no se crean sectores desde este módulo.
- Los parámetros de quórum de la junta (porcentaje mínimo) ya existen en la configuración y se reutilizan.
- Cada junta decide qué servicios administra; el tipo de junta solo sugiere ejemplos (riego, agua potable, espacios comunales, maquinaria).
- Las coordenadas se expresan en latitud y longitud decimales; el mapa depende de un servicio de mapas externo y su ausencia nunca bloquea el registro.
- Un socio puede no tener cuenta, y una cuenta de Socio puede no estar aún en el padrón; en ese caso se le informa.
- La fecha de ingreso de un socio no puede ser posterior a la fecha actual.
- Las imágenes de predios se limitan a formatos de imagen comunes y a un tamaño máximo de 5 MB.
- Se asume conexión a internet estable y uso desde navegadores actuales en móvil y escritorio.
- La interfaz parte de los mockups del equipo (Registrar/Actualizar Socio, Registrar Asistencia, Visualizar Mapa de Predios y Recursos, Consultar Historial de Asistencia); las diferencias se justificarán en el plan. Los datos de caudal, estado de red y compuertas que aparecen en el mockup del mapa quedan fuera de alcance.
