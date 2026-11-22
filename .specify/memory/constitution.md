<!--
Sync Impact Report
- Version change: (plantilla sin ratificar) → 1.0.0
- Principios modificados: ninguno renombrado; los 5 slots de la plantilla se ampliaron a 7 principios
- Secciones añadidas: Restricciones Técnicas y de Seguridad; Flujo de Desarrollo y Puertas de Calidad
- Secciones eliminadas: ninguna
- TODOs diferidos: ninguno
-->
# Sistema Multi-Junta de Gestión Integral Constitution

## Core Principles

### I. Aislamiento Estricto entre Juntas (NON-NEGOTIABLE)
Ninguna junta MUST poder leer, modificar ni inferir datos de otra junta. Toda tabla con datos de una
junta MUST incluir `tenant_id` y estar protegida con Row Level Security en PostgreSQL; el aislamiento
MUST NOT depender únicamente de filtros en el código de la aplicación. Solo el Super Administrador
opera a nivel plataforma, y únicamente sobre datos de alta y configuración de juntas.
Justificación: es la promesa central de un sistema multi-tenant con datos financieros y personales.

### II. Control de Acceso por Roles
El sistema MUST reconocer exactamente cinco roles: Super Administrador, Administrador de la Junta,
Secretario/a, Tesorero/a y Miembro/Socio. Cada operación MUST validar el rol en el servidor, nunca
solo en la interfaz. Las responsabilidades de cada rol MUST seguir el documento del proyecto
(p. ej., solo Tesorería registra ingresos y egresos; solo Secretaría registra asistencia y actas).
Un socio MUST acceder únicamente a su propia información y a la publicada para su junta.

### III. Desarrollo Guiado por Especificación
Todo cambio MUST originarse en la especificación (`/speckit-specify`), seguir con plan, tareas e
implementación. Los requerimientos RF-01 a RF-33 MUST ser trazables: cada historia de usuario,
tarea y prueba MUST citar los RF que cubre. No se implementa funcionalidad sin RF o historia que la
respalde.

### IV. Seguridad y Auditoría
Las contraseñas MUST almacenarse con hash seguro (p. ej., argon2 o bcrypt) y nunca en texto plano ni
en logs. La cédula ecuatoriana MUST validarse (longitud y dígito verificador) en todo registro. Toda
operación financiera (ingresos, egresos, multas, comprobantes) MUST dejar registro de auditoría con
usuario, junta, fecha y valores previos y nuevos; los registros financieros MUST NOT borrarse
físicamente, solo anularse con justificación. Secretos y llaves de API MUST residir en variables de
entorno.

### V. Pruebas de Reglas de Negocio
Las reglas de multas por inasistencia, asistencia (quórum) y finanzas, y el aislamiento
multi-tenant, MUST tener pruebas automatizadas que pasen antes de integrar cambios. Toda
corrección de errores MUST incluir una prueba que la reproduzca. Las pruebas de aislamiento MUST
verificar que un usuario de la junta A no obtiene datos de la junta B.

### VI. Interfaz en Español, Responsiva y Accesible
Toda la interfaz y los mensajes MUST estar en español. Las pantallas MUST funcionar en móvil y
escritorio y cumplir WCAG 2.1 AA en lo básico (contraste, etiquetas, navegación por teclado). El
diseño MUST partir de los mockups del equipo; las diferencias respecto a ellos MUST justificarse en
la especificación.

### VII. Simplicidad
Se MUST preferir la solución más simple que cumpla los RF (YAGNI). No se añaden capas, servicios ni
dependencias sin necesidad demostrada; cualquier complejidad añadida MUST justificarse en el plan.
Se prefiere un único monolito Next.js sobre microservicios.

## Restricciones Técnicas y de Seguridad

- Stack: Next.js con TypeScript (modo estricto), PostgreSQL con RLS por `tenant_id`, Google Maps
  API para ubicación de predios y recursos.
- Las llaves de Google Maps MUST restringirse por dominio y no exponerse con permisos excesivos.
- Los archivos subidos (actas, convocatorias, comprobantes, justificativos) MUST validarse por tipo
  (PDF/imagen) y tamaño máximo.
- Datos personales de socios (cédula, teléfono, correo) MUST tratarse conforme a la normativa
  ecuatoriana de protección de datos personales y mostrarse solo a roles autorizados.
- Los esquemas de base de datos MUST evolucionar mediante migraciones versionadas.

## Flujo de Desarrollo y Puertas de Calidad

- Orden de trabajo: constitución → especificación → aclaración → plan → tareas → implementación.
- Una tarea está completa solo cuando su código, sus pruebas y la verificación del RF asociado
  pasan.
- Toda integración MUST ejecutar las pruebas automatizadas y el linter/typecheck sin errores.
- Los cambios a esquema, roles o reglas de aislamiento MUST revisarse explícitamente contra los
  Principios I y II.

## Governance

Esta constitución prevalece sobre otras prácticas del proyecto. Las enmiendas MUST documentarse en
este archivo, con justificación y, si afectan trabajo existente, un plan de migración.

Versionado semántico: MAJOR para eliminar o redefinir principios de forma incompatible; MINOR para
añadir principios o ampliar guía de forma material; PATCH para aclaraciones y correcciones de
redacción.

Cumplimiento: toda revisión de plan y de código MUST verificar conformidad con los principios; las
violaciones MUST resolverse o justificarse por escrito en la sección de complejidad del plan.

**Version**: 1.0.0 | **Ratified**: 2026-11-21 | **Last Amended**: 2026-11-21
