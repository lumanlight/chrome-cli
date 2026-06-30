# chrome-cli

> **[中文文档](README.zh.md)**

Control Chrome/Chromium browser from the command line via Chrome DevTools Protocol (CDP).

`chrome-cli` is a lightweight CLI daemon that bridges a Unix socket to an MCP Server, giving you full CDP control over a browser — navigation, DOM interaction, screenshots, JavaScript execution, and more.

## Features

- **Connect to any running Chrome/Chromium** — use your existing browser with all cookies, sessions, and extensions
- **Unix socket daemon** — lightweight, no HTTP server, local-only
- **Simple commands** — navigate, click, fill, screenshot, eval, snapshot
- **No dependencies** beyond Node.js and `chrome-devtools-mcp`

## Installation

```bash
npm install -g chrome-cli
```

Or run directly:

```bash
npx chrome-cli <command>
```

## Prerequisites

Chrome/Chromium must be started with remote debugging enabled:

```bash
# Linux
google-chrome --remote-debugging-port=9222

# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Windows
Start-Process chrome -ArgumentList '--remote-debugging-port=9222'
```

## Usage

```bash
# Start the daemon (connect to browser on port 9222)
chrome-cli start --browser-url http://127.0.0.1:9222

# Navigate to a URL
chrome-cli navigate https://example.com

# Get DOM snapshot (with element UIDs for interaction)
chrome-cli snapshot

# Click an element
chrome-cli click 1_27

# Fill a form field
chrome-cli fill 1_26 "search text"

# Execute JavaScript
chrome-cli eval "() => document.title"

# Take a screenshot
chrome-cli screenshot /tmp/page.png

# Open URL in a new tab
chrome-cli new https://example.com

# List open pages
chrome-cli list-pages

# Check daemon status
chrome-cli status

# Stop the daemon
chrome-cli stop
```

## Architecture

```
chrome-cli start
  └── daemon.js (process manager)
       ├── PID file   → /tmp/chrome-cli-<uid>/daemon.pid
       ├── Unix socket → /tmp/chrome-cli-<uid>/server.sock
       ├── Log file   → /tmp/chrome-cli-<uid>/daemon.log
       └── Child process → chrome-devtools-mcp (stdio) → CDP → Browser

chrome-cli navigate/click/snapshot/...
  └── Connect to socket → JSON-RPC → MCP Server → CDP → Browser
```

## Commands

| Command | Description |
|---------|-------------|
| `start [--browser-url]` | Start the daemon and connect to browser |
| `stop` | Stop the daemon |
| `status` | Check daemon status |
| `navigate <url>` | Navigate current page |
| `new <url>` | Open URL in a new tab |
| `click <uid>` | Click an element by UID |
| `fill <uid> <text>` | Fill a form field |
| `snapshot` | Get DOM snapshot with element UIDs |
| `screenshot [path]` | Take a screenshot |
| `eval <code>` | Execute JavaScript |
| `list-pages` | List open pages (alias: `tabs`) |

## How It Works

`chrome-cli` starts a background daemon that spawns `chrome-devtools-mcp` as a subprocess. The daemon listens on a Unix socket and forwards JSON-RPC messages to the MCP Server's stdin, which translates them to Chrome DevTools Protocol commands.

This architecture means:
- The daemon and browser are independent — closing the terminal won't close your browser
- Multiple `chrome-cli` commands share the same daemon connection
- All communication is local via Unix socket — no network exposure

## License

MIT
