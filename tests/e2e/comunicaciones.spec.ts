import { expect, test } from "@playwright/test";
import {
  CEDULA_ADMIN,
  CEDULA_SECRETARIO,
  crearCuentaYEntrar,
  crearJuntaConAdmin,
  crearSectorUI,
  crearSocioUI,
  entrarComo,
  PASSWORD_ADMIN,
  PASSWORD_PERSONAL,
  PDF,
  SUPER_CORREO,
  SUPER_PASSWORD,
} from "./helpers";

// Requiere la app en marcha y el seed del Super Administrador (ver quickstart.md).
const ANA = { cedula: "1710000033", nombres: "Ana Torres" };

test.describe("gestión de comunicaciones (RF-25 a RF-33)", () => {
  test.skip(!SUPER_CORREO || !SUPER_PASSWORD, "Defina E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD");
  test.setTimeout(480_000);

  test("convocatorias, actas, comunicados y mensajes entre el Administrador y el Socio", async ({ page }) => {
    const sufijo = Date.now().toString(36);
    const { slug } = await crearJuntaConAdmin(page, sufijo);
    await crearSectorUI(page, "Norte");

    // --- Secretario/a ---
    await crearCuentaYEntrar(page, slug, { cedula: CEDULA_SECRETARIO, nombres: "Rosa Secretaria", rol: "secretario", sufijo });
    await crearSocioUI(page, { ...ANA, sector: "Norte" });

    await page.goto("/convocatorias");
    await page.locator("summary", { hasText: "Emitir convocatoria" }).click();
    await page.locator("details").getByLabel(/^Tipo/).selectOption({ label: "Asamblea general" });
    await page.locator("details").getByLabel(/^Título/).fill("Asamblea general ordinaria");
    await page.locator("details").getByLabel(/^Fecha/).fill("2030-01-15");
    await page.locator("details").getByLabel(/^Hora/).fill("18:00");
    await page.locator("details").getByLabel(/^Lugar/).fill("Casa comunal");
    await page.locator("details").getByLabel(/^Orden del día/).fill("1. Informe\n2. Varios");
    await page.getByRole("button", { name: "Emitir convocatoria" }).click();
    await expect(page.getByText("Convocatoria emitida.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Asamblea general ordinaria" })).toBeVisible();

    // una fecha pasada se rechaza
    await page.locator("summary", { hasText: "Emitir convocatoria" }).click();
    await page.locator("details").getByLabel(/^Tipo/).selectOption({ label: "Minga" });
    await page.locator("details").getByLabel(/^Título/).fill("Convocatoria vieja");
    await page.locator("details").getByLabel(/^Fecha/).fill("2020-01-15");
    await page.locator("details").getByLabel(/^Hora/).fill("18:00");
    await page.locator("details").getByLabel(/^Lugar/).fill("Casa comunal");
    await page.getByRole("button", { name: "Emitir convocatoria" }).click();
    await expect(page.getByText("La fecha y la hora de la convocatoria ya pasaron.")).toBeVisible();

    // acta archivada sin publicar
    await page.goto("/documentos");
    await page.locator("summary", { hasText: "Archivar documento" }).click();
    await page.locator("details").getByLabel(/^Tipo de documento/).selectOption({ label: "Acta de asamblea" });
    await page.locator("details").getByLabel(/^Título/).fill("Acta de la asamblea de marzo");
    await page.locator("details").getByLabel(/^Archivo/).setInputFiles({ name: "acta.pdf", mimeType: "application/pdf", buffer: PDF });
    await page.getByRole("button", { name: "Archivar documento" }).click();
    await expect(page.getByText("Documento archivado.")).toBeVisible();
    const fila = page.getByRole("table", { name: "Actas y resoluciones de la junta" }).getByRole("row", { name: /Acta de la asamblea de marzo/ });
    await expect(fila).toContainText("Sin publicar");
    const hrefDoc = (await fila.getByRole("link", { name: /Descargar/ }).getAttribute("href"))!;
    expect((await page.request.get(hrefDoc)).status()).toBe(200);

    // un archivo no permitido se rechaza
    await page.locator("summary", { hasText: "Archivar documento" }).click();
    await page.locator("details").getByLabel(/^Tipo de documento/).selectOption({ label: "Resolución" });
    await page.locator("details").getByLabel(/^Título/).fill("Documento inválido");
    await page.locator("details").getByLabel(/^Fecha del documento/).fill("2026-03-10");
    await page.locator("details").getByLabel(/^Archivo/).setInputFiles({ name: "malo.pdf", mimeType: "application/pdf", buffer: Buffer.from("no es un pdf") });
    await page.getByRole("button", { name: "Archivar documento" }).click();
    await expect(page.getByText("Solo se permiten archivos PDF o imagen.")).toBeVisible();

    // comunicación recibida, publicada como comunicado
    await page.goto("/comunicaciones");
    await page.locator("summary", { hasText: "Registrar comunicación" }).click();
    await page.locator("details").getByLabel(/^Institución/).fill("GAD Parroquial");
    await page.locator("details").getByLabel(/^Asunto/).fill("Reunión técnica de riego");
    await page.locator("details").getByLabel(/^Resumen/).fill("Invitan a una reunión técnica el jueves.");
    await page.locator("details").getByLabel(/^Publicar como comunicado/).check();
    await page.getByRole("button", { name: "Registrar comunicación" }).click();
    await expect(page.getByText("Comunicación registrada.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reunión técnica de riego" })).toBeVisible();

    // --- Socio ---
    await entrarComo(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await crearCuentaYEntrar(page, slug, { cedula: ANA.cedula, nombres: ANA.nombres, rol: "socio", sufijo });
    const menu = page.getByRole("navigation", { name: "Navegación principal" });
    for (const enlace of ["Convocatorias", "Actas y resoluciones", "Comunicados", "Mensajes"]) {
      await expect(menu.getByRole("link", { name: enlace, exact: true })).toBeVisible();
    }
    await expect(menu.getByRole("link", { name: "Comunicaciones recibidas", exact: true })).toHaveCount(0);

    await page.goto("/convocatorias");
    await expect(page.getByRole("heading", { name: "Asamblea general ordinaria" })).toBeVisible();
    await expect(page.locator("summary", { hasText: "Emitir convocatoria" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Anular" })).toHaveCount(0);

    await page.goto("/documentos");
    await expect(page.getByText("Aún no hay documentos publicados")).toBeVisible();
    expect((await page.request.get(hrefDoc)).status()).toBe(404); // no publicado: ni con la dirección directa

    await page.goto("/comunicaciones");
    await expect(page.getByRole("heading", { name: "Comunicados" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reunión técnica de riego" })).toBeVisible();

    // el Socio escribe al Administrador
    await page.goto("/mensajes");
    await page.getByLabel(/^Asunto/).fill("Turno de riego");
    await page.getByLabel(/^Mensaje/).fill("¿Puedo cambiar mi turno del miércoles?");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.getByText("Mensaje enviado.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Turno de riego" })).toBeVisible();

    // --- Secretario/a publica el acta ---
    await entrarComo(page, slug, CEDULA_SECRETARIO, PASSWORD_PERSONAL);
    await page.goto("/documentos");
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await page.getByRole("button", { name: "Sí, publicar" }).click();
    await expect(page.getByText("Documento publicado.")).toBeVisible();
    await expect(page.getByRole("table", { name: "Actas y resoluciones de la junta" }).getByRole("row", { name: /Acta de la asamblea de marzo/ })).toContainText("Publicado");
    // el Secretario/a no participa en la mensajería
    await page.goto("/mensajes");
    await expect(page).not.toHaveURL(/\/mensajes/);

    // --- Administrador: ve el mensaje sin leer, lo abre y responde ---
    await entrarComo(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await page.goto("/convocatorias");
    await expect(page.locator("summary", { hasText: "Emitir convocatoria" })).toHaveCount(0);
    await page.goto("/mensajes");
    await expect(page.getByTestId("resumen-mensajes")).toContainText("Tiene 1 mensaje sin leer.");
    await page.getByRole("link", { name: "Turno de riego" }).click();
    await expect(page.getByText("¿Puedo cambiar mi turno del miércoles?")).toBeVisible();
    await page.getByLabel(/^Su respuesta/).fill("Sí, avise a la secretaría.");
    await page.getByRole("button", { name: "Enviar respuesta" }).click();
    await expect(page.getByText("Mensaje enviado.")).toBeVisible();
    await expect(page.getByText("Sí, avise a la secretaría.")).toBeVisible();

    // --- Socio: descarga el acta ya publicada y ve la respuesta sin leer ---
    await entrarComo(page, slug, ANA.cedula, PASSWORD_PERSONAL);
    expect((await page.request.get(hrefDoc)).status()).toBe(200);
    await page.goto("/mensajes");
    await expect(page.getByTestId("resumen-mensajes")).toContainText("Tiene 1 mensaje sin leer.");
    await page.getByRole("link", { name: "Turno de riego" }).click();
    await expect(page.getByText("Sí, avise a la secretaría.")).toBeVisible();
    await page.goto("/mensajes");
    await expect(page.getByTestId("resumen-mensajes")).toContainText("No tiene mensajes sin leer.");

    // sin sesión, 401
    await page.context().clearCookies();
    expect((await page.request.get(hrefDoc)).status()).toBe(401);
  });
});
