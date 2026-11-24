import { expect, test, type Page } from "@playwright/test";
import {
  crearCuentaYEntrar,
  crearJuntaConAdmin,
  crearSectorUI,
  crearSocioUI,
  CEDULA_ADMIN,
  CEDULA_SECRETARIO,
  entrarComo,
  PASSWORD_ADMIN,
  PASSWORD_PERSONAL,
  SUPER_CORREO,
  SUPER_PASSWORD,
} from "./helpers";

// Requiere la app en marcha y el seed del Super Administrador (ver quickstart.md).
// La compilación de pruebas lleva una clave de Maps simulada y la prueba intercepta las llamadas a Google.
const ANA = { cedula: "1710000033", nombres: "Ana Torres" };
const BETO = { cedula: "1710000041", nombres: "Beto Pérez" };

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** Google Maps simulado: define window.google y avisa al cargador (callback de la URL). */
const MAPS_FALSO = `
(function () {
  function Mapa(el) { el.setAttribute("data-simulado", "1"); el.textContent = "MAPA SIMULADO"; }
  Mapa.prototype.fitBounds = function () {};
  Mapa.prototype.setCenter = function () {};
  Mapa.prototype.setZoom = function () {};
  function Marcador(o) { this.o = o; this.f = {}; (window.__marcadores = window.__marcadores || []).push(this); }
  Marcador.prototype.addListener = function (e, fn) { this.f[e] = fn; };
  Marcador.prototype.setMap = function () {};
  function Limites() {}
  Limites.prototype.extend = function () {};
  window.google = { maps: { Map: Mapa, Marker: Marcador, LatLngBounds: Limites } };
  if (window.__multijuntaMapaListo) window.__multijuntaMapaListo();
})();
`;

async function conMapaSimulado(page: Page) {
  await page.unroute("https://maps.googleapis.com/**").catch(() => undefined);
  await page.route("https://maps.googleapis.com/**", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: MAPS_FALSO }));
}

async function sinConexionAMaps(page: Page) {
  await page.unroute("https://maps.googleapis.com/**").catch(() => undefined);
  await page.route("https://maps.googleapis.com/**", (r) => r.abort());
}

async function idDeLaFicha(page: Page): Promise<string> {
  const m = /\/predios\/([0-9a-f-]{36})/.exec(page.url());
  if (!m?.[1]) throw new Error(`No se encontró el id del predio en ${page.url()}`);
  return m[1];
}

test.describe("predios y mapa (RF-10, RF-11)", () => {
  test.skip(!SUPER_CORREO || !SUPER_PASSWORD, "Defina E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD");
  test.setTimeout(420_000);

  test("el Secretario/a registra predios con imagen y mapa; el Socio ve solo los suyos", async ({ page }) => {
    const sufijo = Date.now().toString(36);
    const { slug } = await crearJuntaConAdmin(page, sufijo);

    // --- preparación: sectores, Secretario/a y dos socios ---
    await crearSectorUI(page, "Norte");
    await crearSectorUI(page, "Sur");
    await crearCuentaYEntrar(page, slug, { cedula: CEDULA_SECRETARIO, nombres: "Rosa Secretaria", rol: "secretario", sufijo });
    await crearSocioUI(page, { ...ANA, sector: "Norte" });
    await crearSocioUI(page, { ...BETO, sector: "Sur" });

    // --- predios: estado vacío y validaciones ---
    await conMapaSimulado(page);
    await page.getByRole("link", { name: "Predios y mapa" }).click();
    await expect(page.getByText("Aún no hay predios registrados")).toBeVisible();
    await page.getByRole("link", { name: "Nuevo predio" }).click();
    await page.getByLabel(/^Código del predio/).fill("P");
    await page.getByLabel(/^Superficie/).fill("abc");
    await page.getByLabel(/^Latitud/).fill("-1.25");
    await page.getByRole("button", { name: "Guardar predio" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "al menos 2 caracteres" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "superficie válida" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "latitud y longitud juntas" })).toBeVisible();

    // coordenadas fuera de rango
    await page.getByLabel(/^Código del predio/).fill("P-045");
    await page.getByLabel(/^Nombre del predio/).fill("Parcela Central");
    await page.getByLabel(/^Superficie/).fill("1,25");
    await page.getByLabel(/^Latitud/).fill("95");
    await page.getByLabel(/^Longitud/).fill("-78.62312");
    await page.getByLabel(/^Sector/).selectOption({ label: "Norte" });
    await page.getByLabel(/^Socio titular/).selectOption({ label: `${ANA.nombres} (${ANA.cedula})` });
    await page.getByRole("button", { name: "Guardar predio" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Latitud fuera de rango" })).toBeVisible();

    // imagen que no es PNG ni JPEG
    await page.getByLabel(/^Latitud/).fill("-1.25431");
    await page.getByLabel(/Imagen del predio/).setInputFiles({ name: "nota.txt", mimeType: "text/plain", buffer: Buffer.from("hola") });
    await page.getByRole("button", { name: "Guardar predio" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "PNG o JPEG" })).toBeVisible();

    // alta correcta con imagen
    await page.getByLabel(/Imagen del predio/).setInputFiles({ name: "predio.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Guardar predio" }).click();
    await expect(page.getByText("Predio registrado correctamente.")).toBeVisible();
    const idAna = await idDeLaFicha(page);
    const imagen = page.getByRole("img", { name: /Imagen del predio P-045/ });
    await expect(imagen).toBeVisible();
    await expect.poll(() => imagen.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    // código repetido
    await page.goto("/predios/nuevo");
    await page.getByLabel(/^Código del predio/).fill("p-045");
    await page.getByLabel(/^Nombre del predio/).fill("Otro");
    await page.getByLabel(/^Superficie/).fill("2");
    await page.getByLabel(/^Sector/).selectOption({ label: "Norte" });
    await page.getByLabel(/^Socio titular/).selectOption({ label: `${ANA.nombres} (${ANA.cedula})` });
    await page.getByRole("button", { name: "Guardar predio" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Ya existe un predio con ese código" })).toBeVisible();

    // segundo predio (Sur, de Beto) con imagen
    await page.getByLabel(/^Código del predio/).fill("S-001");
    await page.getByLabel(/^Nombre del predio/).fill("Parcela Sur");
    await page.getByLabel(/^Sector/).selectOption({ label: "Sur" });
    await page.getByLabel(/^Socio titular/).selectOption({ label: `${BETO.nombres} (${BETO.cedula})` });
    await page.getByLabel(/^Latitud/).fill("-1.30");
    await page.getByLabel(/^Longitud/).fill("-78.70");
    await page.getByLabel(/Imagen del predio/).setInputFiles({ name: "sur.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Guardar predio" }).click();
    await expect(page.getByText("Predio registrado correctamente.")).toBeVisible();
    const idBeto = await idDeLaFicha(page);

    // --- mapa simulado: se muestra, el marcador selecciona el predio y la lista sigue visible ---
    await page.goto("/predios");
    await expect(page.getByTestId("mapa")).toContainText("MAPA SIMULADO");
    await expect(page.getByTestId("aviso-mapa")).toHaveCount(0);
    await expect(page.getByRole("table", { name: "Predios con coordenadas" })).toBeVisible();
    await page.evaluate(() => (window as unknown as { __marcadores: { f: { click: () => void } }[] }).__marcadores[0]!.f.click());
    await expect(page.getByTestId("ficha-mapa")).toContainText("P-045");

    // filtro por sector: solo los predios del sector
    await page.getByLabel("Sector").selectOption({ label: "Sur" });
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByText("1 predio")).toBeVisible();
    await expect(page.getByRole("table", { name: "Predios de la junta" }).getByRole("cell", { name: /^S-001/ })).toBeVisible();
    await expect(page.getByRole("table", { name: "Predios de la junta" }).getByRole("cell", { name: /^P-045/ })).toHaveCount(0);

    // --- sin conexión a Google Maps: el trabajo no se bloquea; se muestra la lista con coordenadas ---
    await sinConexionAMaps(page);
    await page.goto("/predios");
    await expect(page.getByTestId("aviso-mapa")).toContainText("No se pudo cargar Google Maps");
    await expect(page.getByTestId("mapa")).toBeHidden();
    await expect(page.getByRole("table", { name: "Predios con coordenadas" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Abrir en Google Maps/ }).first()).toHaveAttribute("href", /google\.com\/maps\?q=-1\./);

    // --- edición, reemplazo de imagen y baja ---
    await page.goto(`/predios/${idAna}`);
    await page.getByLabel(/^Nombre del predio/).fill("Parcela Central Norte");
    await page.getByLabel(/Quitar la imagen actual/).check();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();
    await expect(page.getByRole("img", { name: /Imagen del predio/ })).toHaveCount(0);
    await page.getByLabel(/Imagen del predio/).setInputFiles({ name: "nueva.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("img", { name: /Imagen del predio P-045/ })).toBeVisible();

    // --- el Socio ve solo lo suyo ---
    await entrarComo(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await crearCuentaYEntrar(page, slug, { cedula: ANA.cedula, nombres: ANA.nombres, rol: "socio", sufijo });
    await conMapaSimulado(page);
    await page.getByRole("link", { name: "Predios y mapa" }).click();
    await expect(page.getByRole("heading", { name: "Mis predios" })).toBeVisible();
    await expect(page.getByText("1 predio")).toBeVisible();
    await expect(page.getByRole("table", { name: "Predios de la junta" }).getByRole("cell", { name: /^P-045/ })).toBeVisible();
    await expect(page.getByText("S-001")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Nuevo predio" })).toHaveCount(0);

    // su imagen sí; la de otro socio no (404 sin revelar que existe); sin sesión, 401
    expect((await page.request.get(`/api/predios/${idAna}/imagen`)).status()).toBe(200);
    expect((await page.request.get(`/api/predios/${idBeto}/imagen`)).status()).toBe(404);
    expect((await page.request.get(`/api/predios/no-es-un-id/imagen`)).status()).toBe(404);
    await page.goto(`/predios/${idBeto}`);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();

    await page.context().clearCookies();
    expect((await page.request.get(`/api/predios/${idAna}/imagen`)).status()).toBe(401);

    // el Secretario/a puede dar de baja el predio y deja de estar en el mapa
    await entrarComo(page, slug, CEDULA_SECRETARIO, PASSWORD_PERSONAL);
    await conMapaSimulado(page);
    await page.goto(`/predios/${idBeto}`);
    await page.getByRole("button", { name: "Dar de baja" }).click();
    await page.getByRole("button", { name: "Sí, dar de baja" }).click();
    await expect(page.getByText(/Predio dado de baja/)).toBeVisible();
    await page.goto("/predios");
    await expect(page.getByRole("table", { name: "Predios con coordenadas" }).getByText("S-001")).toHaveCount(0);
  });
});
