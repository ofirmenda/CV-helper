// Cross-platform port-freeing helper. Used by `npm run free-port` and
// automatically by `predev` so `npm run dev` never trips over a zombie
// process holding port 4000.
//
// Usage:
//   node scripts/free-port.mjs 4000
//   node scripts/free-port.mjs 4000 5173
//
// Prints what it killed (if anything) and always exits 0 — a free port is
// the success case, not an error.

import { execSync } from 'node:child_process';
import os from 'node:os';

const ports = process.argv.slice(2).filter(Boolean);
if (!ports.length) ports.push('4000');

const isWindows = os.platform() === 'win32';

function killOnWindows(port) {
  const cmd = [
    `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | `,
    `ForEach-Object { `,
    `  try { `,
    `    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; `,
    `    Write-Host ('  Killed PID ' + $_.OwningProcess + ' on port ${port}') `,
    `  } catch {} `,
    `}`,
  ].join('');
  try {
    execSync(`powershell -NoProfile -Command "${cmd}"`, { stdio: 'inherit' });
  } catch {
    // Non-fatal — port was probably already free.
  }
}

function killOnUnix(port) {
  try {
    const pids = execSync(`lsof -ti tcp:${port}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (pids) {
      execSync(`kill -9 ${pids.split('\n').join(' ')}`);
      console.log(`  Killed PIDs: ${pids.replace(/\n/g, ', ')} on port ${port}`);
    }
  } catch {
    // lsof exits non-zero when nothing matches — that's fine.
  }
}

for (const port of ports) {
  console.log(`Freeing port ${port}…`);
  if (isWindows) killOnWindows(port);
  else killOnUnix(port);
}
