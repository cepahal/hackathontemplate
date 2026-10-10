import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { backend, configReport, environments, frontend, venvPython } from "./common.mjs";

const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
    } else {
      try { process.kill(-child.pid, "SIGTERM"); } catch { /* The process may already have exited. */ }
    }
  }
}

function start(label, command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: "inherit", detached: process.platform !== "win32", windowsHide: true });
  children.push(child);
  child.once("error", () => { console.error(`${label} failed to start. Run npm run setup.`); stop(1); });
  child.once("exit", (code) => { if (!stopping) { console.error(`${label} stopped; shutting down the development servers.`); stop(code ?? 1); } });
}

try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--frontend-only")) throw new Error("Usage: npm run dev [-- --frontend-only]");
  const frontendOnly = args.includes("--frontend-only");
  const next = join(frontend, "node_modules", "next", "dist", "bin", "next");
  if (!existsSync(next) || (!frontendOnly && !existsSync(venvPython))) throw new Error("Dependencies missing. Run npm run setup first.");
  const { front, back } = environments();
  const blockers = configReport(front, back).filter((entry) => entry.level === "FAIL" && (!frontendOnly || entry.message.includes("secret")));
  if (blockers.length) throw new Error(`${blockers.map((entry) => entry.message).join("\n")}\nRun npm run doctor for details.`);

  process.once("SIGINT", () => stop(130));
  process.once("SIGTERM", () => stop(143));
  process.once("exit", () => stop(process.exitCode ?? 0));
  console.log("Frontend: http://localhost:3000 (loopback only)");
  if (frontendOnly) console.log("Public previews: http://localhost:3000/ui . Authentication and API features need real Supabase configuration.");
  if (!frontendOnly) {
    console.log("Backend: http://localhost:8000/api/v1/health (loopback only)");
    start("Backend", venvPython, ["-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"], backend);
  }
  start("Frontend", process.execPath, [next, "dev", "--hostname", "127.0.0.1", "--port", "3000"], frontend);
} catch (error) {
  console.error(error.message);
  stop(1);
}
