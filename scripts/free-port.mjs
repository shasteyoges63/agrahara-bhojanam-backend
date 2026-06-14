import { execSync } from 'child_process';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

function readPort() {
  try {
    const match = fs.readFileSync(envPath, 'utf-8').match(/^PORT=(\d+)/m);
    if (match) return Number(match[1]);
  } catch {
    // use default
  }
  return 4000;
}

const PORT = readPort();
const isWin = process.platform === 'win32';

async function portInUse(port) {
  const check = (host) =>
    new Promise((resolve) => {
      const socket = net.connect({ port, host }, () => {
        socket.end();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
      socket.setTimeout(1000, () => {
        socket.destroy();
        resolve(false);
      });
    });
  if (await check('127.0.0.1')) return true;
  if (await check('::1')) return true;
  return false;
}

function freePortWindows(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port}"`, { encoding: 'utf-8', shell: true });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
    }
    for (const pid of pids) {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore', shell: true });
    }
  } catch {
    // Port already free
  }
}

function freePortUnix(port) {
  try {
    const out = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' });
    for (const pid of out.trim().split('\n').filter(Boolean)) {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
  } catch {
    // Port already free
  }
}

async function main() {
  if (isWin) {
    freePortWindows(PORT);
    await new Promise((r) => setTimeout(r, 500));
    return;
  }
  if (!(await portInUse(PORT))) return;
  freePortUnix(PORT);
  await new Promise((r) => setTimeout(r, 500));
}

main();
