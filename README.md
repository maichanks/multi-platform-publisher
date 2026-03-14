# Multi-Platform Publisher for OpenClaw

[![OpenClaw MCP Service](https://img.shields.io/badge/OpenClaw-MCP-ff6b6b)](https://github.com/openclaw/openclaw)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](/LICENSE)
[![Status](https://img.shields.io/badge/status-Release%20Candidate-orange)](/LICENSE)

[English](#english) | [中文](#中文)

---

## English

**Status**: Release Candidate (v1.0.0-rc.1) | **License**: MIT | **Author**: maichanks

An enterprise-grade multi-platform content publishing platform with team collaboration, analytics, and compliance. Designed to work as an MCP (Model Context Protocol) service for OpenClaw.

### Key Features

- Multi-platform publishing (Twitter, Reddit, LinkedIn, Xiaohongshu)
- Workspace-based RBAC (Creator, Admin, Editor, Viewer)
- Content lifecycle: draft → schedule → publish
- Analytics dashboard with CSV export
- Rate limiting, tenant isolation, audit logs
- RESTful API for MCP integration

### Quick Start (Local Dev)

```bash
git clone https://github.com/maichanks/multi-platform-publisher.git
cd multi-platform-publisher

# Install
cd backend && pnpm install
cd ../frontend && pnpm install

# Mock mode (no credentials)
# Terminal 1: Backend (port 3000)
cd backend && node mock-server.js
# Terminal 2: Frontend (port 5173)
cd frontend && pnpm run dev

# Open http://localhost:5173
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production.

---

## OpenClaw Integration

This publisher can be used as an **MCP server** that OpenClaw skills call to publish content.

#### 1. Deploy the backend API

Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) to get the backend running (Docker recommended). Ensure it's accessible at `http://localhost:3000` or a public URL.

#### 2. Configure OpenClaw skill to use the MCP

Create a skill that calls the publisher's API, or use `agent-reach` to define a channel. Example `.env` for your skill:

```env
PUBLISHER_API_URL=http://localhost:3000/api/v1
PUBLISHER_API_KEY=your-secret-key  # if auth enabled
```

#### 3. Call from your OpenClaw skill

```javascript
// Example in an OpenClaw skill
const response = await fetch(`${process.env.PUBLISHER_API_URL}/publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.PUBLISHER_API_KEY}` },
  body: JSON.stringify({ platform: 'xiaohongshu', content: '...' })
});
```

#### 4. (Optional) Add to OpenClaw cron for automated posting

```bash
openclaw cron add \
  --name "Auto Publisher" \
  --cron "0 12 * * *" \
  --session isolated \
  --message "node $HOME/.openclaw/workspace/skills/my-publisher-skill/index.js"
```

---

## 中文

**状态**: 发布候选 (v1.0.0-rc.1) | **许可证**: MIT | **作者**: maichanks

企业级多平台内容发布平台，支持团队协作、数据分析和合规管理。可作为 OpenClaw 的 MCP（Model Context Protocol）服务。

### 核心功能

- 多平台发布：Twitter、Reddit、LinkedIn、小红书
- 工作区多租户与 RBAC 权限（Creator/Admin/Editor/Viewer）
- 内容全流程：草稿 → 定时 → 发布
- 数据分析面板，支持 CSV 导出
- 速率限制、租户隔离、审计日志
- 提供 RESTful API 供 MCP 集成

### 快速开始（本地开发）

```bash
git clone https://github.com/maichanks/multi-platform-publisher.git
cd multi-platform-publisher

# 安装依赖
cd backend && pnpm install
cd ../frontend && pnpm install

# Mock 模式（无需凭证）
# 终端 1：后端 (port 3000)
cd backend && node mock-server.js
# 终端 2：前端 (port 5173)
cd frontend && pnpm run dev

# 访问 http://localhost:5173
```

生产部署见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

---

## OpenClaw 集成

本发布平台可作为 **MCP 服务器**供 OpenClaw skills 调用。

#### 1. 部署后端 API

按 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) 使后端运行（推荐 Docker）。确保可访问地址为 `http://localhost:3000` 或公网 URL。

#### 2. 配置 OpenClaw skill 使用 MCP

创建一个调用发布 API 的 OpenClaw skill，或使用 `agent-reach` 定义频道。示例 `.env`：

```env
PUBLISHER_API_URL=http://localhost:3000/api/v1
PUBLISHER_API_KEY=your-secret-key  # 如启用认证
```

#### 3. 在 OpenClaw skill 中调用

```javascript
// 示例
const response = await fetch(`${process.env.PUBLISHER_API_URL}/publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.PUBLISHER_API_KEY}` },
  body: JSON.stringify({ platform: 'xiaohongshu', content: '...' })
});
```

#### 4. （可选）添加到 OpenClaw cron 实现自动发布

```bash
openclaw cron add \
  --name "Auto Publisher" \
  --cron "0 12 * * *" \
  --session isolated \
  --message "node $HOME/.openclaw/workspace/skills/my-publisher-skill/index.js"
```
