/**
 * @fileoverview chrome-cli daemon — Unix socket → MCP Server stdio bridge
 *
 * Architecture:
 *   daemon.js  ──spawns──►  npx chrome-devtools-mcp (stdio)
 *       │
 *       ├── Unix socket /tmp/chrome-cli-<uid>/server.sock
 *       ├── PID file   /tmp/chrome-cli-<uid>/daemon.pid
 *       └── Log file   /tmp/chrome-cli-<uid>/daemon.log
 *
 * Clients connect to the Unix socket, send JSON-RPC messages.
 * The daemon forwards them one-at-a-time to the MCP Server's stdin
 * and routes responses back to the originating client socket.
 *
 * Special message { method: "stop" } triggers graceful shutdown.
 */

import { createServer } from 'net';
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync, appendFileSync, unlinkSync, existsSync } from 'fs';
import { userInfo } from 'os';
import { join } from 'path';

function getPaths() {
  const uid = userInfo().uid;
  const baseDir = `/tmp/chrome-cli-${uid}`;
  return {
    baseDir,
    pidFile: join(baseDir, 'daemon.pid'),
    sockPath: join(baseDir, 'server.sock'),
    logFile: join(baseDir, 'daemon.log'),
  };
}

let _logFile = '';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  if (_logFile) {
    try { appendFileSync(_logFile, line + '\n'); } catch {}
  }
  console.error(line);
}

function parseArgs(args) {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--browser-url' && i + 1 < args.length) {
      opts.browserUrl = args[++i];
    }
  }
  return opts;
}

export function startDaemon(options = {}) {
  const { baseDir, pidFile, sockPath, logFile } = getPaths();
  _logFile = logFile;

  mkdirSync(baseDir, { recursive: true, mode: 0o700 });
  writeFileSync(pidFile, String(process.pid));
  log(`PID file written: ${pidFile}`);

  const mcpArgs = ['-y', 'chrome-devtools-mcp@latest', '--no-usage-statistics'];
  if (options.browserUrl) {
    mcpArgs.push('--browser-url', options.browserUrl);
  }
  log(`Spawning: npx ${mcpArgs.join(' ')}`);

  /** @type {import('child_process').ChildProcess} */
  const mcp = spawn('npx', mcpArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  log(`MCP Server started (PID: ${mcp.pid})`);

  mcp.stderr.on('data', (data) => {
    for (const line of data.toString().split('\n').filter(Boolean)) {
      log(`[MCP:err] ${line}`);
    }
  });

  mcp.on('exit', (code, signal) => {
    log(`MCP Server exited (code: ${code}, signal: ${signal})`);
    cleanup(true);
  });

  mcp.on('error', (err) => {
    log(`MCP Server error: ${err.message}`);
  });

  /** @type {{ client: import('net').Socket, resolve: (value: unknown) => void }[]} */
  const requestQueue = [];
  let processing = false;
  let currentClient = null;
  let mcpBuf = '';

  function processNext() {
    if (processing || requestQueue.length === 0) return;
    processing = true;
    const { client, resolve } = requestQueue.shift();
    currentClient = client;

    const onClientError = () => {
      currentClient = null;
      processing = false;
      resolve(null);
      processNext();
    };
    client.once('error', onClientError);
    client.once('close', onClientError);
  }

  mcp.stdout.on('data', (data) => {
    mcpBuf += data.toString();
    const lines = mcpBuf.split('\n');
    mcpBuf = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const response = JSON.parse(trimmed);
        if (currentClient) {
          currentClient.write(JSON.stringify(response) + '\n');
          currentClient = null;
        }
        processing = false;
        if (requestQueue.length > 0) {
          processNext();
        }
      } catch {
        log(`Failed to parse MCP response: ${trimmed.slice(0, 200)}`);
        processing = false;
        if (requestQueue.length > 0) {
          processNext();
        }
      }
    }
  });

  if (existsSync(sockPath)) {
    try { unlinkSync(sockPath); } catch {}
  }

  const server = createServer((client) => {
    let clientBuf = '';

    client.on('data', (data) => {
      clientBuf += data.toString();
      const lines = clientBuf.split('\n');
      clientBuf = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let msg;
        try {
          msg = JSON.parse(trimmed);
        } catch {
          log(`Failed to parse client message: ${trimmed.slice(0, 200)}`);
          continue;
        }

        if (msg.method === 'stop') {
          log('Stop command received');
          client.write(JSON.stringify({ jsonrpc: '2.0', result: 'stopping', id: msg.id ?? null }) + '\n');
          setImmediate(() => cleanup(false));
          return;
        }

        const promise = new Promise((resolve) => {
          requestQueue.push({ client, resolve });
        });

        mcp.stdin.write(JSON.stringify(msg) + '\n');

        if (!processing) {
          processNext();
        }
      }
    });

    client.on('error', (err) => {
      log(`Client socket error: ${err.message}`);
    });

    client.on('close', () => {
      if (currentClient === client) {
        currentClient = null;
        processing = false;
        if (requestQueue.length > 0) {
          processNext();
        }
      }
      for (let i = requestQueue.length - 1; i >= 0; i--) {
        if (requestQueue[i].client === client) {
          requestQueue[i].resolve(null);
          requestQueue.splice(i, 1);
        }
      }
    });
  });

  server.listen(sockPath, () => {
    log(`Daemon started (PID: ${process.pid}, socket: ${sockPath})`);
  });

  server.on('error', (err) => {
    log(`Socket server error: ${err.message}`);
  });

  let cleaningUp = false;

  function cleanup(isMcpExit = false) {
    if (cleaningUp) return;
    cleaningUp = true;
    log('Shutting down...');

    try { if (mcp && !mcp.killed) mcp.kill(); } catch {}
    try { server.close(); } catch {}
    try { if (existsSync(sockPath)) unlinkSync(sockPath); } catch {}
    if (!isMcpExit) {
      try { if (existsSync(pidFile)) unlinkSync(pidFile); } catch {}
    }

    log('Daemon stopped');
    process.exit(0);
  }

  process.on('SIGTERM', () => cleanup(false));
  process.on('SIGINT', () => cleanup(false));
  process.on('SIGQUIT', () => cleanup(false));

  process.on('uncaughtException', (err) => {
    log(`Uncaught exception: ${err.stack || err.message}`);
    cleanup(false);
  });

  return { mcp, server, cleanup, pid: process.pid };
}

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('daemon.js') ||
  process.argv[1].endsWith('/daemon.js')
);

if (isDirectRun) {
  const args = parseArgs(process.argv.slice(2));
  startDaemon(args);
}

export default startDaemon;
