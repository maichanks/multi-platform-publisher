# Multi-Platform Publisher v1.0.0-rc.1

**Release Date**: 2026-03-12  
**Status**: Release Candidate (RC) - Ready for testing

---

## 🎉 What's New

We're thrilled to announce the first release candidate of **Multi-Platform Publisher** – a comprehensive platform for teams to publish and manage content across multiple social media channels.

### Key Features

- **Multi-Channel Publishing** Publish to Twitter, Reddit, LinkedIn, and Xiaohongshu (via MCP browser automation) from a single dashboard
- **Team Collaboration** Workspace-based multi-tenancy with role-based access control (Creator, Admin, Editor, Viewer)
- **Content Lifecycle** Draft → Review → Schedule → Publish queues, with status tracking and error handling
- **Analytics Dashboard** Unified metrics (impressions, engagement, trends) with CSV export and date-range filtering
- **Compliance Scanning** Optional AI-powered content audit with override workflows
- **AI Adaptation** Preview how content adapts per platform (extensible for future auto-adaptation)
- **Enterprise-Grade** Rate limiting, tenant isolation, audit trails, and security hardening

---

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/maichanks/multi-platform-publisher.git
cd multi-platform-publisher

# Backend & frontend install (pnpm recommended)
cd backend && pnpm install
cd ../frontend && pnpm install

# Start Mock mode (no credentials needed)
cd backend && node mock-server.js  # terminal 1
cd frontend && pnpm run dev        # terminal 2

# Open http://localhost:5173
# Login: use localStorage bypass (see README)
```

For production deployment with real databases and API credentials, see [DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## 🔐 Security & Compliance

- **RBAC**: Six permission levels (`WORKSPACE_CREATE`, `CONTENT_PUBLISH`, `ANALYTICS_READ`, etc.)
- **Tenant Isolation**: All data queries scoped by `tenantId` and `workspaceId`; enforced via `TenantGuard`
- **Rate Limiting**: Global (100/min), Auth endpoints (5/min), Admin (30/min)
- **Audit Logging**: Activity and audit logs capture all sensitive operations
- **Input Validation**: `class-validator` on all DTOs, GlobalValidationPipe enabled

---

## 📦 Architecture

```
Frontend (React + Ant Design + Vite)
   ↓
Backend (NestJS + Prisma + PostgreSQL)
   ↓
Redis (caching) + Bull (queues)
   ↓
Social Platform APIs (Twitter v2, Reddit, LinkedIn, Xiaohongshu MCP)
```

---

## 🧪 Testing

- **Unit & Integration**: Backend services tested with Jest
- **E2E Scaffolding**: Playwright configured (tests pending credential setup)
- **Manual QA Suite**: Postman collection and `backend/qa-runner.js` for Mock mode validation

See [docs/TESTING.md](docs/TESTING.md) for details.

---

## ⚙️ Configuration

Required environment variables for production:

```bash
# Core
NODE_ENV=production
PORT=3000
JWT_SECRET=<random-256-bit>
DATABASE_URL=postgresql://...

# Platform Credentials (optional for mock mode)
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USER_AGENT=...
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenRouter (optional AI adaptation)
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=stepfun/step-3.5-flash
```

Full list in `backend/.env.example`.

---

## 📖 Documentation

- **README.md** – Quick start and feature overview
- **DEPLOYMENT.md** – Production setup with Docker
- **API.md** – OpenAPI reference
- **SECURITY.md** – Hardening and compliance guidelines
- **TROUBLESHOOTING.md** – Common issues and fixes
- **CHANGELOG.md** – Version history

---

## 🐛 Known Issues (RC)

1. **Real platform integration not tested** – API credentials needed to test live publishing
2. **npm workspaces quirks** – Frontend install may fail with npm; use pnpm
3. **Disk space monitoring** – High disk usage observed in heartbeat checks; log rotation recommended
4. **Docker registry access** – Some environments may need mirror configuration

---

## 🤝 Contributing

We welcome community feedback! Please open issues for bugs, feature requests, or documentation improvements.

---

## 📄 License

MIT © 2026 maichanks
