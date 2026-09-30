import { spawnSync } from 'node:child_process';
import { constants, copyFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { backend, checkPort, npmCommand, python, root, run } from './processes.mjs';

const versionProbe = 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)';

export function requireNode(version = process.versions.node) {
  const [major, minor] = version.split('.').map(Number);
  if (!Number.isInteger(major) || !Number.isInteger(minor) || major < 22 || (major === 22 && minor < 19)) {
    throw new Error('Node.js 22.19 or newer is required. Install a current LTS release.');
  }
}

export function pythonCandidates(explicit, platform = process.platform, home = os.homedir()) {
  if (explicit) return [[explicit, []]];
  const candidates = platform === 'win32'
    ? [['python', []], ['python3', []], ['py', ['-3']]]
    : [['python3', []], ['python', []]];
  if (platform === 'win32') {
    candidates.push([path.join(home, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe'), []]);
  }
  return candidates;
}

export function findPython(candidates, probe = spawnSync) {
  for (const [command, prefix] of candidates) {
    const result = probe(command, [...prefix, '-c', versionProbe], {
      stdio: 'ignore', windowsHide: true, timeout: 10000,
    });
    if (!result.error && result.status === 0) return [command, prefix];
  }
  throw new Error('Python 3.11+ was not found. Install Python with venv support, or run npm run setup -- --python /path/to/python.');
}

export function copyEnvironment(projectRoot = root) {
  for (const [example, local] of [
    ['backend/.env.example', 'backend/.env'],
    ['frontend/.env.example', 'frontend/.env.local'],
  ]) {
    try {
      // Exclusive creation also protects files created by another process during setup.
      copyFileSync(path.join(projectRoot, example), path.join(projectRoot, local), constants.COPYFILE_EXCL);
      console.log(`Created ${local} from its example.`);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
}

export function parseArguments(args) {
  if (args.length === 0) return undefined;
  if (args.length === 2 && args[0] === '--python' && args[1]) return args[1];
  throw new Error('Usage: npm run setup [-- --python /path/to/python]');
}

export async function setup(args = process.argv.slice(2)) {
  const explicitPython = parseArguments(args);
  requireNode();
  // Resolve npm before making changes; invoking npm through Node works on all platforms.
  const npmArgs = ['--prefix', 'frontend', '--cache', process.env.npm_config_cache || path.join(root, '.artifacts', 'npm-cache'),
    existsSync(path.join(root, 'frontend', 'package-lock.json')) ? 'ci' : 'install'];
  const [npmExecutable, npmArguments] = npmCommand(npmArgs);
  await Promise.all([checkPort(3000), checkPort(8000)]);

  if (existsSync(python)) {
    // Never silently replace an existing environment or ignore an outdated interpreter.
    findPython([[python, []]]);
    console.log('Reusing backend/.venv. To change interpreters, recreate that environment first.');
  } else {
    const [command, prefix] = findPython(pythonCandidates(explicitPython));
    console.log('Creating the project-only Python environment...');
    await run(command, [...prefix, '-m', 'venv', path.join(backend, '.venv')]);
    findPython([[python, []]]);
  }

  console.log('Installing backend dependencies...');
  await run(python, ['-m', 'pip', 'install', '--no-cache-dir', '-r', 'requirements-dev.txt'], { cwd: backend });
  console.log('Installing frontend dependencies...');
  // Trust OS certificates without disabling TLS or changing the caller's environment.
  const nodeOptions = process.env.NODE_OPTIONS || '';
  const env = { ...process.env,
    NODE_OPTIONS: /(^|\s)--use-system-ca(\s|$)/.test(nodeOptions) ? nodeOptions : `${nodeOptions} --use-system-ca`.trim(),
  };
  await run(npmExecutable, npmArguments, { env });
  copyEnvironment();
  console.log('Setup complete. Run npm run preflight, then npm run check.');
  console.log('No preview server was started. Configure hosted services separately; see database/README.md.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setup().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
