# Contratos: pantallas y rutas

## Pantallas (todas en español, responsivas)
| Ruta | Roles | Contenido |
|------|-------|-----------|
| `/finanzas` | tesorero, admin_junta | Resumen: ingresos, egresos, caja, por cobrar; filtro por año y fechas |
| `/finanzas/conceptos` | tesorero | Conceptos de cobro (crear, editar, desactivar) |
| `/finanzas/cobros` | tesorero | Cuentas por cobrar con filtros; emitir cargos |
| `/finanzas/cobros/[id]` | tesorero | Cargo, pagos, registrar pago, anular pago/cargo |
| `/finanzas/multas` | tesorero | Eventos con asistencia; generar multas |
| `/finanzas/egresos` | tesorero | Libro de egresos, registrar y anular |
| `/finanzas/reportes` | tesorero, admin_junta | Reportes y descargas |
| `/finanzas/inventario` | tesorero | Materiales y movimientos |
| `/finanzas/activos` | tesorero | Activos fijos |
| `/mi/estado-de-cuenta` | socio | Cargos, pagos, saldo, comprobantes |

## Rutas de descarga
| Ruta | Respuesta |
|------|-----------|
| `GET /api/comprobantes/[id]` | PDF del comprobante (tesorero, admin_junta). 401 sin sesión, 403 sin rol, 404 si no existe o es de otra junta |
| `GET /api/mi/comprobantes/[id]` | PDF del comprobante solo si el pago es del socio de la sesión |
| `GET /api/egresos/[id]/respaldo` | Archivo de respaldo (tesorero, admin_junta) |
| `GET /api/finanzas/reportes/[tipo]?formato=pdf\|csv&anio&desde&hasta` | `ingresos`, `egresos`, `por-cobrar`, `caja` (tesorero, admin_junta) |

Todas con `Cache-Control: no-store`.

## Acciones de servidor (resultado `Result<T>`)
Conceptos: crear, editar, desactivar, reactivar. Cargos: emitir, anular. Pagos: registrar, anular.
Multas: generar. Egresos: registrar, anular. Inventario: crear material, editar, registrar movimiento.
Activos: crear, editar, dar de baja.

## Códigos de error nuevos
`CONCEPTO_NO_ENCONTRADO`, `CONCEPTO_DUPLICADO`, `CONCEPTO_INACTIVO`, `CARGO_NO_ENCONTRADO`, `CARGO_ANULADO`,
`CARGO_CON_PAGOS`, `PAGO_EXCEDE_SALDO`, `PAGO_NO_ENCONTRADO`, `PAGO_ANULADO`, `MONTO_INVALIDO`, `MULTA_NO_CONFIGURADA`,
`EVENTO_SIN_ASISTENCIA`, `EGRESO_NO_ENCONTRADO`, `EGRESO_ANULADO`, `RESPALDO_INVALIDO`, `MATERIAL_NO_ENCONTRADO`,
`MATERIAL_DUPLICADO`, `STOCK_INSUFICIENTE`, `ACTIVO_NO_ENCONTRADO`, `ACTIVO_DUPLICADO`, `ACTIVO_EN_BAJA`.
