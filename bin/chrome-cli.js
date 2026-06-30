#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const args = process.argv.slice(2);
const globalFlags = {};
const commandArgs = [];

for (let i = 0; i < args.length; i++) {
  // Always check for flags, regardless of position
  if (args[i].startsWith('--') && !args[i].startsWith('-----')) {
    const key = args[i].replace(/^--/, '');
    // Check if next arg is a value (not a flag and not the command)
    if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
      globalFlags[key] = args[i + 1];
      i++;
    } else {
      globalFlags[key] = true;
    }
  } else {
    commandArgs.push(args[i]);
  }
}

const command = commandArgs[0];
const cmdArgs = commandArgs.slice(1);

if (!command || command === '--help' || command === '-h') {
  console.log(`
chrome-cli v${pkg.version} — Control Chrome/Chromium from the command line

Usage:
  chrome-cli <command> [args...] [options]

Commands:
  start                     Start the daemon and MCP Server
    --browser-url <url>     Connect to existing browser
  stop                      Stop the daemon
  status                    Check daemon status
  navigate <url>            Navigate to a URL
  new <url>                 Open URL in a new tab
  click <uid>               Click an element by UID
  fill <uid> <text>         Fill a form field
  snapshot                  Get DOM snapshot with element UIDs
  screenshot [path]         Take a screenshot (default: screenshot-<timestamp>.png)
  eval <code>               Execute JavaScript in the page
  list-pages                List open pages (alias: tabs)

Global options:
  --browser-url <url>       Default browser URL for the daemon
  --help, -h                Show help
  --version, -v             Show version

Examples:
  chrome-cli start --browser-url http://127.0.0.1:9225
  chrome-cli navigate https://baidu.com
  chrome-cli snapshot
  chrome-cli click 1_27
  chrome-cli eval "() => document.title"
  chrome-cli stop
`);
  process.exit(0);
}

if (command === '--version' || command === '-v') {
  console.log(pkg.version);
  process.exit(0);
}

const cmdPath = join(__dirname, '..', 'src', 'commands', `${command}.js`);
if (!existsSync(cmdPath)) {
  if (command === 'tabs') {
    const listPages = await import(join(__dirname, '..', 'src', 'commands', 'list-pages.js'));
    const result = await listPages.default(cmdArgs, globalFlags);
    if (result) console.log(result);
    process.exit(0);
  }
  // Suggest similar commands
  const suggestions = {
    'list': 'list-pages',
    'open': 'navigate',
    'go': 'navigate',
    'ls': 'list-pages',
    'tab': 'list-pages',
    'ss': 'screenshot',
    'screencap': 'screenshot',
    'execute': 'eval',
    'run': 'eval',
  };
  if (suggestions[command]) {
    console.error(`Unknown command: ${command}`);
    console.error(`Did you mean '${suggestions[command]}'?`);
  } else {
    console.error(`Unknown command: ${command}`);
    console.error(`Run 'chrome-cli --help' for available commands`);
  }
  process.exit(1);
}

try {
  const handler = await import(cmdPath);
  const result = await handler.default(cmdArgs, globalFlags);
  if (result) console.log(result);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
