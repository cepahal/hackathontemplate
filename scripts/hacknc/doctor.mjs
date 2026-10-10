import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { backend, configured, configReport, environments, frontend, readEnv, root, venvPython } from "./common.mjs";

const { front, back } = environments();
const entries = configReport(front, back);
const photon = { ...readEnv(join(root, "services", "photon", ".env")) };
for (const name of ["SPECTRUM_PROJECT_ID", "SPECTRUM_PROJECT_SECRET"]) {
  if (process.env[name]) photon[name] = process.env[name];
}
const photonMissing = ["SPECTRUM_PROJECT_ID", "SPECTRUM_PROJECT_SECRET"].filter((name) => !configured(photon[name]));
entries.push({ level: photonMissing.length ? "INFO" : "OK", message: `Photon Spectrum: ${photonMissing.length ? `terminal mode ready; cloud mode needs ${photonMissing.join(", ")}` : "configured (cloud delivery not live verified)"}` });
const [major, minor] = process.versions.node.split(".").map(Number);
entries.unshift({ level: major > 20 || (major === 20 && minor >= 9) ? "OK" : "FAIL", message: "Node.js >=20.9 runtime" });
for (const [label, path] of [
  ["Frontend dependencies", join(frontend, "node_modules", "next", "dist", "bin", "next")],
  ["Frontend .env.local", join(frontend, ".env.local")],
  ["Backend virtual environment", venvPython],
  ["Backend .env", join(backend, ".env")],
]) entries.push({ level: existsSync(path) ? "OK" : "FAIL", message: `${label}: ${existsSync(path) ? "present" : "missing; run npm run setup"}` });

if (existsSync(venvPython)) {
  const result = spawnSync(venvPython, ["-c", "import fastapi, httpx, pydantic_settings, uvicorn"], { cwd: backend, stdio: "ignore", timeout: 10000, windowsHide: true });
  entries.push({ level: result.status === 0 ? "OK" : "FAIL", message: `Backend runtime imports: ${result.status === 0 ? "passed" : "failed; run npm run setup"}` });
}

console.log("Local configuration check. Credential values are never printed. No network calls are made.");
for (const entry of entries) console.log(`${entry.level}: ${entry.message}`);
console.log("Configured means a value exists; account activation, credits, model access, auth, and database migrations are not live verified.");
process.exitCode = entries.some((entry) => entry.level === "FAIL") ? 1 : 0;
