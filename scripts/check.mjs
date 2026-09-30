import { backend, checkPort, npmCommand, python, requireSetup, run } from './processes.mjs';

try {
  requireSetup();
  await Promise.all([checkPort(3000), checkPort(8000)]);
  console.log('\nChecking setup/preflight scripts');
  const [scriptCommand, scriptArgs] = npmCommand(['run', 'test:scripts']);
  await run(scriptCommand, scriptArgs);
  for (const task of ['lint', 'typecheck', 'test', 'build']) {
    console.log(`\nChecking frontend: ${task}`);
    const [command, args] = npmCommand(['--prefix', 'frontend', 'run', task]);
    await run(command, args);
  }
  console.log('\nChecking backend: lint');
  await run(python, ['-m', 'ruff', 'check', '.'], { cwd: backend });
  await run(python, ['-m', 'ruff', 'format', '--check', '.'], { cwd: backend });
  console.log('\nChecking backend: tests');
  await run(python, ['-m', 'pytest', '-q'], { cwd: backend });
  await run(python, ['-m', 'pip', 'check'], { cwd: backend });
  console.log('\nAll offline starter checks passed. Hosted acceptance remains separate.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
