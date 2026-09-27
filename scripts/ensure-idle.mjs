import { checkPort } from './processes.mjs';

try {
  await Promise.all([checkPort(3000), checkPort(8000)]);
} catch (error) {
  console.error(`${error.message} Setup and checks require the development servers to be stopped.`);
  process.exitCode = 1;
}
