import { expect, test, type Page } from "@playwright/test";
import { hoyEcuador } from "../../src/lib/fechas";
import {
  CEDULA_ADMIN,
  CEDULA_SECRETARIO,
  CEDULA_TESORERO,
  crearCuentaYEntrar,
  crearJuntaConAdmin,
  crearSectorUI,
  crearSocioUI,
  entrarComo,
  PASSWORD_ADMIN,
  PDF,
  SUPER_CORREO,
  SUPER_PASSWORD,
} from "./helpers";

// Requiere la app en marcha y el seed del Super Administrador (ver quickstart.md).
const ANA = { cedula: "1710000033", nombres: "Ana Torres" };
const BETO = { cedula: "1710000041", nombres: "Beto Pérez" };

async function asambleaConAusente(page: Page, ausente: string) {
  await page.goto("/eventos/nuevo");
  await page.getByLabel(/^Tipo/).selectOption({ label: "Asamblea" });
  await page.getByLabel(/^Título/).fill("Asamblea general");
  await page.getByLabel(/^Fecha/).fill(hoyEcuador());
  await page.getByLabel(/^Lugar/).fill("Casa comunal");
  await page.getByRole("button", { name: "Guardar evento" }).click();
  await expect(page.getByText("Evento registrado correctamente.")).toBeVisible();
  await page.getByRole("link", { name: "Tomar asistencia" }).click();
  await page.getByRole("button", { name: /Marcar todos presentes/ }).click();
  await page.getByRole("group", { name: new RegExp(`Asistencia de ${ausente}`) }).getByText("Ausente", { exact: true }).click();
  await page.getByRole("button", { name: "Guardar asistencia" }).click();
  await expect(page.getByText(/Asistencia guardada/)).toBeVisible();
}

test.describe("gestión financiera (RF-13 a RF-16, RF-20, RF-24)", () => {
  test.skip(!SUPER_CORREO || !SUPER_PASSWORD, "Defina E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD");
  test.setTimeout(480_000);

  test("el Tesorero/a cobra, multa, registra egresos y emite reportes; el Socio ve lo suyo", async ({ page }) => {
    const sufijo = Date.now().toString(36);
    const { slug } = await crearJuntaConAdmin(page, sufijo);
    await crearSectorUI(page, "Norte");

    // la junta configura la multa por inasistencia a asamblea
    await page.goto("/configuracion");
    await page.getByLabel(/Multa por inasistencia a asamblea/).fill("5");
    await page.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(page.getByText("Configuración guardada.")).toBeVisible();

    // secretaría: dos socios y una asamblea con Beto ausente
    await crearCuentaYEntrar(page, slug, { cedula: CEDULA_SECRETARIO, nombres: "Rosa Secretaria", rol: "secretario", sufijo });
    await crearSocioUI(page, { ...ANA, sector: "Norte" });
    await crearSocioUI(page, { ...BETO, sector: "Norte" });
    await asambleaConAusente(page, "Beto Pérez");
    await page.goto("/finanzas");
    await expect(page).not.toHaveURL(/\/finanzas/); // el Secretario/a no accede a finanzas

    // --- Tesorero/a ---
    await entrarComo(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await crearCuentaYEntrar(page, slug, { cedula: CEDULA_TESORERO, nombres: "Tomás Tesorero", rol: "tesorero", sufijo });
    const menu = page.getByRole("navigation", { name: "Navegación principal" });
    for (const enlace of ["Resumen financiero", "Cuentas por cobrar", "Multas", "Egresos", "Reportes", "Inventario", "Activos fijos"]) {
      await expect(menu.getByRole("link", { name: enlace, exact: true })).toBeVisible();
    }

    // concepto de cobro
    await page.goto("/finanzas/conceptos");
    await page.getByLabel(/^Nombre/).fill("Cuota anual de riego");
    await page.getByLabel(/^Tipo/).selectOption({ label: "Cuota" });
    await page.getByLabel(/^Monto por defecto/).fill("24");
    await page.getByRole("button", { name: "Crear concepto" }).click();
    await expect(page.getByText("Concepto creado.")).toBeVisible();
    await expect(page.getByRole("table", { name: "Conceptos de cobro de la junta" }).getByRole("row", { name: /Cuota anual de riego/ })).toContainText("$ 24,00");

    // emitir los cargos del año a todos los socios; repetir no duplica
    await page.goto("/finanzas/cobros");
    for (const intento of [1, 2]) {
      await page.locator("summary", { hasText: "Emitir cargos" }).click();
      await page.locator("details").getByLabel(/^Concepto/).selectOption({ index: 1 });
      await page.getByRole("button", { name: "Emitir cargos" }).click();
      await expect(page.getByText(intento === 1 ? /Se emitieron 2 cargos de \$ 24\.00/ : /Se emitieron 0 cargos.*2 ya existían/)).toBeVisible();
    }
    const cuentas = page.getByRole("table", { name: "Cuentas por cobrar de la junta" });
    await expect(cuentas.getByRole("row")).toHaveCount(3);

    // pago parcial de Ana y luego el saldo
    await page.getByRole("link", { name: /Cobrar.*Ana Torres/ }).click();
    await page.getByLabel(/^Monto/).fill("10");
    await page.getByRole("button", { name: "Registrar pago" }).click();
    await expect(page.getByText("Pago registrado. Comprobante N.º 000001.")).toBeVisible();
    await expect(page.getByText("Pago parcial")).toBeVisible();
    await expect(page.getByRole("definition").filter({ hasText: "$ 14,00" })).toBeVisible();

    // un pago mayor al saldo se rechaza
    await page.getByLabel(/^Monto/).fill("14,01");
    await page.getByRole("button", { name: "Registrar pago" }).click();
    await expect(page.getByText("El pago supera el saldo pendiente del cargo.")).toBeVisible();

    await page.getByLabel(/^Monto/).fill("14");
    await page.getByLabel(/^Forma de pago/).selectOption({ label: "Transferencia" });
    await page.getByLabel(/^Referencia/).fill("TR-001");
    await page.getByRole("button", { name: "Registrar pago" }).click();
    await expect(page.getByText("Pago registrado. Comprobante N.º 000002.")).toBeVisible();
    await expect(page.getByText("Pagado", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar pago" })).toHaveCount(0);

    // comprobante en PDF
    const enlace = page.getByRole("link", { name: /Comprobante N\.º 1/ });
    const href = await enlace.getAttribute("href");
    const comprobante = await page.request.get(href!);
    expect(comprobante.status()).toBe(200);
    expect(comprobante.headers()["content-type"]).toContain("application/pdf");
    expect((await comprobante.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");

    // multas: solo Beto (ausente injustificado)
    await page.goto("/finanzas/multas");
    await page.getByRole("button", { name: "Generar multas" }).click();
    await page.getByRole("button", { name: "Sí, generar" }).click();
    await expect(page.getByText(/Multas generadas: 1 de \$ 5\.00/)).toBeVisible();
    await page.goto("/finanzas/cobros?busqueda=Beto");
    await expect(page.getByRole("table", { name: "Cuentas por cobrar de la junta" }).getByRole("row", { name: /Multa por inasistencia a asamblea/ })).toBeVisible();

    // egreso con respaldo
    await page.goto("/finanzas/egresos");
    await page.locator("summary", { hasText: "Registrar egreso" }).click();
    await page.locator("details").getByLabel(/^Categoría/).selectOption({ label: "Compras" });
    await page.locator("details").getByLabel(/^Descripción/).fill("Compra de tubería PVC");
    await page.locator("details").getByLabel(/^Beneficiario/).fill("Ferretería Central");
    await page.locator("details").getByLabel(/^Monto/).fill("40");
    await page.locator("details").getByLabel(/^Respaldo/).setInputFiles({ name: "factura.pdf", mimeType: "application/pdf", buffer: PDF });
    await page.getByRole("button", { name: "Registrar egreso" }).click();
    await expect(page.getByText("Egreso registrado.")).toBeVisible();
    const filaEgreso = page.getByRole("table", { name: "Libro de egresos de la junta" }).getByRole("row", { name: /Compra de tubería PVC/ });
    await expect(filaEgreso).toContainText("$ 40,00");
    const respaldo = await page.request.get((await filaEgreso.getByRole("link", { name: /Respaldo/ }).getAttribute("href"))!);
    expect(respaldo.status()).toBe(200);

    // resumen: ingresos 24, egresos 40, caja −16, por cobrar 29 (24 de Beto + 5 de multa)
    await page.goto("/finanzas");
    await expect(page.getByText("-$ 16,00")).toBeVisible();
    await expect(page.getByText("$ 29,00")).toBeVisible();
    await expect(page.getByText("2 pagos")).toBeVisible();

    // reportes en CSV y PDF con los mismos totales
    const csv = await page.request.get("/api/finanzas/reportes/ingresos?formato=csv");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain("24.00");
    const pdf = await page.request.get("/api/finanzas/reportes/caja?formato=pdf");
    expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect((await page.request.get("/api/finanzas/reportes/inexistente")).status()).toBe(404);

    // --- Administrador de la Junta: ve el resumen y los reportes, pero no opera ---
    await entrarComo(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await page.goto("/finanzas");
    await expect(page.getByRole("heading", { name: "Resumen financiero" })).toBeVisible();
    await page.goto("/finanzas/reportes");
    await expect(page.getByRole("heading", { name: "Reportes financieros" })).toBeVisible();
    await page.goto("/finanzas/cobros");
    await expect(page).toHaveURL(/\/configuracion/);
    expect((await page.request.get("/api/finanzas/reportes/caja?formato=csv")).status()).toBe(200);

    // --- Socio: solo lo suyo ---
    await crearCuentaYEntrar(page, slug, { cedula: ANA.cedula, nombres: ANA.nombres, rol: "socio", sufijo });
    await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Mi estado de cuenta" }).click();
    await expect(page.getByRole("heading", { name: "Mi estado de cuenta" })).toBeVisible();
    await expect(page.getByTestId("total-pendiente")).toHaveText("$ 0,00");
    const estado = page.getByRole("table", { name: "Cargos y pagos del socio" });
    await expect(estado.getByRole("row", { name: /Cuota anual de riego/ })).toContainText("Pagado");
    await expect(estado.getByText("Multa por inasistencia")).toHaveCount(0);
    const mio = await page.request.get((await estado.getByRole("link", { name: /N\.º 000001/ }).getAttribute("href"))!);
    expect(mio.status()).toBe(200);
    expect((await mio.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // el Socio no entra a tesorería ni a sus descargas
    expect((await page.request.get(href!)).status()).toBe(403);
    expect((await page.request.get("/api/finanzas/reportes/caja?formato=csv")).status()).toBe(403);
    await page.goto("/finanzas/cobros");
    await expect(page).not.toHaveURL(/\/finanzas/);

    // sin sesión, 401
    await page.context().clearCookies();
    expect((await page.request.get(href!)).status()).toBe(401);
    expect((await page.request.get("/api/mi/comprobantes/00000000-0000-4000-8000-000000000000")).status()).toBe(401);
  });
});
