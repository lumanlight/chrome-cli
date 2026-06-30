import { existsSync, readFileSync } from 'fs';
import { isDaemonRunning } from '../client.js';

export default async function status(args, flags) {
  const uid = process.getuid?.() || 1000;
  const pidFile = `/tmp/chrome-cli-${uid}/daemon.pid`;
  const sockPath = `/tmp/chrome-cli-${uid}/server.sock`;

  if (!isDaemonRunning()) {
    return 'chrome-cli daemon is not running';
  }

  let pid = 'unknown';
  try { pid = readFileSync(pidFile, 'utf-8').trim(); } catch {}

  let sockStatus = 'no';
  try {
    if (existsSync(sockPath)) sockStatus = 'yes';
  } catch {}

  return [
    `chrome-cli daemon is running`,
    `  PID:      ${pid}`,
    `  Socket:   ${sockPath} (${sockStatus})`,
    `  PID File: ${pidFile}`,
  ].join('\n');
}
