import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { copyEnvironment, findPython, parseArguments, pythonCandidates, requireNode } from '../setup.mjs';

function fixture(t) {
  const base = path.resolve(os.tmpdir());
  const directory = mkdtempSync(path.join(base, 'starter setup test '));
  t.after(() => {
    assert.ok(path.resolve(directory).startsWith(`${base}${path.sep}starter setup test `));
    rmSync(directory, { recursive: true, force: true });
  });
  for (const app of ['backend', 'frontend']) {
    mkdirSync(path.join(directory, app));
    writeFileSync(path.join(directory, app, '.env.example'), `${app.toUpperCase()}_SETTING=default\n`);
  }
  return directory;
}

test('setup creates the two application env files and preserves user edits on rerun', (t) => {
  const directory = fixture(t);
  copyEnvironment(directory);
  assert.equal(readFileSync(path.join(directory, 'frontend/.env.local'), 'utf8'), 'FRONTEND_SETTING=default\n');
  const privateConfig = 'SUPABASE_ANON_KEY=test-only-sentinel\r\n# preserve exact bytes\r\n';
  writeFileSync(path.join(directory, 'backend/.env'), privateConfig);
  copyEnvironment(directory);
  assert.equal(readFileSync(path.join(directory, 'backend/.env'), 'utf8'), privateConfig);
});

test('setup repairs a missing app env without replacing an existing empty one', (t) => {
  const directory = fixture(t);
  writeFileSync(path.join(directory, 'backend/.env'), '');
  copyEnvironment(directory);
  assert.equal(readFileSync(path.join(directory, 'backend/.env'), 'utf8'), '');
  assert.equal(readFileSync(path.join(directory, 'frontend/.env.local'), 'utf8'), 'FRONTEND_SETTING=default\n');
});

test('missing environment templates are errors, not successful setup', (t) => {
  const directory = fixture(t);
  rmSync(path.join(directory, 'frontend/.env.example'));
  assert.throws(() => copyEnvironment(directory), { code: 'ENOENT' });
});

test('Python discovery skips missing, outdated, and timed-out runtimes', () => {
  const candidates = [['missing', []], ['old', []], ['hung', []], ['py', ['-3']]];
  const outcomes = [
    { error: new Error('ENOENT'), status: null }, { status: 1 },
    { error: new Error('ETIMEDOUT'), status: null }, { status: 0 },
  ];
  const calls = [];
  assert.deepEqual(findPython(candidates, (command, args, options) => {
    calls.push([command, args]);
    assert.equal(options.stdio, 'ignore');
    assert.equal(options.timeout, 10000);
    return outcomes.shift();
  }), ['py', ['-3']]);
  assert.deepEqual(calls[3][1].slice(0, 2), ['-3', '-c']);
});

test('explicit Python paths with spaces are single executables and never fall back silently', () => {
  const executable = '/a path with spaces/python3';
  const candidates = pythonCandidates(executable, 'darwin');
  assert.deepEqual(candidates, [[executable, []]]);
  assert.throws(() => findPython(candidates, (command) => {
    assert.equal(command, executable);
    return { status: 1 };
  }), /Python 3.11\+/);
});

test('POSIX discovery prefers python3 and does not invoke Windows launchers', () => {
  for (const platform of ['darwin', 'linux']) {
    assert.deepEqual(pythonCandidates(undefined, platform), [['python3', []], ['python', []]]);
  }
  assert.deepEqual(pythonCandidates(undefined, 'win32').slice(0, 3), [['python', []], ['python3', []], ['py', ['-3']]]);
});

test('Node version requirement rejects old runtimes', () => {
  for (const version of ['20.19.0', '22.18.0', 'invalid']) assert.throws(() => requireNode(version));
  for (const version of ['22.19.0', '24.0.0', '25.0.0']) assert.doesNotThrow(() => requireNode(version));
});

test('setup rejects malformed CLI arguments before making changes', () => {
  assert.equal(parseArguments([]), undefined);
  assert.equal(parseArguments(['--python', '/path/python']), '/path/python');
  for (const args of [['--python'], ['--unknown'], ['--python', 'python', 'extra']]) {
    assert.throws(() => parseArguments(args), /Usage:/);
  }
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../setup.mjs', import.meta.url)), '--unknown'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
});

test('preflight inspects app folders, rejects missing dependencies, and never prints config values', (t) => {
  const directory = fixture(t);
  mkdirSync(path.join(directory, 'scripts'));
  for (const file of ['preflight.mjs', 'setup.mjs', 'processes.mjs']) {
    copyFileSync(new URL(`../${file}`, import.meta.url), path.join(directory, 'scripts', file));
  }
  for (const file of ['AGENTS.md', 'frontend/package.json', 'backend/pyproject.toml']) {
    writeFileSync(path.join(directory, file), '');
  }
  writeFileSync(path.join(directory, '.env.example'), 'STALE_ROOT=do-not-use-this\n');
  writeFileSync(path.join(directory, 'backend/.env'), 'SUPABASE_URL=https://test.invalid\nSUPABASE_ANON_KEY=private-sentinel-do-not-print\n');
  const result = spawnSync(process.execPath, [path.join(directory, 'scripts/preflight.mjs')], { encoding: 'utf8' });
  const output = result.stdout + result.stderr;
  assert.equal(result.status, 1);
  assert.match(output, /Dependencies are missing/);
  assert.match(output, /backend\/\.env present/);
  assert.match(output, /frontend\/\.env.local missing/);
  assert.doesNotMatch(output, /private-sentinel|test\.invalid|STALE_ROOT|copy from \.env.example/);
});
