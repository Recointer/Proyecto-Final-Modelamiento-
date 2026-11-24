# Feature Specification: Gestión Financiera

**Feature Branch**: `003-gestion-financiera`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "Módulo de Gestión Financiera: cobros por año y concepto con cuentas por cobrar (RF-13, RF-14), multas por inasistencia generadas desde la asistencia (RF-15), egresos de la junta (RF-16), comprobantes de pago (RF-20), inventarios y activos fijos (RF-21, RF-22), reportes y caja (RF-24), y consulta del estado de cuenta del Socio. Actor principal: Tesorero/a. Datos aislados por junta."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cobrar a los socios y dar seguimiento a lo pendiente (Priority: P1)

El/la Tesorero/a define los conceptos de cobro de la junta (por ejemplo cuota anual de riego, mantenimiento, agua potable), emite cargos a los socios por año y concepto, y registra los pagos que reciben (total o parcial, con forma de pago). Cada pago genera un comprobante numerado. Ve en todo momento las cuentas por cobrar pendientes por año, concepto y socio, y cuáles están vencidas (RF-13, RF-14, RF-20).

**Why this priority**: El cobro de cuotas es el sustento económico de la junta y la función más usada de la tesorería.

**Independent Test**: Crear un concepto, emitir el cargo a un socio, registrar un pago parcial y luego el saldo, verificar que el saldo baja a cero, que cada pago tiene su comprobante y que el cargo pasa a «pagado».

**Acceptance Scenarios**:

1. **Given** un Tesorero/a, **When** crea un concepto de cobro con nombre, monto por defecto y tipo (cuota o servicio), **Then** queda disponible para emitir cargos.
2. **Given** un concepto, **When** emite el cargo de un año para todos los socios activos o para un sector, **Then** cada socio recibe un cargo pendiente y repetir la emisión no duplica cargos del mismo socio, año y concepto.
3. **Given** un cargo pendiente, **When** registra un pago con monto, fecha y forma de pago (efectivo, transferencia o depósito), **Then** el saldo se descuenta y se emite un comprobante numerado con consecutivo propio de la junta.
4. **Given** un cargo con saldo, **When** intenta registrar un pago mayor al saldo, **Then** el sistema lo rechaza indicando el saldo.
5. **Given** cargos con fecha de vencimiento pasada y saldo, **When** consulta las cuentas por cobrar, **Then** los ve marcados como vencidos y puede filtrar por año, concepto, sector, estado y socio.
6. **Given** un pago mal registrado, **When** el Tesorero/a lo anula con motivo, **Then** el saldo del cargo se restituye, el comprobante queda marcado como anulado y nada se borra.
7. **Given** un comprobante, **When** lo abre o lo descarga, **Then** obtiene un PDF con junta, socio, concepto, año, monto, forma de pago, número y fecha.

---

### User Story 2 - Generar multas por inasistencia (Priority: P1)

El/la Tesorero/a genera las multas de un evento a partir de la asistencia registrada por Secretaría: cada socio con inasistencia injustificada recibe un cargo cuyo monto sale de la multa configurada por la junta para ese tipo de evento. Las multas se cobran como cualquier otro cargo (RF-15).

**Why this priority**: Es la regla de negocio financiera central que enlaza Secretaría con Tesorería.

**Independent Test**: Con una asamblea con asistencia guardada (presentes, ausentes y un justificado), generar multas y verificar que solo los ausentes injustificados reciben cargo con el monto configurado; repetir la generación y comprobar que no duplica.

**Acceptance Scenarios**:

1. **Given** un evento con asistencia guardada, **When** el Tesorero/a genera las multas, **Then** cada socio ausente injustificado recibe un cargo por multa con el monto configurado para ese tipo de evento.
2. **Given** socios presentes o ausentes justificados, **When** se generan las multas, **Then** no reciben cargo.
3. **Given** multas ya generadas para un evento, **When** vuelve a generarlas, **Then** no se duplican y se informa cuántas ya existían.
4. **Given** un tipo de evento con multa configurada en cero, **When** intenta generar multas, **Then** el sistema avisa que no hay multa configurada y no crea cargos.
5. **Given** un evento sin asistencia guardada, anulado o con fecha futura, **When** intenta generar multas, **Then** el sistema lo impide con un mensaje claro.
6. **Given** una multa emitida por error, **When** el Tesorero/a la anula con motivo, **Then** deja de contar como cuenta por cobrar y queda en el historial.

---

### User Story 3 - Registrar egresos de la junta (Priority: P2)

El/la Tesorero/a registra los egresos (compras, trabajos, honorarios, tasas y otros) con fecha, categoría, descripción, beneficiario y monto, adjuntando opcionalmente el respaldo (PDF o imagen). Puede anular un egreso con motivo; nunca se borra (RF-16).

**Why this priority**: Completa el flujo de caja, pero la junta puede cobrar sin él.

**Independent Test**: Registrar un egreso con respaldo, filtrarlo por categoría y rango de fechas, anularlo con motivo y comprobar que sigue en el historial sin sumar a los totales.

**Acceptance Scenarios**:

1. **Given** un Tesorero/a, **When** registra un egreso con fecha, categoría, descripción, beneficiario y monto positivo, **Then** queda en el libro de egresos.
2. **Given** un egreso, **When** adjunta un respaldo en PDF o imagen dentro del tamaño permitido, **Then** queda asociado y solo roles autorizados de la misma junta pueden verlo.
3. **Given** un respaldo de tipo no permitido o demasiado pesado, **When** intenta guardarlo, **Then** el sistema lo rechaza con un mensaje claro sin perder el resto del formulario.
4. **Given** el libro de egresos, **When** filtra por categoría, rango de fechas o texto, **Then** ve solo lo que coincide, paginado, con el total filtrado.
5. **Given** un egreso, **When** lo anula con motivo, **Then** deja de sumar a los totales y se conserva con su motivo y autor.

---

### User Story 4 - Ver la caja y emitir reportes (Priority: P2)

El/la Tesorero/a y el/la Administrador/a de la Junta ven el resumen financiero de la junta (ingresos cobrados, egresos, saldo de caja y cuentas por cobrar) por año y rango de fechas, y emiten reportes descargables: libro de ingresos, libro de egresos, cuentas por cobrar y estado de caja (RF-24).

**Why this priority**: Da transparencia y rendición de cuentas a la directiva.

**Independent Test**: Con ingresos, egresos y deudas registrados, abrir el resumen, comprobar que los totales cuadran con los registros y descargar un reporte en PDF y en hoja de cálculo.

**Acceptance Scenarios**:

1. **Given** movimientos registrados, **When** abre el resumen de un año, **Then** ve ingresos cobrados, egresos, saldo de caja (ingresos − egresos) y total por cobrar, y los movimientos anulados no suman.
2. **Given** el resumen, **When** cambia el rango de fechas, **Then** las cifras se recalculan y coinciden con el detalle.
3. **Given** un reporte elegido, **When** lo descarga en PDF, **Then** obtiene un documento con junta, rango, fecha de emisión, detalle y totales.
4. **Given** un reporte tabular, **When** lo descarga en hoja de cálculo (CSV), **Then** abre correctamente con acentos y los mismos totales.
5. **Given** un Administrador de la Junta, **When** abre los reportes, **Then** puede verlos y descargarlos pero no modificar datos financieros.

---

### User Story 5 - El Socio consulta su estado de cuenta (Priority: P2)

El Socio ve su estado de cuenta: cargos por año y concepto, lo pagado, el saldo pendiente y sus multas, y descarga sus comprobantes de pago. No ve datos de otros socios (RF-20).

**Why this priority**: Reduce consultas a la tesorería y da transparencia a cada socio.

**Independent Test**: Con un socio con cargos, pagos y una multa, iniciar sesión como ese socio, ver el estado de cuenta, descargar un comprobante y comprobar que no puede ver el de otro socio.

**Acceptance Scenarios**:

1. **Given** un Socio vinculado al padrón por su cédula, **When** abre «Mi estado de cuenta», **Then** ve sus cargos, pagos, saldo total pendiente y marcas de vencido.
2. **Given** su estado de cuenta, **When** filtra por año, **Then** ve solo los cargos de ese año.
3. **Given** un pago suyo, **When** descarga el comprobante, **Then** obtiene el PDF; el de otro socio es denegado.
4. **Given** una cuenta de Socio sin registro en el padrón, **When** abre su estado de cuenta, **Then** ve el aviso de que aún no figura en el padrón.
5. **Given** un Socio, **When** intenta abrir pantallas o reportes de tesorería, **Then** el acceso es denegado.

---

### User Story 6 - Llevar inventarios y activos fijos (Priority: P3)

El/la Tesorero/a lleva el inventario de materiales de la junta (cantidad, unidad, mínimo, movimientos de entrada y salida) y el registro de activos fijos (código, nombre, fecha y valor de adquisición, ubicación, estado), con baja con motivo (RF-21, RF-22).

**Why this priority**: Es control patrimonial útil pero independiente del flujo de dinero.

**Independent Test**: Crear un material, registrar entrada y salida, ver el stock y la alerta de mínimo; registrar un activo, editarlo y darlo de baja con motivo.

**Acceptance Scenarios**:

1. **Given** un Tesorero/a, **When** registra un material con nombre, unidad, stock inicial y mínimo, **Then** aparece en el inventario.
2. **Given** un material, **When** registra una entrada o salida con cantidad y motivo, **Then** el stock se actualiza y el movimiento queda en su historial.
3. **Given** una salida mayor al stock disponible, **When** intenta guardarla, **Then** el sistema la rechaza indicando el stock.
4. **Given** un material con stock igual o menor al mínimo, **When** abre el inventario, **Then** lo ve marcado como bajo.
5. **Given** un activo fijo, **When** lo registra con código único por junta, nombre, fecha y valor de adquisición, ubicación y estado, **Then** aparece en el registro de activos y puede editarlo.
6. **Given** un activo, **When** lo da de baja con motivo, **Then** deja de contar como activo vigente pero se conserva en el historial.

---

### Edge Cases

- Pago con monto cero, negativo o con más de 2 decimales: se rechaza.
- Dos pagos simultáneos sobre el mismo cargo que juntos superan el saldo: el segundo se rechaza; el saldo nunca queda negativo.
- Consecutivo de comprobantes: sin saltos ni repeticiones dentro de una junta, incluso con registros simultáneos; un comprobante anulado conserva su número.
- Emisión masiva con socios inactivos: no reciben cargo; un socio que ingresó después del año del cargo no se incluye salvo que se elija explícitamente.
- Cambiar el monto por defecto de un concepto: no altera cargos ya emitidos.
- Concepto con cargos emitidos: no se elimina, se desactiva; no admite nuevas emisiones.
- Multa de un evento que luego se anula: la multa pendiente queda anulada automáticamente con ese motivo; si ya tenía pagos, se avisa al Tesorero/a para que decida.
- Asistencia corregida después de generar multas (de ausente a presente): la multa no se elimina sola; el Tesorero/a la anula con motivo.
- Socio dado de baja con deuda: su deuda se conserva y sigue en los reportes.
- Egreso o pago con fecha futura: se rechaza.
- Reporte sin movimientos en el rango: se muestra un estado vacío con totales en cero.
- Un usuario de una junta intenta abrir un cargo, pago, comprobante o egreso de otra junta: acceso denegado sin revelar si existe.
- Montos expresados en dólares con 2 decimales; sin errores de redondeo en sumas y saldos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El Tesorero/a MUST poder crear, editar y desactivar conceptos de cobro con nombre, tipo, monto por defecto y estado (RF-13).
- **FR-002**: El Tesorero/a MUST poder emitir cargos por año y concepto a todos los socios activos, a un sector o a un socio, con fecha de vencimiento, sin duplicar cargos del mismo socio, año y concepto.
- **FR-003**: El Tesorero/a MUST poder registrar pagos totales o parciales sobre un cargo con monto, fecha y forma de pago, sin superar el saldo (RF-13).
- **FR-004**: El sistema MUST mantener las cuentas por cobrar con saldo, estado (pendiente, parcial, pagado, anulado) y marca de vencido, filtrables por año, concepto, sector, estado y socio (RF-14).
- **FR-005**: El sistema MUST emitir un comprobante por cada pago con numeración consecutiva propia de cada junta, sin saltos ni repeticiones, y permitir su descarga en PDF (RF-20).
- **FR-006**: El Tesorero/a MUST poder anular pagos, cargos y multas con motivo obligatorio; el sistema MUST NOT borrar físicamente registros financieros, y la anulación restituye el saldo correspondiente.
- **FR-007**: El Tesorero/a MUST poder generar las multas de un evento con asistencia guardada: un cargo por cada ausente injustificado con el monto configurado para el tipo de evento, sin duplicar (RF-15).
- **FR-008**: El sistema MUST rechazar la generación de multas para eventos sin asistencia guardada, anulados o futuros, y cuando la multa configurada sea cero.
- **FR-009**: El Tesorero/a MUST poder registrar egresos con fecha, categoría (compras, trabajos, honorarios, tasas, otros), descripción, beneficiario, monto y respaldo opcional, y anularlos con motivo (RF-16).
- **FR-010**: El sistema MUST validar los respaldos por tipo (PDF o imagen) y tamaño máximo, y servirlos solo a usuarios autorizados de la misma junta.
- **FR-011**: El sistema MUST mostrar el resumen financiero por año y rango de fechas: ingresos cobrados, egresos, saldo de caja y total por cobrar, excluyendo movimientos anulados (RF-24).
- **FR-012**: El sistema MUST ofrecer reportes de libro de ingresos, libro de egresos, cuentas por cobrar y estado de caja, descargables en PDF y en CSV con los mismos totales (RF-24).
- **FR-013**: El Tesorero/a MUST poder gestionar un inventario de materiales con stock, unidad, mínimo y movimientos de entrada y salida con motivo, sin permitir stock negativo, y ver alertas de stock bajo (RF-21).
- **FR-014**: El Tesorero/a MUST poder gestionar activos fijos con código único por junta, nombre, fecha y valor de adquisición, ubicación y estado, y darlos de baja con motivo (RF-22).
- **FR-015**: El Socio MUST poder consultar únicamente su propio estado de cuenta con cargos, pagos, saldo y vencidos, y descargar sus propios comprobantes.
- **FR-016**: El sistema MUST aplicar permisos por rol: el Tesorero/a es el único que registra y modifica datos financieros; el Administrador de la Junta consulta y descarga reportes; el Secretario/a no accede a datos financieros salvo su propia asistencia; el Socio ve solo lo suyo.
- **FR-017**: El sistema MUST registrar auditoría de toda operación financiera (conceptos, cargos, pagos, multas, egresos, comprobantes, inventarios, activos y anulaciones) con usuario, junta, fecha y valores previos y nuevos.
- **FR-018**: El sistema MUST aislar completamente los datos de cada junta y MUST impedir que un usuario de una junta acceda a registros de otra.
- **FR-019**: El sistema MUST manejar importes en dólares con 2 decimales sin errores de redondeo y rechazar montos no positivos en pagos, cargos y egresos.
- **FR-020**: El sistema MUST aportar al panel del Super Administrador, solo como cifras agregadas, el número de pagos registrados de cada junta, sin exponer montos ni datos internos.
- **FR-021**: La interfaz MUST estar en español, ser responsiva y cumplir las pautas de accesibilidad del proyecto.

### Key Entities *(include if feature involves data)*

- **Concepto de cobro**: tipo de cobro de la junta; nombre, tipo, monto por defecto, estado.
- **Cargo (cuenta por cobrar)**: deuda de un socio por concepto y año; monto, vencimiento, saldo, estado, origen (cuota, servicio o multa) y, si es multa, el evento que la originó.
- **Pago**: abono sobre un cargo; monto, fecha, forma de pago, estado (vigente o anulado), motivo de anulación y quién lo registró.
- **Comprobante**: documento numerado emitido por cada pago, con consecutivo propio de la junta.
- **Egreso**: salida de dinero; fecha, categoría, descripción, beneficiario, monto, respaldo, estado y motivo de anulación.
- **Material e inventario**: artículo de la junta con unidad, stock y mínimo; sus **movimientos** de entrada o salida con cantidad, motivo y autor.
- **Activo fijo**: bien de la junta con código, nombre, fecha y valor de adquisición, ubicación, estado y motivo de baja.
- **Registro de auditoría**: ya existente; ahora recibe las operaciones financieras.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un Tesorero/a registra un pago y obtiene su comprobante en menos de 1 minuto.
- **SC-002**: Un Tesorero/a emite los cargos anuales de una junta de 500 socios en menos de 2 minutos.
- **SC-003**: Un Tesorero/a genera las multas de una asamblea de 100 socios en menos de 1 minuto.
- **SC-004**: El 100 % de los pagos que superan el saldo y de los montos inválidos es rechazado, y el 100 % de las operaciones financieras queda auditado.
- **SC-005**: Los totales de los reportes y del resumen coinciden al centavo con la suma de los movimientos vigentes en el 100 % de las pruebas.
- **SC-006**: En el 100 % de las pruebas, un usuario de una junta no accede a cargos, pagos, comprobantes, egresos, inventarios ni activos de otra junta, y un Socio no accede a datos de otro socio.
- **SC-007**: La numeración de comprobantes de una junta no presenta saltos ni repeticiones en pruebas con registros simultáneos.
- **SC-008**: Un Socio localiza su saldo pendiente y descarga un comprobante en menos de 1 minuto desde que inicia sesión.
- **SC-009**: Al menos el 90 % de los Tesoreros/as de prueba completa su primera tarea (registrar un pago, un egreso o generar multas) sin ayuda.

## Assumptions

- Este módulo cubre RF-13 al RF-16, RF-20 al RF-22 y RF-24 y el estado de cuenta del Socio; las cuentas por cobrar se tratan como RF-14. Convocatorias, actas y mensajería quedan para Comunicaciones.
- El Tesorero/a es el único rol que escribe datos financieros. El Administrador de la Junta consulta y descarga reportes; el Secretario/a no accede a esta información.
- Los montos de multa por inasistencia y los parámetros de la junta ya existen en su configuración; este módulo los reutiliza y no los modifica.
- Las multas se generan a petición del Tesorero/a, no automáticamente al guardar la asistencia.
- Los pagos se registran de forma manual (efectivo, transferencia o depósito); no hay pasarela de pago en línea ni facturación electrónica del SRI. El comprobante es un recibo interno de la junta, no un documento tributario.
- Todos los importes están en dólares estadounidenses con 2 decimales.
- Un cargo vence en la fecha que el Tesorero/a indique al emitirlo; sin fecha, no se considera vencido.
- No hay intereses por mora ni recargos automáticos en esta versión.
- Los respaldos de egresos se limitan a PDF o imagen común y a 5 MB.
- La fecha de un pago o egreso no puede ser futura.
- Los reportes se descargan en PDF y CSV; no se envían por correo en esta versión.
- La interfaz parte de los mockups del equipo y sigue el estilo del módulo Administrativo; las diferencias se justificarán en el plan.
