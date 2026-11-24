import { expect, test } from "@playwright/test";
import {
  CEDULA_ADMIN,
  CEDULA_SECRETARIO,
  CEDULA_TESORERO,
  crearCuentaYEntrar,
  crearJuntaConAdmin,
  crearSectorUI,
  entrarComo,
  PASSWORD_ADMIN,
  PASSWORD_PERSONAL,
  SUPER_CORREO,
  SUPER_PASSWORD,
} from "./helpers";

// Requiere la app en marcha y el seed del Super Administrador (ver quickstart.md).
const SOCIO_1 = "1710000033";
const SOCIO_2 = "1710000041";

test.describe("nómina de socios (RF-07)", () => {
  test.skip(!SUPER_CORREO || !SUPER_PASSWORD, "Defina E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD");
  test.setTimeout(240_000);

  test("el Secretario/a mantiene la nómina y el Tesorero/a solo consulta", async ({ page }) => {
    const sufijo = Date.now().toString(36);
    const { slug } = await crearJuntaConAdmin(page, sufijo);

    // --- preparación: sectores y cuentas del personal ---
    await crearSectorUI(page, "Norte");
    await crearSectorUI(page, "Sur");
    await crearCuentaYEntrar(page, slug, { cedula: CEDULA_SECRETARIO, nombres: "Rosa Secretaria", rol: "secretario", sufijo });
    await entrarComo(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await expect(page).toHaveURL(/\/configuracion/);
    await crearCuentaYEntrar(page, slug, { cedula: CEDULA_TESORERO, nombres: "Luis Tesorero", rol: "tesorero", sufijo });

    // --- el Tesorero/a ve la nómina vacía pero sin acciones de escritura ---
    await page.getByRole("link", { name: "Socios" }).click();
    await expect(page.getByRole("heading", { name: "Nómina de socios" })).toBeVisible();
    await expect(page.getByText("Aún no hay socios registrados")).toBeVisible();
    await expect(page.getByRole("link", { name: "Nuevo socio" })).toHaveCount(0);
    await page.goto("/socios/nuevo");
    await expect(page).toHaveURL(/\/inicio/);

    // --- el Secretario/a registra socios ---
    await entrarComo(page, slug, CEDULA_SECRETARIO, PASSWORD_PERSONAL);
    await expect(page).toHaveURL(/\/inicio/);
    await page.getByRole("link", { name: "Socios" }).click();
    await page.getByRole("link", { name: "Nuevo socio" }).click();

    // validaciones
    await page.getByLabel(/^Cédula/).fill("1234567890");
    await page.getByLabel(/Nombres completos/).fill("Ana Torres");
    await page.getByLabel(/Fecha de ingreso/).fill("2020-05-10");
    await page.getByRole("button", { name: "Guardar socio" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "La cédula no es válida" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Seleccione un sector" })).toBeVisible();

    // alta correcta
    await page.getByLabel(/^Cédula/).fill(SOCIO_1);
    await page.getByLabel(/Sector \/ zona asignada/).selectOption({ label: "Norte" });
    await page.getByLabel(/Correo electrónico/).fill(`ana.${sufijo}@correo.com`);
    await page.getByRole("button", { name: "Guardar socio" }).click();
    await expect(page.getByText("Socio registrado correctamente.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ana Torres" })).toBeVisible();

    // cédula duplicada
    await page.goto("/socios/nuevo");
    await page.getByLabel(/^Cédula/).fill(SOCIO_1);
    await page.getByLabel(/Nombres completos/).fill("Otra Persona");
    await page.getByLabel(/Sector \/ zona asignada/).selectOption({ label: "Sur" });
    await page.getByLabel(/Fecha de ingreso/).fill("2021-01-01");
    await page.getByRole("button", { name: "Guardar socio" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Ya existe un socio con esa cédula" })).toBeVisible();

    // segundo socio, en otro sector
    await page.getByLabel(/^Cédula/).fill(SOCIO_2);
    await page.getByLabel(/Nombres completos/).fill("Luis Pérez");
    await page.getByRole("button", { name: "Guardar socio" }).click();
    await expect(page.getByText("Socio registrado correctamente.")).toBeVisible();

    // --- búsqueda y filtros ---
    await page.goto("/socios");
    await expect(page.getByText("2 socios en la junta")).toBeVisible();
    await page.getByLabel(/Buscar por nombre o cédula/).fill(SOCIO_2);
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByText("1 socio en la junta")).toBeVisible();
    await expect(page.getByRole("cell", { name: /^Luis Pérez/ })).toBeVisible();
    await page.getByRole("link", { name: "Limpiar" }).click();
    await page.getByLabel("Sector").selectOption({ label: "Norte" });
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByText("1 socio en la junta")).toBeVisible();
    await expect(page.getByRole("cell", { name: /^Ana Torres/ })).toBeVisible();

    // --- edición: la cédula no se puede modificar ---
    await page.getByRole("link", { name: /Ver y editar/ }).click();
    await expect(page.getByText("(no se puede modificar)")).toBeVisible();
    await page.getByLabel(/Nombres completos/).fill("Ana María Torres");
    await page.getByLabel(/Teléfono/).fill("0991234567");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();

    // --- baja lógica con confirmación y reactivación ---
    await page.getByRole("button", { name: "Dar de baja" }).click();
    await page.getByRole("button", { name: "Sí, dar de baja" }).click();
    await expect(page.getByText(/Socio dado de baja/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Reactivar socio" })).toBeVisible();

    await page.goto("/socios?estado=inactivo");
    await expect(page.getByText("1 socio en la junta")).toBeVisible();
    await expect(page.getByRole("cell", { name: /^Ana María Torres/ })).toBeVisible();
    await page.getByRole("link", { name: /Ver y editar/ }).click();
    await page.getByRole("button", { name: "Reactivar socio" }).click();
    await expect(page.getByText("Socio reactivado.")).toBeVisible();

    // --- el Tesorero/a ve la ficha en solo lectura ---
    await entrarComo(page, slug, CEDULA_TESORERO, PASSWORD_PERSONAL);
    await page.goto("/socios");
    await page.getByRole("link", { name: /Ver ficha/ }).first().click();
    await expect(page.getByText("Fecha de ingreso")).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Dar de baja" })).toHaveCount(0);
  });
});
