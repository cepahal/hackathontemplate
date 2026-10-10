import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { backend, configReport, environments, frontend, photonConfigReport, readEnv, root, venvPython } from "./common.mjs";

const { front, back } = environments();
const entries = configReport(front, back);
const photon = { ...readEnv(join(root, "services", "photon", ".env")) };
for (const name of ["SPECTRUM_PROJECT_ID", "SPECTRUM_PROJECT_SECRET", "GEMINI_API_KEY", "GEMINI_MODEL"]) {
  if (Object.hasOwn(process.env, name)) photon[name] = process.env[name];
}
const [major, minor] = process.versions.node.split(".").map(Number);
entries.push(...photonConfigReport(photon, { nodeMajor: major, spectrumInstalled: existsSync(join(root, "services", "photon", "node_modules", "spectrum-ts", "package.json")) }));
entries.unshift({ level: major > 20 || (major === 20 && minor >= 9) ? "OK" : "FAIL", message: "Node.js >=20.9 runtime" });
for (const [label, path] of [
  ["Frontend dependencies", join(frontend, "node_modules", "next", "dist", "bin", "next")],
  ["Frontend .env.local", join(frontend, ".env.local")],
  ["Backend virtual environment", venvPython],
  ["Backend .env", join(backend, ".env")],
]) entries.push({ level: existsSync(path) ? "OK" : "FAIL", message: `${label}: ${existsSync(path) ? "present" : "missing; run npm run setup"}` });

if (existsSync(venvPython)) {
  const result = spawnSync(venvPython, ["-c", "import fastapi, httpx, psycopg, pydantic_settings, uvicorn"], { cwd: backend, stdio: "ignore", timeout: 10000, windowsHide: true });
  entries.push({ level: result.status === 0 ? "OK" : "FAIL", message: `Backend runtime imports: ${result.status === 0 ? "passed" : "failed; run npm run setup"}` });
}

console.log("Local configuration check. Credential values are never printed. No network calls are made.");
for (const entry of entries) console.log(`${entry.level}: ${entry.message}`);
console.log("Configured means a value exists; account activation, credits, model access, auth, and database migrations are not live verified.");
process.exitCode = entries.some((entry) => entry.level === "FAIL") ? 1 : 0;
