import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { hoyEcuador } from "../../src/lib/fechas";
import {
  CEDULA_ADMIN,
  CEDULA_SECRETARIO,
  CEDULA_TESORERO,
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

  test("pantallas del módulo administrativo (Secretario/a y Socio)", async ({ page }) => {
    test.setTimeout(480_000);
    const sufijo = Date.now().toString(36);
    const { slug } = await crearJuntaConAdmin(page, sufijo);
    // el mapa se prueba en su versión degradada (sin red): es la que debe ser accesible en cualquier caso
    await page.route("https://maps.googleapis.com/**", (r) => r.abort());
    await crearSectorUI(page, "Norte");
    await crearCuentaYEntrar(page, slug, { cedula: CEDULA_SECRETARIO, nombres: "Rosa Secretaria", rol: "secretario", sufijo });
    await crearSocioUI(page, { cedula: "1710000033", nombres: "Ana Torres", sector: "Norte" });

    // datos mínimos para que las pantallas tengan contenido
    await page.goto("/predios/nuevo");
    await page.getByLabel(/^Código del predio/).fill("P-001");
    await page.getByLabel(/^Nombre del predio/).fill("Parcela uno");
    await page.getByLabel(/^Superficie/).fill("1,5");
    await page.getByLabel(/^Latitud/).fill("-1.25431");
    await page.getByLabel(/^Longitud/).fill("-78.62312");
    await page.getByLabel(/^Sector/).selectOption({ label: "Norte" });
    await page.getByLabel(/^Socio titular/).selectOption({ label: "Ana Torres (1710000033)" });
    await page.getByRole("button", { name: "Guardar predio" }).click();
    await expect(page.getByText("Predio registrado correctamente.")).toBeVisible();
    const idPredio = /\/predios\/([0-9a-f-]{36})/.exec(page.url())?.[1];

    await page.goto("/eventos/nuevo");
    await page.getByLabel(/^Título/).fill("Asamblea de prueba");
    await page.getByLabel(/^Fecha/).fill(hoyEcuador());
    await page.getByLabel(/^Lugar/).fill("Casa comunal");
    await page.getByRole("button", { name: "Guardar evento" }).click();
    await expect(page.getByText("Evento registrado correctamente.")).toBeVisible();
    const idEvento = /\/eventos\/([0-9a-f-]{36})/.exec(page.url())?.[1];
    await page.getByRole("link", { name: "Tomar asistencia" }).click();
    await page.getByRole("button", { name: /Marcar todos presentes/ }).click();
    await page.getByRole("button", { name: "Guardar asistencia" }).click();
    await expect(page.getByText(/Asistencia guardada/)).toBeVisible();

    await page.goto("/servicios/nuevo");
    await page.getByLabel(/^Nombre del servicio/).fill("Riego general");
    await page.getByLabel(/^Tipo/).selectOption({ label: "Agua de riego" });
    await page.getByRole("button", { name: "Guardar servicio" }).click();
    await expect(page.getByText("Servicio registrado correctamente.")).toBeVisible();
    const idServicio = /\/servicios\/([0-9a-f-]{36})/.exec(page.url())?.[1];
    const f = page.getByRole("form", { name: "Agregar turno" });
    await f.getByLabel(/^Sector/).selectOption({ label: "Norte" });
    await f.getByLabel(/^Día/).selectOption({ label: "Martes" });
    await f.getByLabel(/^Hora de inicio/).fill("20:00");
    await f.getByLabel(/^Hora de fin/).fill("22:00");
    await f.getByRole("button", { name: "Agregar turno" }).click();
    await expect(page.getByRole("table", { name: "Turnos del servicio" }).getByRole("cell", { name: "20:00 – 22:00" })).toBeVisible();

    const pantallas: [string, string, string][] = [
      ["/socios", "Nómina de socios", "nómina de socios"],
      ["/socios/nuevo", "Nuevo socio", "nuevo socio"],
      ["/eventos", "Eventos y asistencia", "eventos"],
      ["/eventos/nuevo", "Nuevo evento", "nuevo evento"],
      [`/eventos/${idEvento}`, "Detalle del evento", "detalle de evento"],
      [`/eventos/${idEvento}/asistencia`, "Asistencia", "asistencia"],
      ["/predios", "Predios y mapa", "predios y mapa"],
      ["/predios/nuevo", "Nuevo predio", "nuevo predio"],
      [`/predios/${idPredio}`, "Ficha del predio", "ficha de predio"],
      ["/servicios", "Servicios y turnos", "servicios"],
      ["/servicios/nuevo", "Nuevo servicio", "nuevo servicio"],
      [`/servicios/${idServicio}`, "Servicio y turnos", "detalle de servicio"],
      ["/calendario", "Calendario semanal", "calendario (personal)"],
    ];
    for (const [ruta, titulo, nombre] of pantallas) {
      await page.goto(ruta);
      await expect(page, `Título de ${ruta}`).toHaveTitle(new RegExp(`^${titulo}`));
      await auditar(page, nombre);
    }

    // pantallas del Socio
    await entrarComo(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await crearCuentaYEntrar(page, slug, { cedula: "1710000033", nombres: "Ana Torres", rol: "socio", sufijo });
    await auditar(page, "/inicio (Socio)");
    for (const [ruta, titulo, nombre] of [
      ["/mi/informacion", "Mi información", "mi información"],
      ["/mi/asistencia", "Mi asistencia", "mi asistencia"],
      ["/predios", "Predios y mapa", "mis predios"],
      ["/calendario", "Calendario semanal", "calendario (Socio)"],
    ] as const) {
      await page.goto(ruta);
      await expect(page, `Título de ${ruta}`).toHaveTitle(new RegExp(`^${titulo}`));
      await auditar(page, nombre);
    }
  });

  test("pantallas del módulo financiero (Tesorero/a y Socio)", async ({ page }) => {
    test.setTimeout(480_000);
    const sufijo = Date.now().toString(36);
    const { slug } = await crearJuntaConAdmin(page, sufijo);
    await crearSectorUI(page, "Norte");
    await crearCuentaYEntrar(page, slug, { cedula: CEDULA_SECRETARIO, nombres: "Rosa Secretaria", rol: "secretario", sufijo });
    await crearSocioUI(page, { cedula: "1710000033", nombres: "Ana Torres", sector: "Norte" });

    await entrarComo(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await crearCuentaYEntrar(page, slug, { cedula: CEDULA_TESORERO, nombres: "Tomás Tesorero", rol: "tesorero", sufijo });

    // datos mínimos para que las pantallas tengan contenido
    await page.goto("/finanzas/conceptos");
    await page.getByLabel(/^Nombre/).fill("Cuota anual");
    await page.getByLabel(/^Tipo/).selectOption({ label: "Cuota" });
    await page.getByLabel(/^Monto por defecto/).fill("24");
    await page.getByRole("button", { name: "Crear concepto" }).click();
    await expect(page.getByText("Concepto creado.")).toBeVisible();

    await page.goto("/finanzas/cobros");
    await page.locator("summary", { hasText: "Emitir cargos" }).click();
    await page.locator("details").getByLabel(/^Concepto/).selectOption({ index: 1 });
    await page.getByRole("button", { name: "Emitir cargos" }).click();
    await expect(page.getByText(/Se emitieron 1 cargos/)).toBeVisible();
    await page.getByRole("link", { name: /Cobrar.*Ana Torres/ }).click();
    await expect(page).toHaveURL(/\/finanzas\/cobros\/[0-9a-f-]{36}/);
    const idCargo = /\/finanzas\/cobros\/([0-9a-f-]{36})/.exec(page.url())?.[1];
    await page.getByLabel(/^Monto/).fill("10");
    await page.getByRole("button", { name: "Registrar pago" }).click();
    await expect(page.getByText(/Pago registrado/)).toBeVisible();

    await page.goto("/finanzas/egresos");
    await page.locator("summary", { hasText: "Registrar egreso" }).click();
    await page.locator("details").getByLabel(/^Categoría/).selectOption({ label: "Tasas" });
    await page.locator("details").getByLabel(/^Descripción/).fill("Tasa de agua");
    await page.locator("details").getByLabel(/^Beneficiario/).fill("Empresa de agua");
    await page.locator("details").getByLabel(/^Monto/).fill("12,5");
    await page.getByRole("button", { name: "Registrar egreso" }).click();
    await expect(page.getByText("Egreso registrado.")).toBeVisible();

    await page.goto("/finanzas/inventario");
    await page.getByLabel(/^Nombre/).fill("Tubería PVC");
    await page.getByLabel(/^Unidad/).fill("m");
    await page.getByLabel(/^Stock inicial/).fill("20");
    await page.getByLabel(/^Stock mínimo/).fill("5");
    await page.getByRole("button", { name: "Registrar material" }).click();
    await expect(page.getByText("Material registrado.")).toBeVisible();

    await page.goto("/finanzas/activos");
    await page.getByLabel(/^Código/).fill("AF-001");
    await page.getByLabel(/^Nombre/).fill("Bomba de agua");
    await page.getByLabel(/^Fecha de adquisición/).fill("2024-01-15");
    await page.getByLabel(/^Valor de adquisición/).fill("850");
    await page.getByLabel(/^Ubicación/).fill("Bodega comunal");
    await page.getByRole("button", { name: "Registrar activo" }).click();
    await expect(page.getByText("Activo registrado.")).toBeVisible();

    const pantallas: [string, string, string][] = [
      ["/finanzas", "Resumen financiero", "resumen financiero"],
      ["/finanzas/conceptos", "Conceptos de cobro", "conceptos de cobro"],
      ["/finanzas/cobros", "Cuentas por cobrar", "cuentas por cobrar"],
      [`/finanzas/cobros/${idCargo}`, "Cargo y pagos", "detalle de cargo"],
      ["/finanzas/multas", "Multas por inasistencia", "multas"],
      ["/finanzas/egresos", "Egresos", "egresos"],
      ["/finanzas/reportes", "Reportes financieros", "reportes"],
      ["/finanzas/inventario", "Inventario", "inventario"],
      ["/finanzas/activos", "Activos fijos", "activos fijos"],
    ];
    for (const [ruta, titulo, nombre] of pantallas) {
      await page.goto(ruta);
      await expect(page, `Título de ${ruta}`).toHaveTitle(new RegExp(`^${titulo}`));
      await auditar(page, nombre);
    }

    // el Socio
    await entrarComo(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await crearCuentaYEntrar(page, slug, { cedula: "1710000033", nombres: "Ana Torres", rol: "socio", sufijo });
    await page.goto("/mi/estado-de-cuenta");
    await expect(page, "Título de /mi/estado-de-cuenta").toHaveTitle(/^Mi estado de cuenta/);
    await auditar(page, "mi estado de cuenta");
  });

  test("pantallas del módulo de comunicaciones (Secretario/a, Administrador y Socio)", async ({ page }) => {
    test.setTimeout(480_000);
    const sufijo = Date.now().toString(36);
    const { slug } = await crearJuntaConAdmin(page, sufijo);
    await crearSectorUI(page, "Norte");
    await crearCuentaYEntrar(page, slug, { cedula: CEDULA_SECRETARIO, nombres: "Rosa Secretaria", rol: "secretario", sufijo });
    await crearSocioUI(page, { cedula: "1710000033", nombres: "Ana Torres", sector: "Norte" });

    await page.goto("/convocatorias");
    await page.locator("summary", { hasText: "Emitir convocatoria" }).click();
    await page.locator("details").getByLabel(/^Tipo/).selectOption({ label: "Asamblea general" });
    await page.locator("details").getByLabel(/^Título/).fill("Asamblea general");
    await page.locator("details").getByLabel(/^Fecha/).fill("2030-01-15");
    await page.locator("details").getByLabel(/^Hora/).fill("18:00");
    await page.locator("details").getByLabel(/^Lugar/).fill("Casa comunal");
    await page.getByRole("button", { name: "Emitir convocatoria" }).click();
    await expect(page.getByText("Convocatoria emitida.")).toBeVisible();

    await page.goto("/documentos");
    await page.locator("summary", { hasText: "Archivar documento" }).click();
    await page.locator("details").getByLabel(/^Tipo de documento/).selectOption({ label: "Acta de asamblea" });
    await page.locator("details").getByLabel(/^Título/).fill("Acta de marzo");
    await page.locator("details").getByLabel(/^Archivo/).setInputFiles({ name: "acta.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") });
    await page.locator("details").getByLabel(/^Publicar para los socios/).check();
    await page.getByRole("button", { name: "Archivar documento" }).click();
    await expect(page.getByText("Documento archivado y publicado.")).toBeVisible();

    await page.goto("/comunicaciones");
    await page.locator("summary", { hasText: "Registrar comunicación" }).click();
    await page.locator("details").getByLabel(/^Institución/).fill("GAD Parroquial");
    await page.locator("details").getByLabel(/^Asunto/).fill("Reunión técnica");
    await page.locator("details").getByLabel(/^Resumen/).fill("Invitan a una reunión.");
    await page.locator("details").getByLabel(/^Publicar como comunicado/).check();
    await page.getByRole("button", { name: "Registrar comunicación" }).click();
    await expect(page.getByText("Comunicación registrada.")).toBeVisible();

    for (const [ruta, titulo, nombre] of [
      ["/convocatorias", "Convocatorias", "convocatorias (Secretario/a)"],
      ["/documentos", "Actas y resoluciones", "documentos (Secretario/a)"],
      ["/comunicaciones", "Comunicaciones recibidas", "comunicaciones recibidas"],
    ] as const) {
      await page.goto(ruta);
      await expect(page, `Título de ${ruta}`).toHaveTitle(new RegExp(`^${titulo}`));
      await auditar(page, nombre);
    }

    // el Socio escribe y el Administrador revisa su bandeja
    await entrarComo(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await crearCuentaYEntrar(page, slug, { cedula: "1710000033", nombres: "Ana Torres", rol: "socio", sufijo });
    await page.goto("/mensajes");
    await page.getByLabel(/^Asunto/).fill("Consulta");
    await page.getByLabel(/^Mensaje/).fill("Hola, tengo una consulta.");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.getByText("Mensaje enviado.")).toBeVisible();
    await auditar(page, "conversación (Socio)");
    for (const [ruta, titulo, nombre] of [
      ["/convocatorias", "Convocatorias", "convocatorias (Socio)"],
      ["/documentos", "Actas y resoluciones", "documentos (Socio)"],
      ["/comunicaciones", "Comunicaciones recibidas", "comunicados (Socio)"],
      ["/mensajes", "Mensajes", "bandeja de mensajes (Socio)"],
    ] as const) {
      await page.goto(ruta);
      await expect(page, `Título de ${ruta}`).toHaveTitle(new RegExp(`^${titulo}`));
      await auditar(page, nombre);
    }

    await entrarComo(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await page.goto("/mensajes");
    await expect(page.getByRole("table", { name: "Conversaciones" })).toBeVisible();
    await auditar(page, "bandeja de mensajes (Administrador)");
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
