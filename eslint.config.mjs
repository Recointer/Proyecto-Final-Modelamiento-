import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  { ignores: [".next/", ".next-e2e/", "node_modules/", "drizzle/", "coverage/", ".claude/", ".specify/"] },
  ...coreWebVitals,
  ...typescript,
];


export default config;

