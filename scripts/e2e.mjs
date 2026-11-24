// Ejecuta las pruebas E2E: compila la app en .next-e2e (salvo E2E_SKIP_BUILD=1) y lanza Playwright.
// Se separa la compilación del arranque del servidor porque, con poca memoria libre, compilar
// dentro de Playwright puede fallar.
import { spawnSync } from "node:child_process";

process.loadEnvFile(".env");
process.env.NEXT_DIST_DIR = ".next-e2e";
// Clave simulada solo para la compilación de pruebas: las E2E interceptan las llamadas a Google Maps
// (no sale tráfico real). Si el .env tiene una clave real, se respeta.
process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||= "clave-e2e-simulada";

const ejecutar = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (process.env.E2E_SKIP_BUILD !== "1") ejecutar("npx", ["next", "build"]);
ejecutar("node", ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)]);
