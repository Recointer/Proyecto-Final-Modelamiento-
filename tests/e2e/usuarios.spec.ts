import { expect, test, type Page } from "@playwright/test";
import { crearJuntaConAdmin, PASSWORD_ADMIN, SUPER_CORREO, SUPER_PASSWORD, CEDULA_ADMIN } from "./helpers";

// Requiere la app en marcha y el seed del Super Administrador (ver quickstart.md).
const CEDULA_SOCIO = "0926687856";
const PASSWORD_SOCIO = "ClaveSocio2026";

async function ingresar(page: Page, slug: string, cedula: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/Identificador de junta/).fill(slug);
  await page.getByLabel(/Correo electrónico o número de cédula/).fill(cedula);
  await page.getByLabel(/^Contraseña/).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

test.describe("cuentas de usuario de la junta (RF-05)", () => {
  test.skip(!SUPER_CORREO || !SUPER_PASSWORD, "Defina E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD");

  test("el administrador crea, edita, desactiva, reactiva y restablece una cuenta", async ({ page }) => {
    const sufijo = Date.now().toString(36);
    const { slug } = await crearJuntaConAdmin(page, sufijo);

    // --- listado inicial: solo el administrador ---
    await page.goto("/usuarios");
    await expect(page.getByRole("heading", { name: "Cuentas de usuario" })).toBeVisible();
    await expect(page.getByText("1 cuenta en su junta")).toBeVisible();
    await expect(page.getByText("(usted)")).toBeVisible();

    // --- crear: validaciones ---
    await page.getByRole("link", { name: "Nueva cuenta" }).click();
    await page.getByLabel(/^Cédula/).fill("1234567890");
    await page.getByLabel(/Nombres completos/).fill("Ana Torres");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "La cédula no es válida" })).toBeVisible();

    // la misma cédula del administrador ya existe en la junta
    await page.getByLabel(/^Cédula/).fill(CEDULA_ADMIN);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Ya existe una cuenta con esa cédula" })).toBeVisible();

    // --- crear: correcto, con rol de tesorero ---
    await page.getByLabel(/^Cédula/).fill(CEDULA_SOCIO);
    await page.getByLabel(/Correo electrónico/).fill(`ana.${sufijo}@correo.com`);
    await page.getByLabel(/^Rol/).selectOption("tesorero");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Cuenta creada.")).toBeVisible();
    const credencial = (await page.getByTestId("credencial").innerText()).trim();
    expect(credencial.length).toBeGreaterThanOrEqual(10);

    // --- la persona ingresa y crea su contraseña ---
    await page.goto("/usuarios");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await ingresar(page, slug, CEDULA_SOCIO, credencial);
    await expect(page).toHaveURL(/\/cambiar-password/);
    await page.getByLabel(/^Nueva contraseña/).fill(PASSWORD_SOCIO);
    await page.getByLabel(/^Confirmar contraseña/).fill(PASSWORD_SOCIO);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page).toHaveURL(/\/inicio/);
    // un tesorero no accede a la administración de cuentas
    await page.goto("/usuarios");
    await expect(page).toHaveURL(/\/inicio/);
    await page.getByRole("button", { name: "Cerrar sesión" }).click();

    // --- el administrador la edita ---
    await ingresar(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await expect(page).toHaveURL(/\/configuracion/);
    await page.goto(`/usuarios?busqueda=${CEDULA_SOCIO}`);
    await expect(page.getByText("1 cuenta en su junta")).toBeVisible();
    await page.getByRole("link", { name: /Ver y editar/ }).click();
    await page.getByLabel(/Nombres completos/).fill("Ana María Torres");
    await page.getByLabel(/^Rol/).selectOption("secretario");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();
    await expect(page.getByLabel(/Nombres completos/)).toHaveValue("Ana María Torres");

    // --- desactivar (con confirmación) y comprobar que no ingresa ---
    await page.getByRole("button", { name: "Desactivar cuenta" }).click();
    await page.getByRole("button", { name: "Sí, desactivar" }).click();
    await expect(page.getByText(/Cuenta desactivada/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Reactivar cuenta" })).toBeVisible();

    const enlaceCuenta = page.url().split("?")[0] ?? "";
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await ingresar(page, slug, CEDULA_SOCIO, PASSWORD_SOCIO);
    await expect(page.getByRole("alert").filter({ hasText: "desactivada" })).toBeVisible();

    // --- reactivar y restablecer la contraseña ---
    await ingresar(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await expect(page).toHaveURL(/\/configuracion/);
    await page.goto(enlaceCuenta);
    await page.getByRole("button", { name: "Reactivar cuenta" }).click();
    await expect(page.getByText("Cuenta reactivada.")).toBeVisible();

    await page.getByRole("button", { name: "Restablecer contraseña" }).click();
    await page.getByRole("button", { name: "Sí, restablecer" }).click();
    await expect(page.getByText("Contraseña restablecida.")).toBeVisible();
    const nueva = (await page.getByTestId("credencial").innerText()).trim();
    expect(nueva).not.toBe(credencial);

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    // la contraseña anterior ya no sirve
    await ingresar(page, slug, CEDULA_SOCIO, PASSWORD_SOCIO);
    await expect(page.getByRole("alert").filter({ hasText: "Credenciales incorrectas" })).toBeVisible();
    // la nueva obliga a cambiarla
    await ingresar(page, slug, CEDULA_SOCIO, nueva);
    await expect(page).toHaveURL(/\/cambiar-password/);
  });

  test("el administrador no puede desactivar su propia cuenta ni cambiar su rol", async ({ page }) => {
    const sufijo = Date.now().toString(36);
    await crearJuntaConAdmin(page, sufijo);
    await page.goto("/usuarios");
    await page.getByRole("link", { name: /Ver y editar/ }).click();
    await expect(page.getByText("no puede desactivarla ni cambiar su rol")).toBeVisible();
    await expect(page.getByRole("button", { name: "Desactivar cuenta" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Restablecer contraseña" })).toHaveCount(0);
  });
});
