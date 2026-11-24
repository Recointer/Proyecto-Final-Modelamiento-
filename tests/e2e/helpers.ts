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

// ---------------------------------------------------------------------------------------------
// Módulo administrativo
// ---------------------------------------------------------------------------------------------

/** Cédulas válidas de prueba para el personal y los socios (únicas por junta). */
export const CEDULA_SECRETARIO = "1710000017";
export const CEDULA_TESORERO = "1710000025";
export const PASSWORD_PERSONAL = "ClavePersonal2026";

/** Entra al sistema con identificador de junta, cédula y contraseña (cierra antes cualquier sesión). */
export async function entrarComo(page: Page, slug: string, cedula: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/Identificador de junta/).fill(slug);
  await page.getByLabel(/Correo electrónico o número de cédula/).fill(cedula);
  await page.getByLabel(/^Contraseña/).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  // esperar a que termine el inicio de sesión antes de seguir navegando
  await expect(page).not.toHaveURL(/\/login/);
}

/** Como Administrador de la Junta (sesión activa) crea un sector en /configuracion. */
export async function crearSectorUI(page: Page, nombre: string) {
  await page.goto("/configuracion");
  await page.getByLabel(/Nombre del nuevo sector/).fill(nombre);
  await page.getByRole("button", { name: "Agregar sector" }).click();
  await expect(page.getByText("Sector agregado.")).toBeVisible();
}

/**
 * Como Administrador de la Junta crea una cuenta con el rol indicado; luego esa persona ingresa con la
 * credencial inicial y crea su contraseña. Al terminar queda con la sesión de ESA persona.
 */
export async function crearCuentaYEntrar(
  page: Page,
  slug: string,
  o: { cedula: string; nombres: string; rol: "secretario" | "tesorero" | "socio"; sufijo: string; password?: string },
) {
  const password = o.password ?? PASSWORD_PERSONAL;
  await page.goto("/usuarios/nuevo");
  await page.getByLabel(/^Cédula/).fill(o.cedula);
  await page.getByLabel(/Nombres completos/).fill(o.nombres);
  await page.getByLabel(/Correo electrónico/).fill(`${o.rol}.${o.sufijo}@correo.com`);
  await page.getByLabel(/^Rol/).selectOption(o.rol);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("Cuenta creada.")).toBeVisible();
  const credencial = (await page.getByTestId("credencial").innerText()).trim();

  await entrarComo(page, slug, o.cedula, credencial);
  await expect(page).toHaveURL(/\/cambiar-password/);
  await page.getByLabel(/^Nueva contraseña/).fill(password);
  await page.getByLabel(/^Confirmar contraseña/).fill(password);
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  return { password };
}

/** Como Secretario/a (sesión activa) registra un socio en la nómina. */
export async function crearSocioUI(page: Page, o: { cedula: string; nombres: string; sector: string }) {
  await page.goto("/socios/nuevo");
  await page.getByLabel(/^Cédula/).fill(o.cedula);
  await page.getByLabel(/Nombres completos/).fill(o.nombres);
  await page.getByLabel(/Sector \/ zona asignada/).selectOption({ label: o.sector });
  await page.getByLabel(/Fecha de ingreso/).fill("2020-01-01");
  await page.getByRole("button", { name: "Guardar socio" }).click();
  await expect(page.getByText("Socio registrado correctamente.")).toBeVisible();
}
