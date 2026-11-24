import { expect, test, type Page } from "@playwright/test";
import { hoyEcuador } from "../../src/lib/fechas";
import {
  CEDULA_ADMIN,
  CEDULA_SECRETARIO,
  crearCuentaYEntrar,
  crearJuntaConAdmin,
  crearSectorUI,
  crearSocioUI,
  entrarComo,
  PASSWORD_ADMIN,
  SUPER_CORREO,
  SUPER_PASSWORD,
} from "./helpers";

// Requiere la app en marcha y el seed del Super Administrador (ver quickstart.md).
const ANA = { cedula: "1710000033", nombres: "Ana Torres" };
const BETO = { cedula: "1710000041", nombres: "Beto Pérez" };
const SIN_PADRON = "1710000090";

async function crearEventoYAsistencia(page: Page, o: { titulo: string; tipo: string; ausente?: string }) {
  await page.goto("/eventos/nuevo");
  await page.getByLabel(/^Tipo/).selectOption({ label: o.tipo });
  await page.getByLabel(/^Título/).fill(o.titulo);
  await page.getByLabel(/^Fecha/).fill(hoyEcuador());
  await page.getByLabel(/^Lugar/).fill("Casa comunal");
  await page.getByRole("button", { name: "Guardar evento" }).click();
  await expect(page.getByText("Evento registrado correctamente.")).toBeVisible();
  await page.getByRole("link", { name: "Tomar asistencia" }).click();
  await page.getByRole("button", { name: /Marcar todos presentes/ }).click();
  if (o.ausente) await page.getByRole("group", { name: new RegExp(`Asistencia de ${o.ausente}`) }).getByText("Ausente", { exact: true }).click();
  await page.getByRole("button", { name: "Guardar asistencia" }).click();
  await expect(page.getByText(/Asistencia guardada/)).toBeVisible();
}

test.describe("el Socio consulta lo suyo (RF-14, RF-15)", () => {
  test.skip(!SUPER_CORREO || !SUPER_PASSWORD, "Defina E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD");
  test.setTimeout(420_000);

  test("ficha, predios, calendario, historial con porcentaje y PDF; una cuenta sin padrón recibe un aviso", async ({ page }) => {
    const sufijo = Date.now().toString(36);
    const { slug } = await crearJuntaConAdmin(page, sufijo);
    await crearSectorUI(page, "Norte");
    await crearSectorUI(page, "Sur");
    await crearCuentaYEntrar(page, slug, { cedula: CEDULA_SECRETARIO, nombres: "Rosa Secretaria", rol: "secretario", sufijo });
    await crearSocioUI(page, { ...ANA, sector: "Norte" });
    await crearSocioUI(page, { ...BETO, sector: "Sur" });

    // un predio para cada socio
    for (const [codigo, socio, sector] of [["P-001", ANA, "Norte"], ["S-001", BETO, "Sur"]] as const) {
      await page.goto("/predios/nuevo");
      await page.getByLabel(/^Código del predio/).fill(codigo);
      await page.getByLabel(/^Nombre del predio/).fill(`Parcela ${codigo}`);
      await page.getByLabel(/^Superficie/).fill("1,5");
      await page.getByLabel(/^Sector/).selectOption({ label: sector });
      await page.getByLabel(/^Socio titular/).selectOption({ label: `${socio.nombres} (${socio.cedula})` });
      await page.getByRole("button", { name: "Guardar predio" }).click();
      await expect(page.getByText("Predio registrado correctamente.")).toBeVisible();
    }

    // un turno en el sector de Ana y otro en el de Beto
    await page.goto("/servicios/nuevo");
    await page.getByLabel(/^Nombre del servicio/).fill("Riego general");
    await page.getByLabel(/^Tipo/).selectOption({ label: "Agua de riego" });
    await page.getByRole("button", { name: "Guardar servicio" }).click();
    await expect(page.getByText("Servicio registrado correctamente.")).toBeVisible();
    const tabla = page.getByRole("table", { name: "Turnos del servicio" });
    for (const [sector, ini, fin, filas] of [["Norte", "06:00", "08:00", 2], ["Sur", "18:00", "19:00", 3]] as const) {
      const f = page.getByRole("form", { name: "Agregar turno" });
      await f.getByLabel(/^Sector/).selectOption({ label: sector });
      await f.getByLabel(/^Día/).selectOption({ label: "Miércoles" });
      await f.getByLabel(/^Hora de inicio/).fill(ini);
      await f.getByLabel(/^Hora de fin/).fill(fin);
      await f.getByRole("button", { name: "Agregar turno" }).click();
      await expect(tabla.getByRole("row")).toHaveCount(filas);
    }

    // dos eventos: Ana asiste a la asamblea y falta a la minga (50 %)
    await crearEventoYAsistencia(page, { titulo: "Asamblea de cierre", tipo: "Asamblea" });
    await crearEventoYAsistencia(page, { titulo: "Minga del canal", tipo: "Minga", ausente: "Ana Torres" });

    // --- el Socio ---
    await entrarComo(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await crearCuentaYEntrar(page, slug, { cedula: ANA.cedula, nombres: ANA.nombres, rol: "socio", sufijo });
    await expect(page.getByRole("heading", { name: /Bienvenido, Ana Torres/ })).toBeVisible();
    await expect(page.getByTestId("cumplimiento-pct")).toHaveText("50 %");
    await expect(page.getByText(/Por debajo de la meta de referencia del 80 %/)).toBeVisible();
    for (const prohibido of ["Socios", "Eventos y asistencia", "Servicios y turnos", "Cuentas de usuario"]) {
      await expect(page.getByRole("navigation").getByRole("link", { name: prohibido, exact: true })).toHaveCount(0);
    }

    // ficha y predios: solo los suyos
    await page.getByRole("navigation").getByRole("link", { name: "Mi información" }).click();
    await expect(page.getByRole("heading", { name: "Mi información" })).toBeVisible();
    await expect(page.getByText("Ana Torres").first()).toBeVisible();
    const predios = page.getByRole("table", { name: "Predios del socio" });
    await expect(predios.getByRole("link", { name: "P-001" })).toBeVisible();
    await expect(predios.getByRole("link", { name: "S-001" })).toHaveCount(0);

    // calendario de su sector (lo que pida por la URL no cambia el sector)
    await page.goto("/calendario");
    await expect(page.getByText("Sector Norte", { exact: true })).toBeVisible();
    const semana = page.getByRole("table", { name: "Calendario semanal de turnos" });
    await expect(semana.getByRole("row", { name: /Miércoles/ })).toContainText("06:00 – 08:00");
    await expect(semana.getByText("18:00 – 19:00")).toHaveCount(0);

    // historial con porcentaje y filtro por tipo
    await page.getByRole("navigation").getByRole("link", { name: "Mi asistencia" }).click();
    await expect(page.getByRole("heading", { name: "Mi asistencia" })).toBeVisible();
    const hist = page.getByRole("table", { name: "Historial de asistencia" });
    await expect(hist.getByRole("row", { name: /Asamblea de cierre/ })).toContainText("Presente");
    await expect(hist.getByRole("row", { name: /Minga del canal/ })).toContainText("Ausente");
    await expect(page.getByTestId("cumplimiento-pct")).toHaveText("50 %");
    await page.getByLabel("Tipo de evento").selectOption({ label: "Asamblea" });
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByTestId("cumplimiento-pct")).toHaveText("100 %");
    await expect(hist.getByText("Minga del canal")).toHaveCount(0);

    // PDF propio
    const pdf = await page.request.get("/api/mi/asistencia.pdf");
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect(pdf.headers()["cache-control"]).toContain("no-store");
    expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const descarga = page.waitForEvent("download");
    await page.getByRole("link", { name: "Descargar historial en PDF" }).click();
    expect((await descarga).suggestedFilename()).toBe("historial-asistencia.pdf");

    // sin sesión, 401; el personal no es Socio, 403
    await page.context().clearCookies();
    expect((await page.request.get("/api/mi/asistencia.pdf")).status()).toBe(401);
    await entrarComo(page, slug, CEDULA_SECRETARIO, "ClavePersonal2026");
    expect((await page.request.get("/api/mi/asistencia.pdf")).status()).toBe(403);

    // cuenta de Socio cuya cédula no está en el padrón
    await entrarComo(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await crearCuentaYEntrar(page, slug, { cedula: SIN_PADRON, nombres: "Pablo Sin Padrón", rol: "socio", sufijo: `${sufijo}x` });
    await expect(page.getByRole("status").filter({ hasText: /padrón/i })).toBeVisible();
    await page.goto("/mi/asistencia");
    await expect(page.getByRole("status").filter({ hasText: /padrón/i })).toBeVisible();
    expect((await page.request.get("/api/mi/asistencia.pdf")).status()).toBe(404);
  });
});
