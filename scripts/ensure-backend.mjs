import { spawn } from 'child_process';

import dotenv from 'dotenv';

import net from 'net';

import path from 'path';

import { fileURLToPath } from 'url';



const __dirname = path.dirname(fileURLToPath(import.meta.url));

const backendRoot = path.join(__dirname, '..');

const frontendRoot = path.join(backendRoot, '..', 'frontend');



dotenv.config({ path: path.join(backendRoot, '.env') });

dotenv.config({ path: path.join(frontendRoot, '.env') });



const PORT = Number(process.env.PORT) || 4000;
const isWin = process.platform === 'win32';
const quiet = process.argv.includes('--quiet') || process.argv.includes('-q');

function log(...args) {
  if (!quiet) console.log(...args);
}



function portOpen(port, host = '127.0.0.1') {

  return new Promise((resolve) => {

    const socket = net.connect({ port, host }, () => {

      socket.end();

      resolve(true);

    });

    socket.on('error', () => resolve(false));

    socket.setTimeout(1500, () => {

      socket.destroy();

      resolve(false);

    });

  });

}



async function waitForPort(port, timeoutMs = 60000) {

  const start = Date.now();

  while (Date.now() - start < timeoutMs) {

    if (await portOpen(port)) return;

    await new Promise((r) => setTimeout(r, 500));

  }

  throw new Error(`Backend did not start on http://localhost:${port}`);

}



async function main() {

  if (await portOpen(PORT)) {
    log(`Backend already running on http://localhost:${PORT}`);
    return;
  }

  log('Starting backend API...');

  const nodeBin = process.execPath;

  const child = spawn(nodeBin, ['src/index.js'], {

    cwd: backendRoot,

    detached: true,

    stdio: 'ignore',

    shell: isWin,

    windowsHide: true,

    env: process.env,

  });

  child.unref();



  await waitForPort(PORT);
  log(`Backend ready on http://localhost:${PORT}`);

}



main().catch((err) => {

  console.error(err.message);

  process.exit(1);

});


