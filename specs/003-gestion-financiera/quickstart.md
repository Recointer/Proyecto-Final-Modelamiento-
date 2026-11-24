# Quickstart: Gestión Financiera

1. Base de datos y migraciones: `docker compose up -d` y `npm run db:migrate` (aplica 0008 y 0009).
2. Arranque local: `npm run dev`. Ingrese como Tesorero/a de una junta con socios y asistencia ya registrados.
3. Flujo de prueba manual:
   1. `/finanzas/conceptos` → crear «Cuota anual de riego» con monto 24,00.
   2. `/finanzas/cobros` → «Emitir cargos» del año actual a todos los socios activos.
   3. Abrir un cargo → registrar un pago parcial de 10,00 y luego de 14,00; descargar el comprobante.
   4. `/finanzas/multas` → elegir una asamblea con asistencia → «Generar multas».
   5. `/finanzas/egresos` → registrar un egreso con respaldo PDF.
   6. `/finanzas` → comprobar ingresos, egresos, caja y por cobrar; `/finanzas/reportes` → descargar PDF y CSV.
   7. Ingresar como Socio → `/mi/estado-de-cuenta`.
4. Pruebas: `npx vitest run` y `node scripts/e2e.mjs`.
