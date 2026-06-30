import { spawn } from 'child_process';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { isDaemonRunning } from '../client.js';

export default async function start(args, flags) {
  // Clean up stale artifacts from previous crashed daemon
  const uid = process.getuid?.() || 1000;
  const baseDir = `/tmp/chrome-cli-${uid}`;
  const pidFile = `${baseDir}/daemon.pid`;
  const sockPath = `${baseDir}/server.sock`;

  if (!isDaemonRunning()) {
    try { unlinkSync(pidFile); } catch {}
    try { unlinkSync(sockPath); } catch {}
  }

  if (isDaemonRunning()) {
    let pid = 'unknown';
    try { pid = readFileSync(pidFile, 'utf-8').trim(); } catch {}
    return `Daemon is already running (PID: ${pid})`;
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const daemonPath = join(__dirname, '..', 'daemon.js');

  const daemonArgs = [daemonPath];
  const browserUrl = flags['browser-url'] || process.env.CHROME_CLI_BROWSER_URL;
  if (browserUrl) {
    daemonArgs.push('--browser-url', browserUrl);
  }

  const child = spawn(process.execPath, daemonArgs, {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
    cwd: process.cwd(),
  });
  child.unref();

  const startTime = Date.now();
  while (Date.now() - startTime < 5000) {
    if (existsSync(pidFile)) {
      try {
        const pid = readFileSync(pidFile, 'utf-8').trim();
        return `Daemon started (PID: ${pid})`;
      } catch {}
    }
    await new Promise(r => setTimeout(r, 200));
  }

  throw new Error('Daemon failed to start within 5 seconds. Check logs for details.');
}
