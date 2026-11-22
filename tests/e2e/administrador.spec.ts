import { expect, test, type Page } from "@playwright/test";

// Requiere la app en marcha y el seed del Super Administrador (ver quickstart.md).
const correo = process.env.E2E_SUPERADMIN_CORREO ?? "";
const password = process.env.E2E_SUPERADMIN_PASSWORD ?? "";

const CEDULA_ADMIN = "1713175071"; // cédula válida de prueba
const CEDULA_NUEVO = "0926687856";

const PDF = Buffer.from("%PDF-1.4\n% acta de prueba\n");

async function ingresarComoSuper(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/Correo electrónico o número de cédula/).fill(correo);
  await page.getByLabel(/^Contraseña/).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/panel/);
}

test.describe("asignar y cambiar administrador (RF-04)", () => {
  test.skip(!correo || !password, "Defina E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD");

  test("asigna un administrador, este ingresa y crea su contraseña; luego se cambia", async ({ page }) => {
    const sufijo = Date.now().toString(36);
    const nombre = `Junta Admin ${sufijo}`;
    await ingresarComoSuper(page);

    // junta nueva
    await page.goto("/juntas/nueva");
    await page.getByLabel(/Nombre de la junta/).fill(nombre);
    await page.getByLabel(/Provincia/).fill("Tungurahua");
    await page.getByLabel(/Cantón/).fill("Ambato");
    await page.getByLabel(/Parroquia/).fill(`Parroquia ${sufijo}`);
    await page.getByRole("button", { name: "Registrar junta" }).click();
    await expect(page.getByText("Junta registrada correctamente.")).toBeVisible();
    const slug = (await page.locator("code").first().innerText()).trim();

    // cédula inválida
    await page.getByRole("link", { name: "Gestionar administrador" }).click();
    await page.getByLabel(/Cédula del nuevo administrador/).fill("1234567890");
    await page.getByLabel(/Nombres completos/).fill("María Fernanda Quishpe");
    await page.getByLabel(/Correo electrónico/).fill(`maria.${sufijo}@correo.com`);
    await page.getByLabel(/Acta de designación/).setInputFiles({ name: "acta.pdf", mimeType: "application/pdf", buffer: PDF });
    await page.getByRole("button", { name: /Validar y asignar/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "La cédula no es válida" })).toBeVisible();

    // acta que no es PDF ni imagen
    await page.getByLabel(/Cédula del nuevo administrador/).fill(CEDULA_ADMIN);
    await page.getByLabel(/Acta de designación/).setInputFiles({ name: "nota.txt", mimeType: "text/plain", buffer: Buffer.from("hola") });
    await page.getByRole("button", { name: /Validar y asignar/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "PDF o imagen" })).toBeVisible();

    // asignación válida
    await page.getByLabel(/Cédula del nuevo administrador/).fill(CEDULA_ADMIN);
    await page.getByLabel(/Acta de designación/).setInputFiles({ name: "acta.pdf", mimeType: "application/pdf", buffer: PDF });
    await page.getByRole("button", { name: /Validar y asignar/ }).click();
    await expect(page.getByText("Administrador asignado.")).toBeVisible();
    const credencial = (await page.getByTestId("credencial").innerText()).trim();
    expect(credencial.length).toBeGreaterThanOrEqual(10);

    // el administrador ingresa con la contraseña inicial y debe crear la suya
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await page.goto("/login");
    await page.getByLabel(/Identificador de junta/).fill(slug);
    await page.getByLabel(/Correo electrónico o número de cédula/).fill(CEDULA_ADMIN);
    await page.getByLabel(/^Contraseña/).fill(credencial);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/cambiar-password/);
    await page.getByLabel(/^Nueva contraseña/).fill("ClavePropia2026");
    await page.getByLabel(/^Confirmar contraseña/).fill("ClavePropia2026");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page).toHaveURL(/\/configuracion/);
    // un administrador de junta no accede a las pantallas de plataforma
    await page.goto("/juntas");
    await expect(page).not.toHaveURL(/\/juntas$/);
    await page.getByRole("button", { name: "Cerrar sesión" }).click();

    // el Super Administrador cambia al administrador
    await ingresarComoSuper(page);
    await page.goto("/juntas");
    await page.getByLabel(/Buscar por nombre/).fill(nombre);
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("link", { name: /Ver y editar/ }).click();
    await page.getByRole("link", { name: "Gestionar administrador" }).click();
    await expect(page.getByText("Vigente")).toBeVisible();
    await page.getByLabel(/Cédula del nuevo administrador/).fill(CEDULA_NUEVO);
    await page.getByLabel(/Nombres completos/).fill("Luis Alberto Tapia");
    await page.getByLabel(/Correo electrónico/).fill(`luis.${sufijo}@correo.com`);
    await page.getByLabel(/Motivo del cambio/).fill("Renuncia del administrador");
    await page.getByLabel(/Acta de designación/).setInputFiles({ name: "acta.pdf", mimeType: "application/pdf", buffer: PDF });
    await page.getByRole("button", { name: /Solicitar cambio/ }).click();
    await expect(page.getByText("Administrador cambiado.")).toBeVisible();
  });
});
