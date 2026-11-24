import { expect, test } from "@playwright/test";
import { hoyEcuador } from "../../src/lib/fechas";
import {
  CEDULA_ADMIN,
  CEDULA_SECRETARIO,
  crearCuentaYEntrar,
  crearJuntaConAdmin,
  crearSectorUI,
  crearSocioUI,
  entrarComo,
  ingresarComoSuper,
  PASSWORD_ADMIN,
  SUPER_CORREO,
  SUPER_PASSWORD,
} from "./helpers";

// Requiere la app en marcha y el seed del Super Administrador (ver quickstart.md).
const SOCIOS = [
  { cedula: "1710000033", nombres: "Ana Torres" },
  { cedula: "1710000041", nombres: "Beto Pérez" },
  { cedula: "1710000058", nombres: "Carla Ríos" },
];

function enDias(base: string, dias: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

test.describe("eventos y asistencia (RF-08, RF-09)", () => {
  test.skip(!SUPER_CORREO || !SUPER_PASSWORD, "Defina E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD");
  test.setTimeout(300_000);

  test("el Secretario/a registra eventos y toma asistencia con quórum; el Administrador consulta; el panel cuenta", async ({ page }) => {
    const sufijo = Date.now().toString(36);
    const hoy = hoyEcuador();
    const { slug } = await crearJuntaConAdmin(page, sufijo);

    // --- preparación: sector, Secretario/a y tres socios ---
    await crearSectorUI(page, "Norte");
    await crearCuentaYEntrar(page, slug, { cedula: CEDULA_SECRETARIO, nombres: "Rosa Secretaria", rol: "secretario", sufijo });
    for (const s of SOCIOS) await crearSocioUI(page, { ...s, sector: "Norte" });

    // --- eventos: validación y alta ---
    await page.getByRole("link", { name: "Eventos y asistencia" }).click();
    await expect(page.getByText("Aún no hay eventos registrados")).toBeVisible();
    await page.getByRole("link", { name: "Nuevo evento" }).click();
    await page.getByLabel(/^Título/).fill("Ab");
    await page.getByRole("button", { name: "Guardar evento" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "al menos 3 caracteres" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Use una fecha válida" })).toBeVisible();

    await page.getByLabel(/^Título/).fill("Asamblea General Ordinaria");
    await page.getByLabel(/^Fecha/).fill(hoy);
    await page.getByLabel(/^Lugar/).fill("Casa comunal");
    await page.getByRole("button", { name: "Guardar evento" }).click();
    await expect(page.getByText("Evento registrado correctamente.")).toBeVisible();

    // --- asistencia: contadores, búsqueda, marcar todos y justificación ---
    await page.getByRole("link", { name: "Tomar asistencia" }).click();
    await expect(page.getByRole("heading", { name: "Registrar asistencia" })).toBeVisible();
    const num = async (id: string) => Number(await page.getByTestId(id).innerText());
    expect([await num("total"), await num("presentes"), await num("ausentes")]).toEqual([3, 0, 3]);
    await expect(page.getByTestId("quorum")).toContainText("quórum no alcanzado");

    await page.getByLabel(/Buscar por nombre o cédula/).fill("beto");
    await expect(page.getByRole("group", { name: /Asistencia de Beto Pérez/ })).toBeVisible();
    await expect(page.getByRole("group", { name: /Asistencia de Ana Torres/ })).toHaveCount(0);
    await page.getByLabel(/Buscar por nombre o cédula/).fill("");

    await page.getByRole("button", { name: /Marcar todos presentes/ }).click();
    expect([await num("presentes"), await num("ausentes")]).toEqual([3, 0]);
    await expect(page.getByTestId("quorum")).toContainText("quórum alcanzado");

    await page.getByRole("group", { name: /Asistencia de Carla Ríos/ }).getByText("Ausente", { exact: true }).click();
    await page.getByRole("group", { name: /Asistencia de Beto Pérez/ }).getByText("Justificado", { exact: true }).click();
    expect([await num("presentes"), await num("ausentes"), await num("justificados")]).toEqual([1, 1, 1]);
    await expect(page.getByTestId("quorum")).toContainText("quórum no alcanzado");

    // una justificación sin motivo no se guarda
    await page.getByRole("button", { name: "Guardar asistencia" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Indique el motivo" }).first()).toBeVisible();

    await page.getByLabel(/Motivo de la justificación de Beto Pérez/).fill("Calamidad doméstica");
    await page.getByRole("button", { name: "Guardar asistencia" }).click();
    await expect(page.getByText("Asistencia guardada: 1 presentes de 3 socios.")).toBeVisible();

    // se conserva al reabrir
    const urlAsistencia = page.url();
    await page.reload();
    expect([await num("presentes"), await num("ausentes"), await num("justificados")]).toEqual([1, 1, 1]);
    await expect(page.getByLabel(/Motivo de la justificación de Beto Pérez/)).toHaveValue("Calamidad doméstica");

    // corrección posterior
    await page.getByRole("group", { name: /Asistencia de Carla Ríos/ }).getByText("Presente", { exact: true }).click();
    await page.getByRole("button", { name: "Guardar asistencia" }).click();
    await expect(page.getByText("Asistencia guardada: 2 presentes de 3 socios.")).toBeVisible();

    // --- evento futuro: sin asistencia; luego se anula con motivo ---
    await page.goto("/eventos/nuevo");
    await page.getByLabel(/^Título/).fill("Minga de limpieza");
    await page.getByLabel(/Tipo de evento/).selectOption("minga");
    await page.getByLabel(/^Fecha/).fill(enDias(hoy, 30));
    await page.getByLabel(/^Lugar/).fill("Acequia norte");
    await page.getByRole("button", { name: "Guardar evento" }).click();
    await expect(page.getByText("Evento registrado correctamente.")).toBeVisible();
    await expect(page.getByText("El evento aún no se realiza")).toBeVisible();
    await expect(page.getByRole("link", { name: /Tomar asistencia|Ver asistencia|Revisar o corregir/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Anular evento" }).click();
    await page.getByLabel(/Motivo de la anulación/).fill("Se pospone por la cosecha");
    await page.getByRole("button", { name: "Sí, anular" }).click();
    await expect(page.getByText(/Evento anulado/)).toBeVisible();
    await expect(page.getByText(/Se pospone por la cosecha/)).toBeVisible();

    await page.goto("/eventos");
    await expect(page.getByText("2 eventos")).toBeVisible();
    await expect(page.getByText("Anulado", { exact: true })).toBeVisible();
    await expect(page.getByText("2 de 3 presentes")).toBeVisible();

    // --- el Administrador de la Junta solo consulta ---
    await entrarComo(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await page.goto(urlAsistencia);
    await expect(page.getByText("Vista de consulta")).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar asistencia" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Marcar todos presentes/ })).toHaveCount(0);
    await expect(page.getByText("Calamidad doméstica")).toBeVisible();

    // --- el panel de plataforma cuenta el evento vigente como cifra agregada ---
    await ingresarComoSuper(page);
    await expect(page.getByTestId("total-eventos")).toBeVisible();
    expect(Number(await page.getByTestId("total-eventos").innerText())).toBeGreaterThanOrEqual(1);
    await expect(page.locator("main")).not.toContainText("Asamblea General Ordinaria");
  });
});
