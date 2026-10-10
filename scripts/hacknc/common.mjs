import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const frontend = join(root, "finalfrontentbackend", "frontendFINAL");
export const backend = join(root, "finalfrontentbackend", "backendFINAL");
export const venvPython = join(backend, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");

export function readEnv(path) {
  if (!existsSync(path)) return {};
  const result = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      const end = value.indexOf(value[0], 1);
      if (end !== -1) value = value.slice(1, end);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    result[match[1]] = value;
  }
  return result;
}

export function configured(value) {
  return Boolean(value?.trim()) && !/your[-_ ]|replace[-_ ]?me|<[^>]+>|example\.com|project-ref/i.test(value);
}

export function secretPublicKey(value = "") {
  value = value.trim();
  if (value.startsWith("sb_secret_")) return true;
  try {
    return JSON.parse(Buffer.from(value.split(".")[1] ?? "", "base64url").toString()).role === "service_role";
  } catch {
    return false;
  }
}

export function configReport(front, back) {
  const entries = [];
  const frontKeyName = front.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
  const frontKey = (front.NEXT_PUBLIC_SUPABASE_ANON_KEY || front.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)?.trim();
  const required = (name, value) => entries.push({ level: configured(value) ? "OK" : "FAIL", message: `${name}: ${configured(value) ? "configured (not live verified)" : "missing or placeholder"}` });
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_API_URL"]) required(name, front[name]);
  required(frontKey ? frontKeyName : "NEXT_PUBLIC_SUPABASE_ANON_KEY", frontKey);
  for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY"]) required(name, back[name]);
  if ([front.NEXT_PUBLIC_SUPABASE_URL, frontKey, back.SUPABASE_URL, back.SUPABASE_ANON_KEY].some((value) => !configured(value))) {
    entries.push({ level: "INFO", message: "Supabase auth: backend startup, sign-in, and protected API routes require the matching project URL and public key; optional provider credentials do not replace them" });
  }

  for (const [name, value] of [["NEXT_PUBLIC_SUPABASE_ANON_KEY", front.NEXT_PUBLIC_SUPABASE_ANON_KEY], ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", front.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY], ["SUPABASE_ANON_KEY", back.SUPABASE_ANON_KEY]]) {
    if (secretPublicKey(value)) entries.push({ level: "FAIL", message: `${name}: secret/service-role key detected; use a public publishable/anon key` });
  }
  for (const [name, value] of Object.entries(front)) {
    if (name.startsWith("NEXT_PUBLIC_") && /SERVICE_ROLE|SECRET|API_KEY|TOKEN|WEBHOOK/.test(name) && configured(value)) {
      entries.push({ level: "FAIL", message: `${name}: possible secret in browser configuration; move secrets to backend .env` });
    }
  }
  for (const [frontName, frontValue, backName] of [["NEXT_PUBLIC_SUPABASE_URL", front.NEXT_PUBLIC_SUPABASE_URL, "SUPABASE_URL"], [frontKeyName, frontKey, "SUPABASE_ANON_KEY"]]) {
    if (configured(frontValue) && configured(back[backName]) && frontValue.replace(/\/$/, "") !== back[backName].replace(/\/$/, "")) {
      entries.push({ level: "FAIL", message: `${frontName} and ${backName}: values do not match` });
    }
  }
  for (const [label, names] of [
    ["Gemini AI", ["GEMINI_API_KEY", "GEMINI_MODEL"]],
    ["OpenAI", ["OPENAI_API_KEY", "OPENAI_MODEL"]],
    ["Anthropic", ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"]],
    ["xAI/Grok", ["GROK_API_KEY", "GROK_MODEL"]],
    ["GitHub", ["GITHUB_TOKEN"]],
    ["Capital One Nessie", ["NESSIE_API_KEY"]],
    ["Snowflake SQL API", ["SNOWFLAKE_ACCOUNT_HOST", "SNOWFLAKE_TOKEN"]],
    ["Snowflake Cortex AI", ["SNOWFLAKE_ACCOUNT_HOST", "SNOWFLAKE_TOKEN"]],
    ["Tiger Data PostgreSQL", ["TIGERDATA_DSN"]],
    ["Maps", ["MAPS_API_KEY", "MAPS_PROVIDER"]],
    ["Resend email", ["RESEND_API_KEY", "EMAIL_FROM"]],
    ["Slack", ["SLACK_WEBHOOK_URL"]],
    ["Discord", ["DISCORD_WEBHOOK_URL"]],
  ]) {
    const missing = names.filter((name) => !configured(back[name]));
    entries.push({ level: missing.length ? "INFO" : "OK", message: `${label}: ${missing.length ? `optional; set ${missing.join(", ")}` : "configured (not live verified)"}` });
  }
  return entries;
}

export function photonConfigReport(values, { nodeMajor, spectrumInstalled }) {
  const missingRuntime = [];
  if (nodeMajor < 24) missingRuntime.push("Node.js >=24");
  if (!spectrumInstalled) missingRuntime.push("SDK dependencies; run npm --prefix services/photon ci");
  const missingCredentials = ["SPECTRUM_PROJECT_ID", "SPECTRUM_PROJECT_SECRET"].filter((name) => !configured(values[name]));
  const hasGeminiKey = configured(values.GEMINI_API_KEY);
  return [
    { level: missingRuntime.length ? "INFO" : "OK", message: `Photon runtime: ${missingRuntime.length ? `optional; needs ${missingRuntime.join("; ")}` : "Node.js >=24 and SDK present (transport not live verified)"}` },
    { level: missingCredentials.length ? "INFO" : "OK", message: `Photon Spectrum credentials: ${missingCredentials.length ? `optional; set ${missingCredentials.join(", ")}` : "configured (phone enrollment, plan access, and delivery not live verified)"}` },
    { level: hasGeminiKey ? "OK" : "INFO", message: `Photon Gemini: ${hasGeminiKey ? "configured in service environment (generation not live verified)" : "transport-only replies; set GEMINI_API_KEY in services/photon/.env to enable text generation"}` },
  ];
}

export function environments() {
  const front = { ...readEnv(join(frontend, ".env.local")), ...process.env };
  const back = readEnv(join(backend, ".env"));
  // Pydantic ignores empty environment overrides; Next.js gives the shell priority.
  for (const [name, value] of Object.entries(process.env)) if (value) back[name] = value;
  return { front, back };
}

export function npmCommand(args) {
  const npmCli = process.env.npm_execpath || join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  if (!existsSync(npmCli)) throw new Error("npm CLI not found. Run this command through npm run, or install Node.js with npm.");
  // Node 24 can use Windows/macOS system trust, including managed-network certificates.
  const trust = Number(process.versions.node.split(".")[0]) >= 24 ? ["--use-system-ca"] : [];
  return [process.execPath, [...trust, npmCli, ...args]];
}

export function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`Command failed: ${command} (exit ${result.status ?? "unavailable"})`);
}

export function findPython(explicit) {
  const bundled = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", process.platform === "win32" ? "python.exe" : "bin/python3");
  const candidates = explicit ? [[explicit, []]] : [
    ...(existsSync(bundled) ? [[bundled, []]] : []),
    ["py", ["-3"]], ["python3", []], ["python", []],
  ];
  for (const [command, args] of candidates) {
    const result = spawnSync(command, [...args, "-c", "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)"], { timeout: 5000, windowsHide: true, stdio: "ignore" });
    if (!result.error && result.status === 0) return [command, args];
  }
  throw new Error("Python >=3.11 not found. Use npm run setup -- --python <absolute-path-to-python>.");
}
