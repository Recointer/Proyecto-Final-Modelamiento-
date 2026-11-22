import { expect, type Page } from "@playwright/test";

export const SUPER_CORREO = process.env.E2E_SUPERADMIN_CORREO ?? "";
export const SUPER_PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD ?? "";
export const PDF = Buffer.from("%PDF-1.4\n% acta de prueba\n");

/** Cédula válida usada como administrador de las juntas de prueba (única por junta). */
export const CEDULA_ADMIN = "1713175071";
export const PASSWORD_ADMIN = "ClavePropia2026";

export async function ingresarComoSuper(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/Correo electrónico o número de cédula/).fill(SUPER_CORREO);
  await page.getByLabel(/^Contraseña/).fill(SUPER_PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/panel/);
}

/**
 * Como Super Administrador crea una junta nueva y le asigna un administrador; luego ingresa como
 * ese administrador, crea su contraseña y termina en /configuracion con la sesión del administrador.
 */
export async function crearJuntaConAdmin(page: Page, sufijo: string) {
  await ingresarComoSuper(page);

  await page.goto("/juntas/nueva");
  await page.getByLabel(/Nombre de la junta/).fill(`Junta Prueba ${sufijo}`);
  await page.getByLabel(/Provincia/).fill("Tungurahua");
  await page.getByLabel(/Cantón/).fill("Ambato");
  await page.getByLabel(/Parroquia/).fill(`Parroquia ${sufijo}`);
  await page.getByRole("button", { name: "Registrar junta" }).click();
  await expect(page.getByText("Junta registrada correctamente.")).toBeVisible();
  const slug = (await page.locator("code").first().innerText()).trim();

  await page.getByRole("link", { name: "Gestionar administrador" }).click();
  await page.getByLabel(/Cédula del nuevo administrador/).fill(CEDULA_ADMIN);
  await page.getByLabel(/Nombres completos/).fill("María Fernanda Quishpe");
  await page.getByLabel(/Correo electrónico/).fill(`admin.${sufijo}@correo.com`);
  await page.getByLabel(/Acta de designación/).setInputFiles({ name: "acta.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: /Validar y asignar/ }).click();
  await expect(page.getByText("Administrador asignado.")).toBeVisible();
  const credencial = (await page.getByTestId("credencial").innerText()).trim();

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.goto("/login");
  await page.getByLabel(/Identificador de junta/).fill(slug);
  await page.getByLabel(/Correo electrónico o número de cédula/).fill(CEDULA_ADMIN);
  await page.getByLabel(/^Contraseña/).fill(credencial);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/cambiar-password/);
  await page.getByLabel(/^Nueva contraseña/).fill(PASSWORD_ADMIN);
  await page.getByLabel(/^Confirmar contraseña/).fill(PASSWORD_ADMIN);
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page).toHaveURL(/\/configuracion/);

  return { slug, nombre: `Junta Prueba ${sufijo}` };
}
