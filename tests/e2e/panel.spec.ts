import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

// Requiere la app en marcha y el seed del Super Administrador (ver quickstart.md).
const correo = process.env.E2E_SUPERADMIN_CORREO ?? "";
const password = process.env.E2E_SUPERADMIN_PASSWORD ?? "";

async function ingresar(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/Correo electrónico o número de cédula/).fill(correo);
  await page.getByLabel(/^Contraseña/).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/panel/);
}

test.describe("panel del Super Administrador", () => {
  test.skip(!correo || !password, "Defina E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD");

  test("muestra totales coherentes, calendario navegable y descarga el reporte", async ({ page }) => {
    await ingresar(page);

    await expect(page.getByRole("heading", { name: "Panel de Control Territorial" })).toBeVisible();
    const total = Number(await page.getByTestId("total-juntas").innerText());
    expect(total).toBeGreaterThanOrEqual(2); // las del seed

    // el total del panel coincide con el listado
    await page.goto("/juntas");
    await expect(page.getByText(new RegExp(`^${total} organizaciones registradas$`))).toBeVisible();
    await page.goto("/panel");

    // calendario: mes actual y navegación
    const titulo = page.locator("#cal-titulo");
    const actual = ((await titulo.textContent()) ?? "").trim();
    await page.getByRole("link", { name: "Mes siguiente" }).click();
    await expect(page).toHaveURL(/mes=\d{4}-\d{2}/);
    await expect(titulo).not.toHaveText(actual);
    await page.getByRole("link", { name: "Hoy" }).click();
    await expect(titulo).toHaveText(actual);
    await expect(page.getByText("No hay eventos registrados en este mes.")).toBeVisible();

    // un parámetro de mes inválido no rompe la pantalla
    await page.goto("/panel?mes=no-valido");
    await expect(page.getByRole("heading", { name: "Panel de Control Territorial" })).toBeVisible();

    // descarga del reporte
    const [descarga] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Descargar reporte" }).click(),
    ]);
    expect(descarga.suggestedFilename()).toMatch(/^plataforma-\d{4}-\d{2}-\d{2}\.csv$/);
    const ruta = await descarga.path();
    const contenido = await readFile(ruta, "utf8");
    expect(contenido).toContain(`Total de juntas,${total}`);
    expect(contenido).toContain("Nombre,Identificador,Tipo");
  });

  test("el reporte exige sesión de Super Administrador", async ({ request }) => {
    const r = await request.get("/api/reportes/plataforma.csv", { maxRedirects: 0 });
    expect([401, 403, 307]).toContain(r.status());
  });
});
