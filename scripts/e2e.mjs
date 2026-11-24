// Ejecuta las pruebas E2E: compila la app en .next-e2e (salvo E2E_SKIP_BUILD=1) y lanza Playwright.
// Se separa la compilación del arranque del servidor porque, con poca memoria libre, compilar
// dentro de Playwright puede fallar.
import { spawnSync } from "node:child_process";

process.loadEnvFile(".env");
process.env.NEXT_DIST_DIR = ".next-e2e";

const ejecutar = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (process.env.E2E_SKIP_BUILD !== "1") ejecutar("npx", ["next", "build"]);
ejecutar("node", ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)]);
