# chrome-cli

> **[English](README.md)**

通过 Chrome DevTools Protocol (CDP) 在命令行控制 Chrome/Chromium 浏览器。

`chrome-cli` 是一个轻量级 CLI 工具，通过 Unix socket 守护进程连接 `chrome-devtools-mcp`，实现对浏览器的完整 CDP 控制 —— 导航、DOM 交互、截图、JavaScript 执行等。

**特别适用于连接已有浏览器实例**（保留登录态、Cookie、扩展），无需每次都启动新的无痕浏览器。

## 特性

- **连接正在运行的 Chrome/Chromium** — 使用你现有的浏览器，保留所有 Cookie、会话和扩展
- **Unix socket 守护进程** — 轻量级，无 HTTP 服务，仅本地通信
- **简单命令** — 导航、点击、输入、截图、执行 JS、获取 DOM
- **零额外依赖** — 只需 Node.js 和 `chrome-devtools-mcp`

## 安装

```bash
npm install -g chrome-cli
```

或者直接运行：

```bash
npx chrome-cli <command>
```

## 前提条件

Chrome/Chromium 需要以远程调试模式启动：

```bash
# Linux
google-chrome --remote-debugging-port=9222

# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Windows
Start-Process chrome -ArgumentList '--remote-debugging-port=9222'
```

## 使用

```bash
# 启动守护进程（连接浏览器）
chrome-cli start --browser-url http://127.0.0.1:9222

# 导航到页面
chrome-cli navigate https://example.com

# 获取 DOM 快照（含元素 UID）
chrome-cli snapshot

# 点击元素
chrome-cli click 1_27

# 填写表单
chrome-cli fill 1_26 "搜索内容"

# 执行 JavaScript
chrome-cli eval "() => document.title"

# 截图
chrome-cli screenshot /tmp/page.png

# 在新标签页中打开
chrome-cli new https://example.com

# 列出所有标签页
chrome-cli list-pages

# 查看守护进程状态
chrome-cli status

# 停止守护进程
chrome-cli stop
```

## 架构

```
chrome-cli start
  └── daemon.js（进程管理器）
       ├── PID 文件   → /tmp/chrome-cli-<uid>/daemon.pid
       ├── Unix socket → /tmp/chrome-cli-<uid>/server.sock
       ├── 日志文件   → /tmp/chrome-cli-<uid>/daemon.log
       └── 子进程 → chrome-devtools-mcp (stdio) → CDP → 浏览器

chrome-cli navigate/click/snapshot/...
  └── 连接 socket → JSON-RPC → MCP Server → CDP → 浏览器
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `start [--browser-url]` | 启动守护进程并连接浏览器 |
| `stop` | 停止守护进程 |
| `status` | 查看守护进程状态 |
| `navigate <url>` | 导航到指定 URL |
| `new <url>` | 在新标签页中打开 URL |
| `click <uid>` | 点击指定元素 |
| `fill <uid> <text>` | 填写表单字段 |
| `snapshot` | 获取 DOM 快照（含元素 UID） |
| `screenshot [path]` | 截图 |
| `eval <code>` | 执行 JavaScript |
| `list-pages` | 列出所有标签页（别名: `tabs`） |

## 工作原理

`chrome-cli` 启动一个后台守护进程，它负责启动 `chrome-devtools-mcp` 作为子进程。守护进程监听 Unix socket，将 JSON-RPC 消息转发到 MCP Server 的标准输入，MCP Server 再将其转换为 Chrome DevTools Protocol 命令。

这种架构意味着：
- 守护进程和浏览器相互独立 — 关闭终端不会关闭你的浏览器
- 多个 `chrome-cli` 命令共享同一个守护进程连接
- 所有通信都通过本地 Unix socket — 不暴露网络端口

## 许可证

MIT
