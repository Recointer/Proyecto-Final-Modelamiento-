import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { crearJuntaConAdmin, ingresarComoSuper, SUPER_CORREO, SUPER_PASSWORD } from "./helpers";

// Requiere la app en marcha y el seed del Super Administrador (ver quickstart.md).
// Cada pantalla se audita con axe (WCAG 2.0/2.1 A y AA) en escritorio y en móvil (375 px),
// y se comprueba que no haya scroll horizontal de la página en móvil.

const ESCRITORIO = { width: 1280, height: 800 };
const MOVIL = { width: 375, height: 812 };

async function auditar(page: Page, nombre: string) {
  for (const [vista, tam] of [
    ["escritorio", ESCRITORIO],
    ["móvil", MOVIL],
  ] as const) {
    await page.setViewportSize(tam);
    await page.reload();
    await page.waitForLoadState("networkidle");

    const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const resumen = resultado.violations.map(
      (v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`,
    );
    expect(resumen, `Accesibilidad en «${nombre}» (${vista})`).toEqual([]);

    if (vista === "móvil") {
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(desborde, `Scroll horizontal en «${nombre}» (móvil)`).toBeLessThanOrEqual(0);
    }
  }
  await page.setViewportSize(ESCRITORIO);
}

test.describe("accesibilidad y vista móvil", () => {
  test.skip(!SUPER_CORREO || !SUPER_PASSWORD, "Defina E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD");
  test.setTimeout(240_000);

  test("pantallas públicas", async ({ page }) => {
    for (const ruta of ["/login", "/recuperar"]) {
      await page.goto(ruta);
      await auditar(page, ruta);
    }
  });

  test("pantallas del Super Administrador", async ({ page }) => {
    await ingresarComoSuper(page);
    await auditar(page, "/panel");

    await page.goto("/juntas");
    await auditar(page, "/juntas");

    await page.goto("/juntas/nueva");
    await auditar(page, "/juntas/nueva");

    await page.goto("/juntas");
    await page.getByRole("link", { name: /Ver y editar/ }).first().click();
    await expect(page.getByRole("button", { name: /Desactivar junta|Reactivar junta/ })).toBeVisible();
    await auditar(page, "detalle de junta");

    await page.getByRole("link", { name: "Gestionar administrador" }).click();
    await expect(page.getByRole("heading", { name: "Gestión de administrador" })).toBeVisible();
    await auditar(page, "gestión de administrador");
  });

  test("pantallas del Administrador de la Junta", async ({ page }) => {
    const sufijo = Date.now().toString(36);
    await crearJuntaConAdmin(page, sufijo);
    await auditar(page, "/configuracion");

    await page.goto("/usuarios");
    await auditar(page, "/usuarios");

    await page.goto("/usuarios/nuevo");
    await auditar(page, "/usuarios/nuevo");

    await page.goto("/usuarios");
    await page.getByRole("link", { name: /Ver y editar/ }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await auditar(page, "detalle de cuenta");
  });
});

test.describe("navegación accesible", () => {
  test.skip(!SUPER_CORREO || !SUPER_PASSWORD, "Defina E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD");

  test("títulos descriptivos, enlace para saltar al contenido y sección activa marcada", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle("Iniciar sesión · Multi-Junta");
    await page.goto("/recuperar");
    await expect(page).toHaveTitle("Recuperar contraseña · Multi-Junta");

    await ingresarComoSuper(page);
    await expect(page).toHaveTitle("Panel de control · Multi-Junta");
    await expect(page.getByRole("link", { name: "Panel general" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Juntas y tenencias" })).not.toHaveAttribute("aria-current", "page");

    await page.goto("/juntas/nueva");
    await expect(page).toHaveTitle("Nueva junta · Multi-Junta");
    await expect(page.getByRole("link", { name: "Juntas y tenencias" })).toHaveAttribute("aria-current", "page");

    // el enlace para saltar al contenido es el primer elemento enfocable y lleva a <main>
    await page.keyboard.press("Tab");
    const saltar = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(saltar).toBeFocused();
    await expect(saltar).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#contenido")).toBeFocused();
  });
});
