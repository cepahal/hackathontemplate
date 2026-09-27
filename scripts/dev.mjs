import { backend, checkPort, npmCommand, python, requireSetup, spawnProcess, stopProcess } from './processes.mjs';

const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) stopProcess(child);
}

function launch(label, command, args, options) {
  const child = spawnProcess(command, args, options);
  children.push(child);
  child.once('error', (error) => { console.error(`${label}: ${error.message}`); stop(1); });
  child.once('exit', (code, signal) => {
    if (!stopping) {
      console.error(`${label} stopped (${signal ?? code}). Shutting down the other service.`);
      stop(code || 1);
    }
  });
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

try {
  requireSetup();
  const target = process.argv[2] ?? 'all';
  if (!['all', 'frontend', 'backend'].includes(target)) throw new Error('Expected frontend, backend, or no argument.');
  const startFrontend = target !== 'backend';
  const startBackend = target !== 'frontend';
  await Promise.all([...(startFrontend ? [checkPort(3000)] : []), ...(startBackend ? [checkPort(8000)] : [])]);
  if (startBackend) {
    launch('Backend', python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--reload', '--reload-dir', 'app'], { cwd: backend });
  }
  if (startFrontend) {
    const [command, args] = npmCommand(['--prefix', 'frontend', 'run', 'dev', '--', '--port', '3000']);
    launch('Frontend', command, args);
  }
  console.log('\nHackathon starter starting locally.');
  if (startFrontend) console.log('Frontend: http://localhost:3000');
  if (startBackend) console.log('API:      http://localhost:8000/health\nAPI docs: http://localhost:8000/docs');
  console.log('Press Ctrl+C to stop both services.\n');
} catch (error) {
  console.error(error.message);
  stop(1);
}
