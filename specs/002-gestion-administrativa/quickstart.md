# Quickstart: validar la Gestión Administrativa

## Prerrequisitos

- Módulo 1 funcionando (ver [quickstart del módulo 1](../001-gestion-plataforma/quickstart.md)).
- Una junta con **Administrador** y al menos **dos sectores** configurados.
- Cuentas de la junta con rol **Secretario/a**, **Tesorero/a** y **Socio** (creadas por el Administrador).
- (Opcional) `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` en `.env`, restringida por referente HTTP; sin ella el
  mapa se sustituye por la lista de predios.

## Preparación

```powershell
npm install               # incluye pdf-lib
npm run db:migrate        # migración 0005: tablas, RLS, btree_gist y funciones agregadas
npm run dev
```

## Escenarios de validación

1. **Nómina (US1).** Como Secretario/a, en «Socios» registre dos socios: cédula inválida y duplicada se
   rechazan. Busque por nombre o cédula, filtre por sector y estado, edite y marque a uno inactivo.
2. **Asistencia (US2).** En «Eventos» cree una asamblea con fecha de hoy. Abra «Asistencia»: marque
   todos, ponga a uno ausente con motivo (justificado), guarde y compruebe contadores, porcentaje y
   quórum. Reabra, corrija, y confirme que un evento con fecha futura no admite asistencia y que uno
   anulado deja de contar.
3. **Predios y mapa (US3).** Registre un predio con coordenadas e imagen; vea el mapa, filtre por sector
   y abra su ficha. Repita sin clave de Maps: debe aparecer la lista con coordenadas y el aviso. Un
   código repetido o una latitud fuera de rango se rechazan.
4. **Calendario (US4).** Cree un servicio, agregue turnos por sector; uno con fin ≤ inicio y uno
   solapado se rechazan; un turno contiguo es válido.
5. **Socio (US5).** Inicie sesión como el Socio (cédula igual a la del padrón): vea su ficha, sus predios
   (solo los suyos), el calendario de su sector y su historial con porcentaje; descargue el PDF.
   Una cuenta cuya cédula no está en el padrón ve el aviso correspondiente.
6. **Panel de plataforma.** Como Super Administrador, el total de eventos y el calendario del panel
   reflejan los eventos activos como cifras («N eventos»), sin títulos ni datos de las juntas.
7. **Aislamiento.** Con dos juntas, ningún usuario de una ve socios, eventos, predios, imágenes ni
   turnos de la otra; un Socio no ve datos de otro socio de su propia junta.

## Pruebas automatizadas

```powershell
npm test                    # unitarias (cumplimiento, coordenadas, cargador de mapas, validaciones)
npm run test:integration    # servicios + RLS + FK compuestas + exclusión de turnos + funciones agregadas
npm run test:e2e            # flujos de usuario y auditoría de accesibilidad
npm run typecheck; npm run lint
npm run db:limpiar-e2e      # limpia los datos que dejan las pruebas E2E
```

Resultado esperado: todo en verde. Las pruebas de aislamiento deben demostrar que una referencia
cruzada entre juntas falla en la base de datos y que el Super Administrador solo obtiene cifras
agregadas.

Contratos: [contracts/administrativo-actions.md](contracts/administrativo-actions.md). Modelo:
[data-model.md](data-model.md). Decisiones: [research.md](research.md).
