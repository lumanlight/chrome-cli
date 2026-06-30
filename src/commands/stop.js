import { connect } from 'net';
import { existsSync } from 'fs';
import { isDaemonRunning } from '../client.js';

export default async function stop(args, flags) {
  if (!isDaemonRunning()) {
    return 'Daemon is not running';
  }

  const uid = process.getuid?.() || 1000;
  const socketPath = `/tmp/chrome-cli-${uid}/server.sock`;
  const pidFile = `/tmp/chrome-cli-${uid}/daemon.pid`;

  return new Promise((resolve, reject) => {
    const client = connect(socketPath, () => {
      client.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'stop' }) + '\n');
    });

    const timer = setTimeout(() => {
      client.destroy();
      resolve('Daemon stopped (socket timeout, may need manual cleanup)');
    }, 5000);

    client.on('data', () => {
      clearTimeout(timer);
      client.end();
    });

    client.on('end', () => {
      clearTimeout(timer);
      const check = () => {
        if (!existsSync(pidFile)) {
          resolve('Daemon stopped');
        } else {
          setTimeout(check, 200);
        }
      };
      setTimeout(check, 500);
    });

    client.on('error', (err) => {
      clearTimeout(timer);
      resolve('Daemon stopped (socket error: ' + err.message + ')');
    });
  });
}
