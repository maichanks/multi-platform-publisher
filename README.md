# Multi-Platform Publisher

[English](#english) | [中文](#中文)

---

## English

**Status**: Release Candidate (v1.0.0-rc.1) | **License**: MIT | **Author**: maichanks

Enterprise-grade platform for publishing content to multiple social channels with team collaboration, analytics, and compliance.

### Key Features

- Multi-platform publishing (Twitter, Reddit, LinkedIn, Xiaohongshu)
- Workspace-based RBAC (Creator, Admin, Editor, Viewer)
- Content lifecycle: draft → schedule → publish
- Analytics dashboard with CSV export
- Rate limiting, tenant isolation, audit logs

### Quick Start

```bash
git clone https://github.com/maichanks/multi-platform-publisher.git
cd multi-platform-publisher

# Install
cd backend && pnpm install
cd ../frontend && pnpm install

# Mock mode (no credentials)
# Terminal 1
cd backend && node mock-server.js
# Terminal 2
cd frontend && pnpm run dev

# Open http://localhost:5173
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production.

---

## 中文

**状态**: 发布候选 (v1.0.0-rc.1) | **许可证**: MIT | **作者**: maichanks

企业级多平台内容发布平台，支持团队协作、数据分析和合规管理。

### 核心功能

- 多平台发布：Twitter、Reddit、LinkedIn、小红书
- 工作区多租户与 RBAC 权限（Creator/Admin/Editor/Viewer）
- 内容全流程：草稿 → 定时 → 发布
- 数据分析面板，支持 CSV 导出
- 速率限制、租户隔离、审计日志

### 快速开始

```bash
git clone https://github.com/maichanks/multi-platform-publisher.git
cd multi-platform-publisher

# 安装依赖
cd backend && pnpm install
cd ../frontend && pnpm install

# Mock 模式（无需凭证）
# 终端 1
cd backend && node mock-server.js
# 终端 2
cd frontend && pnpm run dev

# 访问 http://localhost:5173
```

生产部署见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。
