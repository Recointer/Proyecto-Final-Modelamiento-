import { expect, test, type Page } from "@playwright/test";

// Requiere la app en marcha y el seed del Super Administrador (ver quickstart.md).
const correo = process.env.E2E_SUPERADMIN_CORREO ?? "";
const password = process.env.E2E_SUPERADMIN_PASSWORD ?? "";

async function ingresar(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/Correo electrónico o número de cédula/).fill(correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/panel/);
}

test.describe("administrar juntas (RF-01)", () => {
  test.skip(!correo || !password, "Defina E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD");

  test("registrar, buscar, editar y desactivar una junta", async ({ page }) => {
    const sufijo = Date.now().toString(36);
    const nombre = `Junta E2E ${sufijo}`;
    await ingresar(page);

    await page.goto("/juntas/nueva");
    await page.getByLabel(/Nombre de la junta/).fill(nombre);
    await page.getByLabel(/Provincia/).fill("Tungurahua");
    await page.getByLabel(/Cantón/).fill("Ambato");
    await page.getByLabel(/Parroquia/).fill(`Parroquia ${sufijo}`);
    await page.getByRole("button", { name: "Registrar junta" }).click();
    await expect(page.getByText("Junta registrada correctamente.")).toBeVisible();

    // duplicado
    await page.goto("/juntas/nueva");
    await page.getByLabel(/Nombre de la junta/).fill(nombre);
    await page.getByLabel(/Provincia/).fill("Tungurahua");
    await page.getByLabel(/Cantón/).fill("Ambato");
    await page.getByLabel(/Parroquia/).fill(`Parroquia ${sufijo}`);
    await page.getByRole("button", { name: "Registrar junta" }).click();
    await expect(page.getByRole("alert")).toContainText("Ya existe una junta");

    // búsqueda en el listado
    await page.goto(`/juntas?busqueda=${encodeURIComponent(nombre)}`);
    await expect(page.getByText("1 organización registrada")).toBeVisible();
    await page.getByRole("link", { name: /Ver y editar/ }).click();

    // edición
    await page.getByLabel(/Nombre de la junta/).fill(`${nombre} editada`);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();

    // desactivación con confirmación
    await page.getByRole("button", { name: "Desactivar junta" }).click();
    await page.getByRole("button", { name: "Sí, desactivar" }).click();
    await expect(page.getByText(/Junta desactivada/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Reactivar junta" })).toBeVisible();
  });

  test("un usuario sin sesión no accede al listado", async ({ page }) => {
    await page.goto("/juntas");
    await expect(page).toHaveURL(/\/login/);
  });
});
