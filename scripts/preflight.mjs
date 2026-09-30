import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { root, python, requireSetup } from './processes.mjs';
import { findPython, requireNode } from './setup.mjs';

let failed = false;
const ok = (message) => console.log(`OK:   ${message}`);
const warn = (message) => console.log(`WARN: ${message}`);
const fail = (message) => { console.error(`FAIL: ${message}`); failed = true; };

console.log('== Offline preflight ==');
try { requireNode(); ok('Node.js version'); } catch (error) { fail(error.message); }
try { requireSetup(); ok('Frontend dependencies and backend virtual environment'); } catch (error) { fail(error.message); }
if (existsSync(python)) {
  try { findPython([[python, []]]); ok('Project Python 3.11+'); } catch (error) { fail(error.message); }
}

for (const relative of ['AGENTS.md', 'frontend/package.json', 'backend/pyproject.toml',
  'backend/.env.example', 'frontend/.env.example']) {
  if (existsSync(path.join(root, relative))) ok(`${relative} present`);
  else fail(`${relative} missing`);
}

for (const [relative, keys] of [
  ['backend/.env', ['SUPABASE_URL', 'SUPABASE_ANON_KEY']],
  ['frontend/.env.local', ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']],
]) {
  const filename = path.join(root, relative);
  if (!existsSync(filename)) {
    warn(`${relative} missing; run npm run setup or configure the process environment.`);
    continue;
  }
  ok(`${relative} present (values not printed)`);
  const contents = readFileSync(filename, 'utf8');
  for (const key of keys) {
    const value = contents.match(new RegExp(`^\\s*${key}\\s*=([^\\r\\n]*)`, 'm'))?.[1]?.trim();
    if (!process.env[key]?.trim() && (!value || value === '""' || value === "''" || value.startsWith('#'))) {
      warn(`${key} is unset; authenticated hosted features are not ready.`);
    }
  }
}

console.log('This checks local prerequisites only; it does not run tests or verify credentials/services.');
console.log('Run npm run check for offline tests; database/README.md describes the two-account hosted RLS gate.');
console.log(failed ? '== Preflight FAILED ==' : '== Preflight passed (review any warnings) ==');
process.exitCode = failed ? 1 : 0;
