import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');
const dataDir = path.join(backendRoot, 'data', 'db');
const logPath = path.join(backendRoot, 'data', 'mongod.log');
const isWin = process.platform === 'win32';

const MONGOD_CANDIDATES = [
  process.env.MONGOD_PATH,
  'C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongod.exe',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe',
  'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe',
].filter(Boolean);

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

async function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await portOpen(port)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`MongoDB did not start on port ${port}`);
}

function resolveMongod() {
  for (const candidate of MONGOD_CANDIDATES) {
    try {
      if (candidate && candidate.length > 0) return candidate;
    } catch {
      /* continue */
    }
  }
  return isWin ? 'mongod.exe' : 'mongod';
}

async function main() {
  if (await portOpen(27017)) {
    return;
  }

  const mongod = resolveMongod();
  console.log('Starting MongoDB...');

  const child = spawn(
    mongod,
    [
      '--dbpath', dataDir,
      '--bind_ip', '127.0.0.1',
      '--port', '27017',
      '--logpath', logPath,
      '--logappend',
    ],
    {
      cwd: backendRoot,
      detached: true,
      stdio: 'ignore',
      shell: isWin,
      windowsHide: true,
    },
  );

  child.unref();
  await waitForPort(27017);
  console.log('MongoDB ready on mongodb://127.0.0.1:27017');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
