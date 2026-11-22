import { expect, test } from "@playwright/test";

// Requiere la app en marcha y el seed del Super Administrador (ver quickstart.md).
// Variables: E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD.
const correo = process.env.E2E_SUPERADMIN_CORREO ?? "";
const password = process.env.E2E_SUPERADMIN_PASSWORD ?? "";

test("redirige a login si no hay sesión", async ({ page }) => {
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Portal de Acceso Comunal" })).toBeVisible();
});

test("credenciales incorrectas muestran un mensaje genérico", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/Correo electrónico o número de cédula/).fill("nadie@correo.com");
  await page.getByLabel(/^Contraseña/).fill("incorrecta123");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Credenciales incorrectas" })).toBeVisible();
});

test("el Super Administrador inicia y cierra sesión", async ({ page }) => {
  test.skip(!correo || !password, "Defina E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD");
  await page.goto("/login");
  await page.getByLabel(/Correo electrónico o número de cédula/).fill(correo);
  await page.getByLabel(/^Contraseña/).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/panel/);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
});
