# Feature Specification: Gestión de Plataforma (multi-junta)

**Feature Branch**: `001-gestion-plataforma`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "Módulo de Gestión de Plataforma (multi-junta): inicio de sesión para todos los roles, panel del Super Administrador, alta/edición/desactivación de juntas (RF-01), asignación y cambio del Administrador de la Junta (RF-04), configuración de datos generales de la junta (RF-02) y administración de cuentas de socios (RF-05). Datos de cada junta aislados."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Iniciar sesión en el portal (Priority: P1)

Cualquier usuario (Super Administrador, Administrador de la Junta, Secretario/a, Tesorero/a o Socio) ingresa al portal con su correo o número de cédula y su contraseña. Opcionalmente indica el identificador de su junta para llegar directo a su espacio. Puede pedir mantener la sesión activa y recuperar su contraseña si la olvidó.

**Why this priority**: Sin acceso autenticado ningún otro módulo es utilizable; es la base de todos los roles.

**Independent Test**: Con una cuenta creada, iniciar sesión y verificar que se llega al espacio correspondiente al rol; con credenciales erróneas, verificar que se rechaza el acceso.

**Acceptance Scenarios**:

1. **Given** un usuario activo con credenciales válidas, **When** ingresa correo o cédula y contraseña, **Then** accede a su espacio de trabajo según su rol y su junta.
2. **Given** credenciales incorrectas, **When** intenta ingresar, **Then** ve un mensaje genérico de error sin revelar si el usuario existe.
3. **Given** un usuario con cuenta desactivada, **When** intenta ingresar, **Then** el acceso es rechazado con un mensaje indicando contactar a su administrador.
4. **Given** un usuario que olvidó su contraseña, **When** solicita recuperarla, **Then** recibe instrucciones para establecer una nueva.
5. **Given** un usuario que marcó "mantener sesión activa", **When** cierra y reabre el navegador dentro del período permitido, **Then** sigue con su sesión iniciada.
6. **Given** un usuario que indica el identificador de una junta a la que no pertenece, **When** intenta ingresar, **Then** el acceso es rechazado.

---

### User Story 2 - Registrar y administrar juntas (Priority: P1)

El Super Administrador consulta el listado de organizaciones comunitarias, lo busca y filtra por provincia, cantón y parroquia/sector, y da de alta una nueva junta, edita sus datos o la desactiva (RF-01).

**Why this priority**: Es la razón de ser de la plataforma multi-junta: sin juntas registradas no hay clientes que la usen.

**Independent Test**: Registrar una junta nueva, verla en el listado, editarla, desactivarla, y comprobar que sus usuarios ya no pueden ingresar.

**Acceptance Scenarios**:

1. **Given** el Super Administrador en el listado, **When** completa el alta de una junta con sus datos obligatorios, **Then** la junta aparece en el listado con estado activa.
2. **Given** un listado con muchas juntas, **When** busca por nombre o filtra por provincia, cantón o parroquia, **Then** solo ve las juntas coincidentes.
3. **Given** una junta existente, **When** edita sus datos y guarda, **Then** los cambios se reflejan en el listado.
4. **Given** una junta activa, **When** el Super Administrador la desactiva tras confirmar, **Then** la junta y sus usuarios pierden acceso, pero sus datos se conservan.
5. **Given** una junta desactivada, **When** el Super Administrador la reactiva, **Then** recupera acceso con todos sus datos intactos.
6. **Given** el alta de una junta con un nombre ya existente en la misma parroquia, **When** intenta guardar, **Then** el sistema avisa del posible duplicado y no la crea.

---

### User Story 3 - Asignar y cambiar el Administrador de una junta (Priority: P2)

Tras registrar una junta, el Super Administrador asigna a una persona como Administrador de la Junta, validando la cédula y el acta que respalda su designación (RF-04). Más adelante puede cambiar al administrador, indicando el motivo.

**Why this priority**: Sin administrador la junta no puede configurarse ni crear cuentas; es el paso que la habilita.

**Independent Test**: Asignar un administrador a una junta recién creada y verificar que puede ingresar y administrar solo esa junta; luego cambiarlo y verificar que el anterior pierde el rol.

**Acceptance Scenarios**:

1. **Given** una junta sin administrador, **When** el Super Administrador ingresa una cédula válida y adjunta el acta de designación, **Then** la persona queda como Administrador de la Junta y puede ingresar.
2. **Given** una cédula inválida, **When** intenta asignarla, **Then** el sistema rechaza la operación indicando el error.
3. **Given** una junta con administrador, **When** el Super Administrador solicita el cambio con un motivo y el nuevo administrador válido, **Then** el nuevo administrador obtiene el rol y el anterior lo pierde.
4. **Given** un cambio de administrador, **When** se completa, **Then** queda registrado quién lo hizo, cuándo y por qué.

---

### User Story 4 - Panel de control del Super Administrador (Priority: P2)

Al ingresar, el Super Administrador ve un panel con el total de juntas, el total de eventos de la plataforma, un calendario y la opción de descargar un reporte.

**Why this priority**: Da visibilidad general de la plataforma, pero no bloquea la operación de las juntas.

**Independent Test**: Con varias juntas y eventos registrados, abrir el panel y verificar que los totales coinciden con los datos y que el reporte se descarga.

**Acceptance Scenarios**:

1. **Given** juntas y eventos registrados, **When** el Super Administrador abre el panel, **Then** ve los totales correctos y el calendario.
2. **Given** el panel abierto, **When** pulsa descargar reporte, **Then** obtiene un archivo con el resumen de juntas y eventos.
3. **Given** el panel, **When** lo consulta, **Then** solo ve cifras agregadas, sin acceso al detalle de datos internos de las juntas.

---

### User Story 5 - Configurar los datos generales de la junta (Priority: P2)

El Administrador de la Junta configura nombre, tipo de organización, ubicación, sectores y parámetros propios de su junta (RF-02).

**Why this priority**: Los sectores y parámetros alimentan los módulos administrativo y financiero.

**Independent Test**: Como Administrador, editar los datos y agregar sectores; verificar que se guardan y son visibles solo dentro de esa junta.

**Acceptance Scenarios**:

1. **Given** un Administrador de la Junta, **When** modifica nombre, tipo o ubicación y guarda, **Then** los cambios se reflejan en su junta.
2. **Given** la configuración, **When** agrega, edita o elimina un sector sin socios asociados, **Then** el cambio se guarda.
3. **Given** un sector con socios o predios asociados, **When** intenta eliminarlo, **Then** el sistema lo impide y sugiere reasignarlos primero.
4. **Given** un Administrador de la junta A, **When** intenta ver o modificar datos de la junta B, **Then** el acceso es denegado.

---

### User Story 6 - Administrar cuentas de socios (Priority: P2)

El Administrador de la Junta crea, edita y desactiva las cuentas de usuario (usuario y contraseña) de los socios de su junta y asigna roles internos (Secretario/a, Tesorero/a, Socio) (RF-05).

**Why this priority**: Sin cuentas, los socios y la directiva no pueden usar el sistema.

**Independent Test**: Crear una cuenta, iniciar sesión con ella, desactivarla y verificar que ya no puede ingresar.

**Acceptance Scenarios**:

1. **Given** un Administrador de la Junta, **When** crea una cuenta con cédula válida, nombre, correo y rol, **Then** la cuenta queda activa y el usuario recibe sus credenciales iniciales.
2. **Given** una cédula ya registrada en la misma junta, **When** intenta crear otra cuenta con ella, **Then** el sistema lo impide.
3. **Given** una cuenta existente, **When** el Administrador edita sus datos o su rol, **Then** los cambios se aplican.
4. **Given** una cuenta activa, **When** el Administrador la desactiva, **Then** el usuario no puede ingresar, pero su historial se conserva.
5. **Given** un usuario con credenciales iniciales, **When** ingresa por primera vez, **Then** debe establecer una contraseña propia.

---

### Edge Cases

- Una persona pertenece a dos juntas distintas: debe poder tener cuentas separadas en cada una sin mezclar sus datos.
- Se desactiva una junta con sesiones abiertas: las sesiones activas de sus usuarios deben terminar.
- Se intenta desactivar o cambiar al único Administrador sin indicar reemplazo: la operación debe pedir un nuevo administrador o advertir que la junta quedará sin él.
- Varios intentos fallidos de ingreso consecutivos: la cuenta debe bloquearse temporalmente.
- Se sube un acta en formato o tamaño no permitido al asignar administrador: se rechaza con mensaje claro.
- El Administrador intenta desactivar su propia cuenta: se debe impedir.
- Búsqueda o filtros sin resultados: se muestra un estado vacío informativo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir a todos los roles iniciar sesión con correo o cédula y contraseña, con identificador de junta opcional.
- **FR-002**: El sistema MUST ofrecer la opción de mantener la sesión activa y la recuperación de contraseña.
- **FR-003**: El sistema MUST bloquear temporalmente una cuenta tras varios intentos fallidos consecutivos de ingreso.
- **FR-004**: El sistema MUST rechazar el ingreso de cuentas desactivadas y de usuarios cuya junta esté desactivada, sin borrar sus datos.
- **FR-005**: El Super Administrador MUST poder registrar nuevas juntas con nombre, tipo, ubicación (provincia, cantón, parroquia) y datos de contacto (RF-01).
- **FR-006**: El Super Administrador MUST poder buscar y filtrar el listado de juntas por nombre, provincia, cantón y parroquia/sector.
- **FR-007**: El Super Administrador MUST poder editar, desactivar y reactivar juntas; la desactivación MUST conservar los datos y requerir confirmación (RF-01).
- **FR-008**: El sistema MUST impedir el registro de juntas duplicadas (mismo nombre en la misma parroquia).
- **FR-009**: El Super Administrador MUST poder asignar el Administrador de una junta validando su cédula y adjuntando el acta de designación (RF-04).
- **FR-010**: El Super Administrador MUST poder cambiar el Administrador de una junta indicando motivo; el sistema MUST registrar quién, cuándo y por qué.
- **FR-011**: El sistema MUST validar el formato y dígito verificador de toda cédula ecuatoriana ingresada.
- **FR-012**: El sistema MUST mostrar al Super Administrador un panel con total de juntas, total de eventos, calendario y descarga de reporte, solo con datos agregados.
- **FR-013**: El Administrador de la Junta MUST poder editar nombre, tipo, ubicación, sectores y parámetros propios de su junta (RF-02).
- **FR-014**: El sistema MUST impedir eliminar sectores que tengan socios o predios asociados.
- **FR-015**: El Administrador de la Junta MUST poder crear, editar y desactivar cuentas de usuario de su junta y asignar los roles Secretario/a, Tesorero/a y Socio (RF-05).
- **FR-016**: El sistema MUST impedir cuentas con cédula o correo duplicados dentro de una misma junta.
- **FR-017**: El sistema MUST exigir que un usuario cambie su contraseña inicial en el primer ingreso.
- **FR-018**: El sistema MUST aislar completamente los datos de cada junta: ningún usuario de una junta puede ver ni modificar datos de otra.
- **FR-019**: El sistema MUST aplicar permisos por rol: el Super Administrador no pertenece a ninguna junta y el Administrador solo opera sobre la suya.
- **FR-020**: El sistema MUST registrar auditoría de altas, desactivaciones, cambios de administrador y de cuentas (quién, cuándo, qué).
- **FR-021**: Los textos e interfaz MUST estar en español y ser usables en móvil y escritorio.

### Key Entities *(include if feature involves data)*

- **Junta (Organización)**: organización comunitaria registrada; tiene nombre, tipo (junta de riego, agua potable, parroquial, barrial, etc.), ubicación, estado (activa/desactivada) y parámetros propios.
- **Sector**: división interna de una junta; pertenece a una junta y se asocia luego a socios y predios.
- **Usuario / Cuenta**: persona con credenciales; tiene cédula, nombre, correo, teléfono, rol, estado y junta a la que pertenece (el Super Administrador no tiene junta).
- **Rol**: Super Administrador, Administrador de la Junta, Secretario/a, Tesorero/a, Miembro/Socio.
- **Designación de Administrador**: vínculo entre una junta y su administrador vigente, con acta de respaldo, motivo, fecha y responsable.
- **Registro de Auditoría**: constancia de quién hizo qué operación y cuándo.
- **Evento**: asamblea, minga u otra actividad registrada por una junta; en este módulo solo se cuentan y muestran de forma agregada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario con cuenta válida inicia sesión en menos de 30 segundos.
- **SC-002**: El Super Administrador registra una junta nueva y le asigna su administrador en menos de 5 minutos.
- **SC-003**: Un Administrador de la Junta crea una cuenta de socio en menos de 2 minutos.
- **SC-004**: En el 100 % de las pruebas, un usuario de una junta no accede a ningún dato de otra junta.
- **SC-005**: El 100 % de las cédulas inválidas es rechazado y el 100 % de las operaciones de alta, desactivación y cambio de administrador queda auditado.
- **SC-006**: El listado de juntas devuelve resultados de búsqueda o filtro en menos de 2 segundos con 500 juntas registradas.
- **SC-007**: Al menos 90 % de los usuarios de prueba completa su primera tarea (iniciar sesión, crear una cuenta o registrar una junta) sin ayuda.

## Assumptions

- Esta especificación cubre solo el módulo de Plataforma; asistencia, predios, finanzas y comunicaciones se especifican en módulos posteriores.
- El Super Administrador inicial es creado durante la puesta en marcha de la plataforma, no mediante el propio sistema.
- Una cuenta pertenece a una sola junta; una persona en varias juntas tiene una cuenta por cada una.
- La recuperación de contraseña se hace por correo electrónico y requiere que la cuenta tenga un correo registrado.
- La desactivación de juntas y cuentas es lógica (no se borra información) para conservar historial.
- El "Evento" que cuenta el panel proviene de módulos posteriores; hasta entonces el total puede ser cero.
- El rol de Administrador de la Junta puede ser ocupado por una sola persona a la vez por junta.
- Se asume conexión a internet estable y uso desde navegadores actuales en móvil y escritorio.
- La interfaz parte de los mockups del equipo (Portal de Acceso Comunal, Listado de Organizaciones, Panel de Control Territorial, Gestión de Super Administradores); las diferencias se justificarán en el plan.
