import { expect, test } from "@playwright/test";
import { crearJuntaConAdmin, SUPER_CORREO, SUPER_PASSWORD } from "./helpers";

// Requiere la app en marcha y el seed del Super Administrador (ver quickstart.md).
test.describe("configuración de la junta y sectores (RF-02)", () => {
  test.skip(!SUPER_CORREO || !SUPER_PASSWORD, "Defina E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD");

  test("el administrador edita datos, parámetros y sectores", async ({ page }) => {
    const sufijo = Date.now().toString(36);
    const { slug } = await crearJuntaConAdmin(page, sufijo);

    // --- datos generales y parámetros ---
    await expect(page.getByRole("heading", { name: "Configuración de la junta" })).toBeVisible();
    await expect(page.getByText(slug)).toBeVisible();

    // validación de parámetros
    await page.getByLabel(/Multa por inasistencia a asamblea/).fill("abc");
    await page.getByLabel(/Quórum mínimo/).fill("150");
    await page.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "monto válido" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "entre 1 y 100" })).toBeVisible();

    // guardado correcto (con coma decimal)
    await page.getByLabel(/Nombre de la junta/).fill(`Junta Renombrada ${sufijo}`);
    await page.getByLabel(/Multa por inasistencia a asamblea/).fill("5");
    await page.getByLabel(/Multa por inasistencia a minga/).fill("2,50");
    await page.getByLabel(/Quórum mínimo/).fill("60");
    await page.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(page.getByText("Configuración guardada.")).toBeVisible();

    // persiste al recargar
    await page.reload();
    await expect(page.getByLabel(/Nombre de la junta/)).toHaveValue(`Junta Renombrada ${sufijo}`);
    await expect(page.getByLabel(/Multa por inasistencia a minga/)).toHaveValue("2,5");
    await expect(page.getByLabel(/Quórum mínimo/)).toHaveValue("60");

    // el nombre nuevo aparece en el encabezado de la aplicación
    await expect(page.getByRole("complementary").getByText(`Junta Renombrada ${sufijo}`)).toBeVisible();

    // --- sectores ---
    await expect(page.getByText("Aún no hay sectores")).toBeVisible();
    await page.getByLabel(/Nombre del nuevo sector/).fill("Norte");
    await page.getByRole("button", { name: "Agregar sector" }).click();
    await expect(page.getByText("Sector agregado.")).toBeVisible();

    // duplicado (sin distinguir mayúsculas)
    await page.getByLabel(/Nombre del nuevo sector/).fill("NORTE");
    await page.getByRole("button", { name: "Agregar sector" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Ya existe un sector" })).toBeVisible();

    await page.getByLabel(/Nombre del nuevo sector/).fill("Sur");
    await page.getByRole("button", { name: "Agregar sector" }).click();
    await expect(page.locator("input[name=nombre][value=Sur]")).toBeVisible();

    // editar
    const filaNorte = page.locator("li", { has: page.locator("input[name=nombre][value=Norte]") });
    await filaNorte.getByLabel("Nombre").fill("Norte Alto");
    await filaNorte.getByRole("button", { name: /Guardar sector/ }).click();
    await expect(page.getByText("Sector actualizado.")).toBeVisible();
    await expect(page.locator("input[name=nombre][value='Norte Alto']")).toBeVisible();

    // eliminar con confirmación
    const filaSur = page.locator("li", { has: page.locator("input[name=nombre][value=Sur]") });
    await filaSur.getByRole("button", { name: "Eliminar" }).click();
    await page.getByRole("button", { name: "Sí, eliminar" }).click();
    await expect(page.getByText("Sector eliminado.")).toBeVisible();
    await expect(page.locator("input[name=nombre][value=Sur]")).toHaveCount(0);
  });
});
