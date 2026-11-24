import { expect, test } from "@playwright/test";
import {
  crearCuentaYEntrar,
  crearJuntaConAdmin,
  crearSectorUI,
  crearSocioUI,
  CEDULA_ADMIN,
  CEDULA_SECRETARIO,
  entrarComo,
  PASSWORD_ADMIN,
  SUPER_CORREO,
  SUPER_PASSWORD,
} from "./helpers";

const ANA = { cedula: "1710000033", nombres: "Ana Torres" };

test.describe("servicios, turnos y calendario (RF-12, RF-13)", () => {
  test.skip(!SUPER_CORREO || !SUPER_PASSWORD, "Defina E2E_SUPERADMIN_CORREO y E2E_SUPERADMIN_PASSWORD");
  test.setTimeout(420_000);

  test("el Secretario/a define turnos sin solapes y el Socio ve el calendario de su sector", async ({ page }) => {
    const sufijo = Date.now().toString(36);
    const { slug } = await crearJuntaConAdmin(page, sufijo);
    await crearSectorUI(page, "Norte");
    await crearSectorUI(page, "Sur");
    await crearCuentaYEntrar(page, slug, { cedula: CEDULA_SECRETARIO, nombres: "Rosa Secretaria", rol: "secretario", sufijo });
    await crearSocioUI(page, { ...ANA, sector: "Norte" });

    // --- servicios: vacío, validación y alta ---
    await page.getByRole("link", { name: "Servicios y turnos" }).click();
    await expect(page.getByText("Aún no hay servicios registrados")).toBeVisible();
    await page.getByRole("link", { name: "Nuevo servicio" }).click();
    await page.getByRole("button", { name: "Guardar servicio" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "nombre del servicio" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "tipo de servicio" })).toBeVisible();
    await page.getByLabel(/^Nombre del servicio/).fill("Riego canal norte");
    await page.getByLabel(/^Tipo/).selectOption({ label: "Agua de riego" });
    await page.getByRole("button", { name: "Guardar servicio" }).click();
    await expect(page.getByText("Servicio registrado correctamente.")).toBeVisible();
    const idServicio = /\/servicios\/([0-9a-f-]{36})/.exec(page.url())?.[1];
    expect(idServicio).toBeTruthy();

    // nombre repetido
    await page.goto("/servicios/nuevo");
    await page.getByLabel(/^Nombre del servicio/).fill("riego CANAL norte");
    await page.getByLabel(/^Tipo/).selectOption({ label: "Otro" });
    await page.getByRole("button", { name: "Guardar servicio" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Ya existe un servicio" })).toBeVisible();

    // --- turnos ---
    await page.goto(`/servicios/${idServicio}`);
    const tabla = page.getByRole("table", { name: "Turnos del servicio" });
    const turno = async (sector: string, dia: string, ini: string, fin: string, filasEsperadas?: number) => {
      const f = page.getByRole("form", { name: "Agregar turno" });
      await f.getByLabel(/^Sector/).selectOption({ label: sector });
      await f.getByLabel(/^Día/).selectOption({ label: dia });
      await f.getByLabel(/^Hora de inicio/).fill(ini);
      await f.getByLabel(/^Hora de fin/).fill(fin);
      await f.getByRole("button", { name: "Agregar turno" }).click();
      // espera a que el turno aparezca (el aviso de éxito anterior puede seguir en pantalla)
      if (filasEsperadas) await expect(tabla.getByRole("row")).toHaveCount(filasEsperadas);
    };

    await turno("Norte", "Martes", "20:00", "22:00", 2);
    await expect(page.getByText("Turno agregado.")).toBeVisible();
    await expect(tabla.getByRole("cell", { name: "20:00 – 22:00" })).toBeVisible();

    // fin anterior al inicio y solape
    await turno("Norte", "Martes", "10:00", "09:00");
    await expect(page.getByRole("alert").filter({ hasText: "posterior a la de inicio" })).toBeVisible();
    await turno("Norte", "Martes", "21:00", "23:00");
    await expect(page.getByRole("alert").filter({ hasText: "se solapa" })).toBeVisible();
    await expect(tabla.getByRole("row")).toHaveCount(2); // encabezado + 1 turno

    // contiguo y otro sector con el mismo horario son válidos
    await turno("Norte", "Martes", "22:00", "23:00", 3);
    await turno("Sur", "Martes", "20:00", "22:00", 4);

    // edición: choque con otro turno y cambio válido
    await tabla.getByRole("row", { name: /22:00 – 23:00/ }).getByRole("link", { name: /Editar/ }).click();
    const fe = page.getByRole("form", { name: "Editar turno" });
    await fe.getByLabel(/^Hora de inicio/).fill("21:00");
    await fe.getByRole("button", { name: "Guardar turno" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "se solapa" })).toBeVisible();
    await fe.getByLabel(/^Hora de inicio/).fill("22:30");
    await fe.getByRole("button", { name: "Guardar turno" }).click();
    await expect(page.getByText("Turno actualizado.")).toBeVisible();
    await expect(tabla.getByRole("cell", { name: "22:30 – 23:00" })).toBeVisible();

    // --- calendario por sector ---
    await page.getByRole("link", { name: "Calendario semanal" }).click();
    await expect(page.getByRole("heading", { name: "Calendario semanal" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Próximos turnos" })).toBeVisible();
    const semana = page.getByRole("table", { name: "Calendario semanal de turnos" });
    await expect(semana.getByText("Riego canal norte").first()).toBeVisible();
    await expect(semana.getByRole("row", { name: /Martes/ })).toContainText("20:00 – 22:00");
    await expect(semana.getByRole("row", { name: /Lunes/ })).toContainText("Sin turnos");

    // --- baja del servicio: desaparece del calendario ---
    await page.goto(`/servicios/${idServicio}`);
    await page.getByRole("button", { name: "Dar de baja" }).click();
    await page.getByRole("button", { name: "Sí, dar de baja" }).click();
    await expect(page.getByText(/Servicio dado de baja/)).toBeVisible();
    await page.goto("/calendario");
    await expect(page.getByText("Este sector aún no tiene turnos asignados.")).toBeVisible();
    await page.goto(`/servicios/${idServicio}`);
    await page.getByRole("button", { name: "Reactivar" }).click();
    await page.getByRole("button", { name: "Sí, reactivar" }).click();
    await expect(page.getByText("Servicio reactivado.")).toBeVisible();

    // --- eliminar un turno ---
    await tabla.getByRole("row", { name: /Sur/ }).getByRole("button", { name: "Eliminar" }).click();
    await page.getByRole("button", { name: "Sí, eliminar" }).click();
    await expect(page.getByText("Turno eliminado.")).toBeVisible();
    await expect(tabla.getByRole("row")).toHaveCount(3);

    // --- el Socio ve solo el calendario de su sector y no gestiona servicios ---
    await entrarComo(page, slug, CEDULA_ADMIN, PASSWORD_ADMIN);
    await crearCuentaYEntrar(page, slug, { cedula: ANA.cedula, nombres: ANA.nombres, rol: "socio", sufijo });
    await expect(page.getByRole("link", { name: "Servicios y turnos" })).toHaveCount(0);
    await page.getByRole("link", { name: "Calendario semanal" }).click();
    await expect(page.getByText("Sector Norte", { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Sector" })).toHaveCount(0);
    await expect(page.getByRole("table", { name: "Calendario semanal de turnos" }).getByRole("row", { name: /Martes/ })).toContainText("22:30 – 23:00");
    // aunque pida otro sector por la URL, se muestra el suyo
    await page.goto("/calendario?sectorId=00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("Sector Norte", { exact: true })).toBeVisible();
    await page.goto("/servicios");
    await expect(page).not.toHaveURL(/\/servicios$/);
  });
});
