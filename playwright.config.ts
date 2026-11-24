import { defineConfig } from "@playwright/test";

// Las E2E se ejecutan contra una compilación de PRODUCCIÓN en un puerto aparte (3100): el modo de
// desarrollo compila cada ruta bajo demanda y, con la máquina cargada, supera cualquier margen razonable.
const PUERTO = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  // las pruebas comparten la misma base de datos: se ejecutan en serie para evitar carreras
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PUERTO}` },
  webServer: {
    // la compilación la hace scripts/e2e.mjs (npm run test:e2e)
    command: `npx next start -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}/login`,
    reuseExistingServer: true,
    timeout: 300_000,
    env: { NEXT_DIST_DIR: ".next-e2e" },
  },
});
