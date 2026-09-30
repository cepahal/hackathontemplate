import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const backend = path.join(root, 'backend');
export const python = path.join(backend, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');

export function checkPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Port ${port} is already in use or unavailable. Stop its existing server before continuing.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

export function requireSetup() {
  if (!existsSync(python) || !existsSync(path.join(root, 'frontend/node_modules/next/package.json'))) {
    throw new Error('Dependencies are missing. Run npm run setup first (Windows, macOS, or Linux).');
  }
}

export function npmCommand(args) {
  const cli = process.env.npm_execpath;
  if (!cli || !existsSync(cli)) {
    throw new Error('Run this script through npm (for example: npm run dev).');
  }
  return [process.execPath, [cli, ...args]];
}

export function spawnProcess(command, args, options = {}) {
  return spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    detached: process.platform !== 'win32',
    ...options,
  });
}

export function stopProcess(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    killer.on('error', () => { child.kill(); });
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  }
}

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, args, options);
    const interrupt = () => stopProcess(child);
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    const cleanup = () => {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
    };
    child.once('error', (error) => { cleanup(); reject(error); });
    child.once('exit', (code, signal) => {
      cleanup();
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${signal ?? code}): ${command} ${args.join(' ')}`));
    });
  });
}
