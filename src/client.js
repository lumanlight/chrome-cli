import { connect } from 'net';
import { existsSync, readFileSync } from 'fs';
import { userInfo } from 'os';

function getSocketPath() {
  const uid = userInfo().uid;
  return `/tmp/chrome-cli-${uid}/server.sock`;
}

function getPidPath() {
  const uid = userInfo().uid;
  return `/tmp/chrome-cli-${uid}/daemon.pid`;
}

/**
 * Check if the daemon is running by reading the PID file and checking process existence
 */
export function isDaemonRunning() {
  const pidFile = getPidPath();
  if (!existsSync(pidFile)) return false;
  try {
    const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
    // Sending signal 0 checks if process exists without actually signaling it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Connect to the daemon and send a JSON-RPC call.
 * @param {string} tool - MCP tool name (e.g., "navigate_page", "click")
 * @param {object} args - Tool arguments
 * @param {object} [options]
 * @param {number} [options.timeout] - Timeout in ms (default: 30000)
 * @returns {Promise<object>} Response object
 */
export function callDaemon(tool, args = {}, options = {}) {
  const timeout = options.timeout ?? 30000;
  const socketPath = getSocketPath();

  return new Promise((resolve, reject) => {
    const client = connect(socketPath, () => {
      const msg = JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: tool, arguments: args }
      });
      client.write(msg + '\n');
    });

    let buf = '';
    const timer = setTimeout(() => {
      client.destroy();
      reject(new Error(`Timeout (${timeout}ms) waiting for response from daemon`));
    }, timeout);

    client.on('data', (data) => {
      buf += data.toString();
      const lines = buf.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const response = JSON.parse(trimmed);
          clearTimeout(timer);
          client.end();
          resolve(response.result !== undefined ? response.result : response);
          return;
        } catch {
          // Incomplete JSON, wait for more data
        }
      }
      buf = ''; // Partial data, keep waiting
    });

    client.on('error', (err) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(new Error(`Daemon not running. Start it with: chrome-cli start`));
      } else {
        reject(new Error(`Connection error: ${err.message}`));
      }
    });

    client.on('close', () => {
      clearTimeout(timer);
    });
  });
}

export default { callDaemon, isDaemonRunning };
