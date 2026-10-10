import { constants, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { backend, findPython, frontend, npmCommand, root, run, venvPython } from "./common.mjs";

try {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const pythonIndex = args.indexOf("--python");
  const python = pythonIndex === -1 ? process.env.PYTHON_BIN : args[pythonIndex + 1];
  const allowed = args.filter((arg, index) => arg !== "--dry-run" && arg !== "--python" && !(pythonIndex !== -1 && index === pythonIndex + 1));
  if (allowed.length || (pythonIndex !== -1 && (!python || python.startsWith("--")))) throw new Error("Usage: npm run setup -- [--dry-run] [--python <python-path>]");

  for (const [directory, filename] of [[frontend, ".env.local"], [backend, ".env"]]) {
    const destination = join(directory, filename);
    if (existsSync(destination)) console.log(`Preserving existing ${directory.endsWith("frontendFINAL") ? "frontend" : "backend"} ${filename}.`);
    else if (dryRun) console.log(`Would copy .env.example to ${filename}.`);
    else {
      copyFileSync(join(directory, ".env.example"), destination, constants.COPYFILE_EXCL);
      console.log(`Created ${filename} from .env.example. Credentials remain unset.`);
    }
  }

  if (dryRun) {
    console.log("Would run npm ci in frontendFINAL, create backendFINAL/.venv if absent, and install requirements-dev.txt.");
    console.log("Existing environment files are never overwritten. No changes made.");
  } else {
    const [npm, npmArgs] = npmCommand(["ci", "--cache", join(root, ".npm-cache")]);
    run(npm, npmArgs, frontend);
    if (!existsSync(venvPython)) {
      const [command, prefix] = findPython(python);
      run(command, [...prefix, "-m", "venv", ".venv"], backend);
    }
    run(venvPython, ["-m", "pip", "install", "--no-cache-dir", "-r", "requirements-dev.txt"], backend);
    console.log("Dependencies installed. Fill the ignored .env files, then run npm run doctor.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
